// Páginas livianas por producto (/p/ID) y por rubro (/c/rubro): las encuentra Google
// y al compartirlas por WhatsApp muestran la foto. Llevan al catálogo para pedir.
const { getDoc, listProducts, esc, slug } = require('./_public');
const L = require('./_logic');
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
function phoneShown(c) {
  let d = String((c && c.whatsapp) || '').replace(/\D/g, ''); if (!d) return '';
  if (c.whatsappDisplay && c.whatsappDisplay.replace(/\D/g, '') !== d) return c.whatsappDisplay;
  if (d.startsWith('549')) d = d.slice(3);
  return d.length === 10 && d.startsWith('11') ? '11 ' + d.slice(2, 6) + '-' + d.slice(6) : d;
}
const LOGO = '<svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#FF6B1A"/><path d="M6 14 16 7l10 7M9 13v12h14V13M13 25v-6h6v6" fill="none" stroke="#1E2A5A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function page(site, base, { title, desc, image, url, body, jsonld }) {
  const brand = esc((site.brand && site.brand.name) || 'El Galpón');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${brand}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}<meta property="og:url" content="${esc(url)}">
<meta name="theme-color" content="#FF6B1A"><link rel="icon" href="/icons/favicon-32.png"><link rel="manifest" href="/manifest.webmanifest">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
<style>:root{--o:#FF6B1A;--n:#1E2A5A;--c:#FFF8F0;--l:#F0DCC8;--g:#15803D}*{box-sizing:border-box}body{margin:0;font-family:Figtree,system-ui,-apple-system,Segoe UI,sans-serif;background:var(--c);color:var(--n);line-height:1.5}
a{color:inherit}.w{max-width:1000px;margin:0 auto;padding:0 18px}header{background:#fff;border-bottom:1px solid var(--l)}header .w{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-block:12px}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;text-decoration:none}.logo i{width:36px;height:36px;border-radius:10px;background:var(--o);display:inline-block}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 20px;border-radius:12px;font-weight:800;text-decoration:none;border:2px solid var(--n)}
.btn.m{background:var(--o);border-color:var(--o)}.crumb{font-size:14px;color:#6B7299;margin:18px 0}.crumb a{text-decoration:none}
.prod{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}.prod img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:20px;background:#fff}
h1{font-size:clamp(28px,4vw,40px);line-height:1.1;margin:0 0 10px}.price{font-size:40px;font-weight:800}.sug{color:#4A5380}.gain{display:inline-block;background:#DCFCE7;color:var(--g);font-weight:800;border-radius:999px;padding:4px 12px;margin:8px 0}
.ctas{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin:12px 0 40px}
.card{background:#fff;border:1px solid var(--l);border-radius:16px;overflow:hidden;text-decoration:none;display:flex;flex-direction:column}.card img{width:100%;aspect-ratio:1;object-fit:cover}.card div{padding:10px 12px}.card b{display:block;font-size:15px}.card span{font-weight:800}
footer{background:var(--n);color:#fff;padding:28px 0;margin-top:40px;font-size:14px}@media(max-width:700px){.prod{grid-template-columns:1fr}}</style></head>
<body><header><div class="w"><a class="logo" href="/">${LOGO}${brand}</a><a class="btn" href="/#catalogo">Ver catálogo</a></div></header><main class="w">${body}</main>
<footer><div class="w">${brand} · Mayorista para feriantes de todo Buenos Aires${phoneShown(site.contact) ? ' · WhatsApp ' + esc(phoneShown(site.contact)) : ''}</div></footer></body></html>`;
}
function abs(base, img) { if (!img) return ''; return /^https?:/.test(img) ? img : base + '/' + String(img).replace(/^\//, ''); }
function card(base, p) { return `<a class="card" href="/p/${esc(p.id)}"><img src="${esc(abs(base, p.img))}" alt="${esc(p.name)}" loading="lazy"><div><b>${esc(p.name)}</b><span>${money(L.priceOf(p))}</span></div></a>`; }
module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const base = String(process.env.SITE_URL || 'https://' + req.headers.host).replace(/\/$/, '');
  try {
    const site = (await getDoc('site/main')) || {};
    const brand = (site.brand && site.brand.name) || 'El Galpón';
    let html, status = 200;
    if (q.t === 'p') {
      const id = String(q.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
      const p = id ? await getDoc('products/' + id) : null;
      if (!p) { status = 404; html = page(site, base, { title: 'Producto no encontrado · ' + brand, desc: 'Mirá el catálogo completo.', url: base + '/#catalogo', body: '<h1 style="margin-top:30px">Este producto ya no está</h1><p><a class="btn m" href="/#catalogo">Ver el catálogo</a></p>' }); }
      else {
        const all = await listProducts();
        const rel = all.filter((x) => x.id !== p.id && x.cat === p.cat && x.stock !== 'out').slice(0, 8);
        const price = L.priceOf(p), gain = (Number(p.sug) || 0) - price, img = abs(base, p.img);
        const desc = `${p.name} a precio mayorista: ${money(price)}${p.sug ? `. Se vende a ${money(p.sug)}, ganás ${money(gain)} por unidad` : ''}. ${brand}, depósito para feriantes de todo Buenos Aires.`;
        html = page(site, base, { title: `${p.name} por mayor · ${brand}`, desc, image: img, url: `${base}/p/${p.id}`,
          jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: img ? [img] : undefined, description: p.desc || desc, sku: p.sku || p.id, category: [p.cat, p.sub].filter(Boolean).join(' > '),
            brand: { '@type': 'Brand', name: brand }, offers: { '@type': 'Offer', priceCurrency: 'ARS', price: price, availability: p.stock === 'out' ? 'https://schema.org/OutOfStock' : p.stock === 'order' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock', url: `${base}/p/${p.id}` } },
          body: `<div class="crumb"><a href="/#catalogo">Catálogo</a> › <a href="/c/${slug(p.cat)}">${esc(p.cat)}</a>${p.sub ? ' › ' + esc(p.sub) : ''}</div>
<div class="prod"><img src="${esc(img)}" alt="${esc(p.name)}"><div><h1>${esc(p.name)}</h1>${p.sku ? `<div class="sug">Código ${esc(p.sku)}</div>` : ''}
<div style="margin-top:14px;font-size:14px;color:#6B7299;font-weight:700">PRECIO MAYORISTA</div><div class="price">${money(price)}</div>
${p.sug ? `<div class="sug">Precio sugerido de venta: <b>${money(p.sug)}</b></div><div class="gain">Ganás ${money(gain)} por unidad</div>` : ''}
${p.desc ? `<p>${esc(p.desc)}</p>` : ''}${p.stock === 'out' ? '<p><b>Sin stock por ahora.</b></p>' : p.stock === 'order' ? '<p><b>Por encargo.</b></p>' : ''}
<div class="ctas"><a class="btn m" href="/#producto-${esc(p.id)}">Pedir este producto</a><a class="btn" href="/#catalogo">Ver todo el catálogo</a></div>
<p style="font-size:14px;color:#4A5380">Pedís por la web o por WhatsApp, retirás en el depósito o te lo enviamos. Sin cuota ni inscripción.</p></div></div>
${rel.length ? `<h2>Más de ${esc(p.cat)}</h2><div class="grid">${rel.map((x) => card(base, x)).join('')}</div>` : ''}` });
      }
    } else if (q.t === 'c') {
      const all = await listProducts();
      const cats = site.categories || [];
      const c = cats.find((x) => slug(x) === String(q.slug || ''));
      if (!c) { status = 404; html = page(site, base, { title: 'Rubro no encontrado · ' + brand, desc: 'Mirá el catálogo completo.', url: base + '/#catalogo', body: '<h1 style="margin-top:30px">No encontramos ese rubro</h1><p><a class="btn m" href="/#catalogo">Ver el catálogo</a></p>' }); }
      else {
        const list = all.filter((p) => p.cat === c && p.stock !== 'out');
        const subs = ((site.subcats || {})[c] || []).filter((s) => list.some((p) => p.sub === s));
        const desc = `${c} por mayor para feriantes y revendedores de todo Buenos Aires${subs.length ? ': ' + subs.slice(0, 6).join(', ') : ''}. ${list.length} productos a precio de depósito.`;
        html = page(site, base, { title: `${c} por mayor · ${brand}`, desc, image: list[0] ? abs(base, list[0].img) : '', url: `${base}/c/${slug(c)}`,
          body: `<div class="crumb"><a href="/#catalogo">Catálogo</a> › ${esc(c)}</div><h1>${esc(c)} por mayor</h1><p>${esc(desc)}</p>` +
            (subs.length ? subs.map((s) => `<h2>${esc(s)}</h2><div class="grid">${list.filter((p) => p.sub === s).map((p) => card(base, p)).join('')}</div>`).join('') + (list.some((p) => !subs.includes(p.sub)) ? `<h2>Otros</h2><div class="grid">${list.filter((p) => !subs.includes(p.sub)).map((p) => card(base, p)).join('')}</div>` : '')
              : `<div class="grid">${list.map((p) => card(base, p)).join('')}</div>`) +
            `<div class="ctas"><a class="btn m" href="/#catalogo">Hacer un pedido</a></div>` });
      }
    } else { status = 400; html = 'Bad request'; }
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.end(html);
  } catch (e) {
    res.statusCode = 302; res.setHeader('Location', '/#catalogo'); res.end();
  }
};
