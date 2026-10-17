// Arma app.js juntando las partes de src/ en orden (00-, 05-, 10-…).
// Uso:  node scripts/bundle.js          → escribe app.js
//       node scripts/bundle.js --check  → falla si app.js no está al día (lo usa la verificación automática)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'src');
const files = fs.readdirSync(dir).filter((f) => /^\d+-.*\.js$/.test(f)).sort();
const out = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
const target = path.join(root, 'app.js');
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (cur !== out) { console.error('app.js no está al día: corré  node scripts/bundle.js'); process.exit(1); }
  console.log('app.js al día (' + files.length + ' partes).');
} else {
  new Function(out); // si hay un error de sintaxis, frena antes de escribir
  fs.writeFileSync(target, out);
  console.log('app.js armado con ' + files.length + ' partes, ' + out.split('\n').length + ' líneas.');
}
