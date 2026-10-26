const r = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../auth');
const { COUNTRIES } = require('../countries');
const { AppError } = require('../services/wallet');

const pub = (u) => ({ id: u.id, username: u.username, display_name: u.display_name, phone: u.phone, country: u.country, has_pin: !!u.pin_hash });

r.post('/register', async (req, res) => {
  let { display_name, username, phone, country, password } = req.body || {};
  username = String(username || '').trim().toLowerCase();
  display_name = String(display_name || '').trim();
  phone = String(phone || '').replace(/[\s-]/g, '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new AppError("Nom d'utilisateur invalide (3-20 caractères : a-z, 0-9, _)");
  if (display_name.length < 2) throw new AppError('Nom trop court');
  if (!COUNTRIES[country]) throw new AppError('Pays non supporté');
  if (!/^\+\d{8,15}$/.test(phone)) throw new AppError('Numéro de téléphone invalide');
  if (String(password || '').length < 6) throw new AppError('Mot de passe : 6 caractères minimum');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      'INSERT INTO users(username,display_name,phone,country,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [username, display_name, phone, country, hash]);
    await client.query('INSERT INTO wallets(user_id) VALUES($1)', [rows[0].id]);
    await client.query('COMMIT');
    res.json({ token: sign(rows[0].id), user: pub(rows[0]) });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw new AppError("Nom d'utilisateur ou téléphone déjà utilisé", 409);
    throw e;
  } finally { client.release(); }
});

r.post('/login', async (req, res) => {
  const id = String(req.body?.identifier || '').trim().toLowerCase().replace(/\s/g, '');
  const { rows } = await db.query('SELECT * FROM users WHERE username=$1 OR phone=$1', [id]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.password_hash)))
    throw new AppError('Identifiants incorrects', 401);
  res.json({ token: sign(u.id), user: pub(u) });
});

r.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.userId]);
  if (!rows[0]) throw new AppError('Utilisateur introuvable', 404);
  res.json({ user: pub(rows[0]) });
});

module.exports = r;
