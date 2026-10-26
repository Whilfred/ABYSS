const r = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
r.use(requireAuth);

r.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (q.length < 2) return res.json([]);
  const { rows } = await db.query(
    `SELECT id,username,display_name FROM users WHERE username LIKE $1 AND id<>$2 ORDER BY username LIMIT 20`,
    [q + '%', req.userId]);
  res.json(rows);
});
module.exports = r;
