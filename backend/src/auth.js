const jwt = require('jsonwebtoken');
exports.sign = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET, { expiresIn: '30d' });
exports.verify = (t) => jwt.verify(t, process.env.JWT_SECRET).sub;
exports.requireAuth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'Non authentifié' });
  try { req.userId = exports.verify(t); next(); }
  catch { res.status(401).json({ error: 'Session expirée' }); }
};
