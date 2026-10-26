const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

class AppError extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}
const ref = () => 'ABY-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();

function parseAmount(v, { min = 100, max = 1000000 } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new AppError(`Montant minimum : ${min} FCFA`);
  if (n > max) throw new AppError(`Montant maximum : ${max} FCFA`);
  return n;
}

// Vérifie le PIN hors transaction (pour que le compteur d'essais soit conservé).
async function verifyPin(userId, pin) {
  const { rows } = await db.query('SELECT pin_hash,pin_attempts,pin_locked_until FROM users WHERE id=$1', [userId]);
  const u = rows[0];
  if (!u || !u.pin_hash) throw new AppError("Créez d'abord votre code PIN (onglet Profil)");
  if (u.pin_locked_until && new Date(u.pin_locked_until) > new Date())
    throw new AppError('PIN bloqué temporairement. Réessayez dans quelques minutes.', 429);
  const ok = await bcrypt.compare(String(pin || ''), u.pin_hash);
  if (!ok) {
    const a = u.pin_attempts + 1;
    const lock = a >= 5;
    await db.query('UPDATE users SET pin_attempts=$2, pin_locked_until=$3 WHERE id=$1', [
      userId, lock ? 0 : a, lock ? new Date(Date.now() + 15 * 60000) : null,
    ]);
    throw new AppError(lock ? 'Trop d\'essais. PIN bloqué 15 minutes.' : 'Code PIN incorrect', 401);
  }
  if (u.pin_attempts) await db.query('UPDATE users SET pin_attempts=0, pin_locked_until=NULL WHERE id=$1', [userId]);
}

async function lockWallets(client, ids) {
  const sorted = [...new Set(ids)].sort();
  const { rows } = await client.query(
    'SELECT user_id,balance FROM wallets WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE', [sorted]);
  return Object.fromEntries(rows.map((r) => [r.user_id, Number(r.balance)]));
}

// Transfert interne atomique (à appeler dans une transaction SQL).
async function transfer(client, { fromId, toId, amount, note }) {
  if (fromId === toId) throw new AppError("Vous ne pouvez pas vous envoyer de l'argent");
  const bal = await lockWallets(client, [fromId, toId]);
  if (bal[fromId] === undefined || bal[toId] === undefined) throw new AppError('Portefeuille introuvable', 404);
  if (bal[fromId] < amount) throw new AppError('Solde insuffisant');
  await client.query('UPDATE wallets SET balance=balance-$2, updated_at=now() WHERE user_id=$1', [fromId, amount]);
  await client.query('UPDATE wallets SET balance=balance+$2, updated_at=now() WHERE user_id=$1', [toId, amount]);
  const { rows } = await client.query(
    `INSERT INTO transactions(reference,type,from_user,to_user,amount,note) VALUES($1,'transfer',$2,$3,$4,$5) RETURNING *`,
    [ref(), fromId, toId, amount, note || null]);
  return rows[0];
}

module.exports = { AppError, ref, parseAmount, verifyPin, lockWallets, transfer };
