const r = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
r.use(requireAuth);

// 1. Recherche d'utilisateurs
r.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (q.length < 2) return res.json([]);
  const { rows } = await db.query(
    `SELECT id,username,display_name FROM users WHERE username LIKE $1 AND id<>$2 ORDER BY username LIMIT 20`,
    [q + '%', req.userId]);
  res.json(rows);
});

// 2. Mettre à jour la photo de profil
r.post('/avatar', async (req, res) => {
  const { avatar_url } = req.body;
  if (!avatar_url) return res.status(400).json({ error: 'URL manquante' });
  
  await db.query('UPDATE users SET avatar_url=$1 WHERE id=$2', [avatar_url, req.userId]);
  res.json({ ok: true, avatar_url });
});

// 3. Enregistrer le token push (DOIT ÊTRE AVANT /:username)
r.post('/push-token', async (req, res) => {
  const { token, platform } = req.body;
  if (!token) return res.status(400).json({ error: 'Token manquant' });

  await db.query(
    `INSERT INTO push_tokens (user_id, token, platform) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [req.userId, token, platform || 'android']
  );
  res.json({ ok: true });
});

r.get('/:username', async (req, res) => {
  const username = String(req.params.username || '').toLowerCase();
  const { rows } = await db.query(
    'SELECT id, username, display_name, country, phone, avatar_url, last_seen FROM users WHERE username=$1',
    [username]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(rows[0]);
});

module.exports = r;
