const r = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../auth');
const { COUNTRIES } = require('../countries');
const { AppError, ref, parseAmount, verifyPin, lockWallets, transfer } = require('../services/wallet');
const { createMessage, getMessage, broadcast } = require('../services/chat');
const payments = require('../services/payments');
r.use(requireAuth);

const feeRate = () => Number(process.env.WITHDRAW_FEE_RATE || 0.01);
const ping = (io, ...ids) => ids.forEach((id) => io.to('user:' + id).emit('wallet:update'));

async function tx(fn) {
  const client = await db.connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

r.get('/countries', (req, res) => res.json({ countries: Object.values(COUNTRIES), withdraw_fee_rate: feeRate() }));

r.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT balance,currency FROM wallets WHERE user_id=$1', [req.userId]);
  res.json({ balance: Number(rows[0].balance), currency: rows[0].currency });
});

r.get('/transactions', async (req, res) => {
  const { rows } = await db.query(
    `SELECT t.id,t.reference,t.type,t.amount,t.fee,t.status,t.provider,t.country,t.note,t.created_at,
       t.from_user,t.to_user, fu.display_name AS from_name, fu.username AS from_username,
       tu.display_name AS to_name, tu.username AS to_username
     FROM transactions t
     LEFT JOIN users fu ON fu.id=t.from_user LEFT JOIN users tu ON tu.id=t.to_user
     WHERE t.from_user=$1 OR t.to_user=$1 ORDER BY t.created_at DESC LIMIT 100`, [req.userId]);
  res.json(rows);
});

r.post('/pin', async (req, res) => {
  const { pin, current_pin } = req.body || {};
  if (!/^\d{4}$/.test(String(pin))) throw new AppError('Le PIN doit contenir 4 chiffres');
  const { rows } = await db.query('SELECT pin_hash FROM users WHERE id=$1', [req.userId]);
  if (rows[0].pin_hash) await verifyPin(req.userId, current_pin);
  await db.query('UPDATE users SET pin_hash=$2, pin_attempts=0, pin_locked_until=NULL WHERE id=$1', [req.userId, await bcrypt.hash(String(pin), 10)]);
  res.json({ ok: true });
});

// Dépôt via partenaire (sandbox = crédit immédiat simulé)
r.post('/deposit', async (req, res) => {
  const { country, provider, phone } = req.body || {};
  const amount = parseAmount(req.body?.amount, { min: 500, max: 2000000 });
  const c = COUNTRIES[country];
  if (!c || !c.providers.includes(provider)) throw new AppError('Pays ou opérateur invalide');
  const p = await payments.collect({ country, provider, phone, amount });
  if (!p.ok) throw new AppError('Le paiement a échoué', 402);
  const t = await tx(async (cl) => {
    await lockWallets(cl, [req.userId]);
    await cl.query('UPDATE wallets SET balance=balance+$2, updated_at=now() WHERE user_id=$1', [req.userId, amount]);
    return (await cl.query(
      `INSERT INTO transactions(reference,type,to_user,amount,country,provider,phone) VALUES($1,'deposit',$2,$3,$4,$5,$6) RETURNING *`,
      [ref(), req.userId, amount, country, provider, phone])).rows[0];
  });
  ping(req.app.get('io'), req.userId);
  res.json({ transaction: t });
});

// Retrait hors plateforme vers Mobile Money du pays choisi
r.post('/withdraw', async (req, res) => {
  const { country, provider, phone, pin } = req.body || {};
  const amount = parseAmount(req.body?.amount, { min: 500, max: 1000000 });
  const c = COUNTRIES[country];
  if (!c || !c.providers.includes(provider)) throw new AppError('Pays ou opérateur invalide');
  if (!String(phone || '').startsWith(c.dial)) throw new AppError(`Le numéro doit commencer par ${c.dial}`);
  await verifyPin(req.userId, pin);
  const fee = Math.ceil(amount * feeRate());
  const t = await tx(async (cl) => {
    const bal = await lockWallets(cl, [req.userId]);
    if (bal[req.userId] < amount + fee) throw new AppError(`Solde insuffisant (frais : ${fee} FCFA)`);
    await cl.query('UPDATE wallets SET balance=balance-$2, updated_at=now() WHERE user_id=$1', [req.userId, amount + fee]);
    return (await cl.query(
      `INSERT INTO transactions(reference,type,from_user,amount,fee,status,country,provider,phone) VALUES($1,'withdraw',$2,$3,$4,'pending',$5,$6,$7) RETURNING *`,
      [ref(), req.userId, amount, fee, country, provider, phone])).rows[0];
  });
  let ok = false;
  try { ok = (await payments.payout({ country, provider, phone, amount })).ok; } catch (e) { console.error('payout', e.message); }
  if (ok) {
    await db.query(`UPDATE transactions SET status='success' WHERE id=$1`, [t.id]);
  } else {
    await tx(async (cl) => { // remboursement automatique
      await lockWallets(cl, [req.userId]);
      await cl.query('UPDATE wallets SET balance=balance+$2 WHERE user_id=$1', [req.userId, amount + fee]);
      await cl.query(`UPDATE transactions SET status='failed' WHERE id=$1`, [t.id]);
    });
  }
  ping(req.app.get('io'), req.userId);
  if (!ok) throw new AppError('Le retrait a échoué, votre solde a été restauré.', 502);
  res.json({ transaction: { ...t, status: 'success' } });
});

