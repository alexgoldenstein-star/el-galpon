// Qué servicios del servidor están configurados (sin exponer claves).
const { hasAdmin, hasWA, hasMP, send } = require('./_lib');
module.exports = (req, res) => send(res, 200, { admin: hasAdmin(), wa: hasWA(), mp: hasMP() });
