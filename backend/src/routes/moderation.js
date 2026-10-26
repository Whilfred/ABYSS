const r = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { AppError } = require('../services/wallet');

r.use(requireAuth);

// Bloquer un utilisateur
r.post('/block', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id || user_id === req.userId) throw new AppError('Utilisateur invalide');
  
  await db.query(
    'INSERT INTO blocked_users(blocker_id, blocked_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
    [req.userId, user_id]
  );
  res.json({ ok: true, message: 'Utilisateur bloqué' });
});

// Débloquer un utilisateur
r.post('/unblock', async (req, res) => {
  const { user_id } = req.body;
  await db.query('DELETE FROM blocked_users WHERE blocker_id=$1 AND blocked_id=$2', [req.userId, user_id]);
  res.json({ ok: true, message: 'Utilisateur débloqué' });
});

// Vérifier si un utilisateur est bloqué (pour l'interface)
r.get('/blocked/:user_id', async (req, res) => {
  const { rowCount } = await db.query(
    'SELECT 1 FROM blocked_users WHERE blocker_id=$1 AND blocked_id=$2',
    [req.userId, req.params.user_id]
  );
  res.json({ is_blocked: rowCount > 0 });
});

// Signaler un utilisateur
r.post('/report', async (req, res) => {
  const { user_id, reason } = req.body;
  if (!user_id || !reason) throw new AppError('Données manquantes');
  
  await db.query(
    'INSERT INTO reports(reporter_id, reported_id, reason) VALUES($1, $2, $3)',
    [req.userId, user_id, reason]
  );
  res.json({ ok: true, message: 'Signalement envoyé' });
});

module.exports = r;