async function assertDirect(client, conversationId, a, b) {
  const { rows } = await client.query(
    `SELECT c.id FROM conversations c WHERE c.id=$1 AND c.type='direct'
     AND (SELECT count(*) FROM conversation_members WHERE conversation_id=c.id AND user_id IN ($2,$3))=2`, [conversationId, a, b]);
  if (!rows[0]) throw new AppError('Conversation invalide', 403);
}

// Envoi d'argent entre utilisateurs (dans une conversation ou par identifiant)
r.post('/transfer', async (req, res) => {
  const { to_username, pin, note, conversationId } = req.body || {};
  const amount = parseAmount(req.body?.amount);
  const to = (await db.query('SELECT id,username,display_name FROM users WHERE username=$1', [String(to_username || '').toLowerCase()])).rows[0];
  if (!to) throw new AppError('Destinataire introuvable', 404);
  await verifyPin(req.userId, pin);
  let msg = null;
  const t = await tx(async (cl) => {
    if (conversationId) await assertDirect(cl, conversationId, req.userId, to.id);
    const t = await transfer(cl, { fromId: req.userId, toId: to.id, amount, note });
    if (conversationId)
      msg = await createMessage(cl, { conversationId, senderId: req.userId, type: 'money', body: note || null,
        meta: { amount, reference: t.reference, transaction_id: t.id, status: 'success' } });
    return t;
  });
  const io = req.app.get('io');
  if (msg) await broadcast(io, conversationId, 'message:new', msg);
  ping(io, req.userId, to.id);
  res.json({ transaction: t, message: msg });
});

// Demande d'argent
r.post('/requests', async (req, res) => {
  const { conversationId, note } = req.body || {};
  const amount = parseAmount(req.body?.amount);
  const peer = (await db.query(
    `SELECT cm.user_id FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
     WHERE c.id=$1 AND c.type='direct' AND cm.user_id<>$2
     AND EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=c.id AND user_id=$2)`, [conversationId, req.userId])).rows[0];
  if (!peer) throw new AppError('Conversation invalide', 403);
  const msg = await tx(async (cl) => {
    const rq = (await cl.query(
      `INSERT INTO money_requests(requester_id,payer_id,conversation_id,amount,note) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [req.userId, peer.user_id, conversationId, amount, note || null])).rows[0];
    const m = await createMessage(cl, { conversationId, senderId: req.userId, type: 'money_request', body: note || null,
      meta: { amount, request_id: rq.id, status: 'pending', payer_id: peer.user_id } });
    await cl.query('UPDATE money_requests SET message_id=$2 WHERE id=$1', [rq.id, m.id]);
    return m;
  });
  await broadcast(req.app.get('io'), conversationId, 'message:new', msg);
  res.json(msg);
});

async function resolveRequest(req, status, pay) {
  const { id } = req.params;
  if (pay) await verifyPin(req.userId, req.body?.pin);
  const out = { updated: null, moneyMsg: null, convId: null, ids: [] };
  await tx(async (cl) => {
    const rq = (await cl.query('SELECT * FROM money_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!rq || rq.payer_id !== req.userId) throw new AppError('Demande introuvable', 404);
    if (rq.status !== 'pending') throw new AppError('Demande déjà traitée');
    if (pay) {
      const t = await transfer(cl, { fromId: rq.payer_id, toId: rq.requester_id, amount: Number(rq.amount), note: rq.note });
      out.moneyMsg = await createMessage(cl, { conversationId: rq.conversation_id, senderId: rq.payer_id, type: 'money',
        body: rq.note, meta: { amount: Number(rq.amount), reference: t.reference, transaction_id: t.id, status: 'success' } });
    }
    await cl.query('UPDATE money_requests SET status=$2, resolved_at=now() WHERE id=$1', [id, status]);
    await cl.query(`UPDATE messages SET meta = meta || jsonb_build_object('status',$2::text) WHERE id=$1`, [rq.message_id, status]);
    out.updated = await getMessage(cl, rq.message_id);
    out.convId = rq.conversation_id; out.ids = [rq.payer_id, rq.requester_id];
  });
  const io = req.app.get('io');
  await broadcast(io, out.convId, 'message:update', out.updated);
  if (out.moneyMsg) await broadcast(io, out.convId, 'message:new', out.moneyMsg);
  if (pay) ping(io, ...out.ids);
  return out.updated;
}
r.post('/requests/:id/pay', async (req, res) => res.json(await resolveRequest(req, 'paid', true)));
r.post('/requests/:id/decline', async (req, res) => res.json(await resolveRequest(req, 'declined', false)));

module.exports = r;
