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

// --- AJOUT : Récupérer un utilisateur par son username ---
r.get('/:username', async (req, res) => {
  const username = String(req.params.username || '').toLowerCase();
  const { rows } = await db.query(
    'SELECT id, username, display_name, country, phone, avatar_url FROM users WHERE username=$1',
    [username]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(rows[0]);
});

// --- AJOUT : Mettre à jour la photo de profil ---
r.post('/avatar', async (req, res) => {
  const { avatar_url } = req.body;
  if (!avatar_url) return res.status(400).json({ error: 'URL manquante' });
  
  await db.query('UPDATE users SET avatar_url=$1 WHERE id=$2', [avatar_url, req.userId]);
  res.json({ ok: true, avatar_url });
});

module.exports = r;
