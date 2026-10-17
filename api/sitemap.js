// Mapa del sitio para Google: inicio, catálogo, cómo trabajamos, rubros y cada producto.
const { getDoc, listProducts, slug } = require('./_public');
module.exports = async (req, res) => {
  const base = String(process.env.SITE_URL || 'https://' + req.headers.host).replace(/\/$/, '');
  try {
    const [site, prods] = await Promise.all([getDoc('site/main'), listProducts()]);
    const urls = [base + '/'].concat((site && site.categories || []).map((c) => base + '/c/' + slug(c)), prods.filter((p) => p.stock !== 'out').map((p) => base + '/p/' + p.id));
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => '  <url><loc>' + u.replace(/&/g, '&amp;') + '</loc></url>').join('\n') + '\n</urlset>\n';
    res.statusCode = 200; res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=3600'); res.end(xml);
  } catch (e) { res.statusCode = 500; res.end(''); }
};
