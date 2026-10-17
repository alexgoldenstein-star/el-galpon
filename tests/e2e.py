"""Prueba de punta a punta del sitio en un navegador real (Chromium), con una base de datos simulada.
Corre con:  python3 tests/e2e.py      (necesita: pip install playwright && playwright install chromium)
"""
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix='galpon-e2e-')
for item in os.listdir(ROOT):
    if item in ('tests', 'node_modules', '.git', 'api', 'src', 'scripts'): continue
    src = os.path.join(ROOT, item)
    (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, os.path.join(TMP, item))
shutil.copy(os.path.join(ROOT, 'tests', 'mockfb.js'), TMP)
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
html = re.sub(r'\s*<script src="https://www.gstatic.com/firebasejs/[^"]+"></script>', '', html)
html = html.replace('<script src="firebase-config.js"></script>', '<script src="mockfb.js"></script>\n  <script src="firebase-config.js"></script>')
open(os.path.join(TMP, 'index.html'), 'w', encoding='utf-8').write(html)
PORT = 8799
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', TMP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
B = f'http://localhost:{PORT}/'
results = []
def check(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('OK  ' if cond else 'BAD ') + name + ('' if cond else '  ' + str(extra)[:200]))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        async def page(url, w=390, h=844):
            ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
            await ctx.route('**/api/**', lambda r: r.fulfill(status=404, body='{}'))
            await ctx.route('https://wa.me/**', lambda r: r.fulfill(status=200, body='WA'))
            await ctx.route('https://fonts.googleapis.com/**', lambda r: r.abort())
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(B + url); await pg.wait_for_timeout(1000); return ctx, pg
        store = lambda pg: pg.evaluate("JSON.parse(localStorage.getItem('mockstore'))")

        # catálogo y pedido (sin servidor: se guarda directo)
        ctx, pg = await page('?v=marta&nosw=1#catalogo')
        check('catálogo muestra productos', await pg.eval_on_selector_all('.card', 'e=>e.length') >= 3)
        await pg.click('[data-act=catmode][data-mode=list]')
        check('lista rápida', await pg.eval_on_selector_all('.qrow', 'e=>e.length') >= 3)
        await pg.click(".qrow:has-text('Juego de sábanas') .add")
        for _ in range(2): await pg.click(".qrow:has-text('Juego de sábanas') [data-act=inc]")
        await pg.click('.cart-btn'); await pg.fill('#b-name', 'Rosa Feriante'); await pg.fill('#b-phone', '1199998888'); await pg.fill('#b-barrio', 'Feria')
        await pg.click('#send-order'); await pg.wait_for_timeout(3000)
        check('el pedido abre WhatsApp con el mensaje', 'wa.me' in pg.url)
        pg2 = await ctx.new_page(); await pg2.goto(B + '?nosw=1'); await pg2.wait_for_timeout(500)
        s = await store(pg2); new = [o for k, o in s['orders'].items() if k not in ('o1', 'o2')]
        check('pedido guardado con vendedor del link', new and new[0].get('ref') == 'MARTA' and new[0]['total'] == 43500, new)

        # panel: entregar (stock y puntos), rubros, historial
        ctx, pa = await page('?admin=1&nosw=1#admin', 1280, 900)
        await pa.click('[data-act=ofilter][data-f=todos]'); await pa.select_option('select[data-order=o1]', 'entregado'); await pa.wait_for_timeout(1500)
        s = await store(pa)
        check('entregar descuenta stock', s['products']['p01']['qty'] == 9, s['products']['p01'].get('qty'))
        check('entregar suma puntos al cliente', s['clients']['1199998888']['points'] > 20, s['clients']['1199998888'])
        check('entregar calcula la comisión', s['orders']['o1']['commission']['seller']['amount'] == 6510)
        await pa.click('[data-act=tab][data-tab=productos]'); await pa.click('[data-act=cats]'); await pa.click('[data-act=cat-tree]'); await pa.wait_for_timeout(800)
        s = await store(pa)
        check('estructura de rubros sugerida', s['site']['main']['categories'][:5] == ['Bazar', 'Hogar', 'Tecnología', 'Marroquinería', 'Blanquería'], s['site']['main']['categories'])
        check('productos reubicados en subrubros', s['products']['p03']['cat'] == 'Bazar' and s['products']['p03']['sub'] == 'Frascos y especieros')
        await pa.keyboard.press('Escape')
        await pa.fill('input[data-quick=price][data-id=p03]', '5900'); await pa.press('input[data-quick=price][data-id=p03]', 'Tab'); await pa.wait_for_timeout(500)
        await pa.click('[data-act=tab][data-tab=historial]'); await pa.wait_for_timeout(600)
        check('historial registra el cambio de precio', 'Frascos herméticos x3: precio 5400' in await pa.inner_text('.audit-list'))
        async with pa.expect_download() as d: await pa.click('[data-act=backup]')
        dl = await d.value; bj = json.load(open(await dl.path()))
        check('copia de seguridad completa', len(bj['collections']['products']) == 4 and 'orders' in bj['collections'])
        await pa.click('[data-act=tab][data-tab=promos]'); await pa.click('[data-act=poster][data-type=promo] >> nth=0'); await pa.wait_for_timeout(2500)
        src = await pa.get_attribute('.poster-prev img', 'src') or ''
        check('promo con productos se genera', src.startswith('data:image/jpeg') and len(src) > 50000)
        await pa.click('[data-act=close-poster].x')
        await pa.click('[data-act=catpdf] >> nth=0'); await pa.click('[data-act=catpdf-go]')
        await pa.wait_for_selector('text=Descargar PDF', timeout=30000)
        check('catálogo PDF se arma', True)

        # cliente y vendedor
        ctx, pc = await page('?client=1&nosw=1#cuenta', 390, 844)
        check('mi cuenta muestra pedidos con estado', await pc.eval_on_selector_all('.corder', 'e=>e.length') == 2)
        check('mi cuenta muestra nivel y puntos', bool(await pc.query_selector('.tier-card')) and bool(await pc.query_selector('.points-card')))
        ctx, ps = await page('?seller=1&nosw=1#admin', 390, 844)
        check('panel del vendedor', 'código' in (await ps.inner_text('.admin-top')).lower())
        await ps.click('[data-act=seller-order] >> nth=0'); await ps.wait_for_timeout(400)
        check('vendedor arma pedido para su cliente', ps.url.endswith('#catalogo'))

        # app instalable y páginas
        ctx, pw = await page('?nosw=1#como-trabajamos')
        check('página cómo trabajamos', 'Nuestras garantías' in await pw.inner_text('main'))
        r = await pw.goto(B + 'manifest.webmanifest'); m = await r.json()
        check('manifest de la app', m['display'] == 'standalone' and len(m['icons']) >= 3)
        check('sin errores de JavaScript', not errs, errs)
        await b.close()

asyncio.run(main())
srv.terminate(); shutil.rmtree(TMP, ignore_errors=True)
bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} pruebas del sitio OK')
sys.exit(1 if bad else 0)
