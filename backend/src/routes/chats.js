const r = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { AppError } = require('../services/wallet');
const { createMessage, broadcast, isMember } = require('../services/chat');
r.use(requireAuth);

r.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.type, c.name,
       (SELECT json_build_object('id',u.id,'username',u.username,'display_name',u.display_name)
          FROM conversation_members x JOIN users u ON u.id=x.user_id
          WHERE x.conversation_id=c.id AND x.user_id<>$1 LIMIT 1) AS peer,
       lm.body, lm.type AS last_type, lm.created_at AS last_at, lm.meta AS last_meta,
       (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.created_at>cm.last_read_at) AS unread
     FROM conversation_members cm
     JOIN conversations c ON c.id=cm.conversation_id
     LEFT JOIN LATERAL (SELECT body,type,meta,created_at FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) lm ON true
     WHERE cm.user_id=$1
     ORDER BY COALESCE(lm.created_at,c.created_at) DESC`, [req.userId]);
  res.json(rows);
});

r.post('/direct', async (req, res) => {
  const username = String(req.body?.username || '').toLowerCase();
  const peer = (await db.query('SELECT id,username,display_name FROM users WHERE username=$1', [username])).rows[0];
  if (!peer) throw new AppError('Utilisateur introuvable', 404);
  if (peer.id === req.userId) throw new AppError('Conversation impossible avec vous-même');
  const key = [req.userId, peer.id].sort().join(':');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let c = (await client.query('SELECT id FROM conversations WHERE direct_key=$1', [key])).rows[0];
    if (!c) {
      c = (await client.query(
        `INSERT INTO conversations(type,direct_key,created_by) VALUES('direct',$1,$2)
         ON CONFLICT(direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING id`, [key, req.userId])).rows[0];
      await client.query('INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING',
        [c.id, req.userId, peer.id]);
    }
    await client.query('COMMIT');
    res.json({ id: c.id, type: 'direct', peer });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

r.post('/group', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const usernames = (req.body?.usernames || []).map((u) => String(u).toLowerCase());
  if (name.length < 2) throw new AppError('Nom du groupe trop court');
  if (!usernames.length) throw new AppError('Ajoutez au moins un membre');
  const users = (await db.query('SELECT id FROM users WHERE username=ANY($1::text[])', [usernames])).rows;
  const ids = [...new Set([req.userId, ...users.map((u) => u.id)])];
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const c = (await client.query(`INSERT INTO conversations(type,name,created_by) VALUES('group',$1,$2) RETURNING id`, [name, req.userId])).rows[0];
    await client.query('INSERT INTO conversation_members(conversation_id,user_id) SELECT $1, unnest($2::uuid[])', [c.id, ids]);
    await client.query('COMMIT');
    res.json({ id: c.id, type: 'group', name });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

r.get('/:id/messages', async (req, res) => {
  const { id } = req.params;
  if (!(await isMember(db, id, req.userId))) throw new AppError('Accès refusé', 403);
  const before = req.query.before ? new Date(req.query.before) : new Date(Date.now() + 1000);
  const { rows: messages } = await db.query(
    `SELECT m.*, u.display_name AS sender_name, u.username AS sender_username
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=$1 AND m.created_at<$2 ORDER BY m.created_at DESC LIMIT 50`, [id, before]);
  await db.query('UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2', [id, req.userId]);
  const { rows: reads } = await db.query('SELECT user_id,last_read_at FROM conversation_members WHERE conversation_id=$1', [id]);
  broadcast(req.app.get('io'), id, 'conversation:read', { conversation_id: id, user_id: req.userId, at: new Date() }).catch(() => {});
  res.json({ messages, reads });
});

r.post('/:id/read', async (req, res) => {
  const { id } = req.params;
  if (!(await isMember(db, id, req.userId))) throw new AppError('Accès refusé', 403);
  await db.query('UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2', [id, req.userId]);
  await broadcast(req.app.get('io'), id, 'conversation:read', { conversation_id: id, user_id: req.userId, at: new Date() });
  res.json({ ok: true });
});

r.post('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > 4000) throw new AppError('Message invalide');
  if (!(await isMember(db, id, req.userId))) throw new AppError('Accès refusé', 403);
  const msg = await createMessage(db, { conversationId: id, senderId: req.userId, body });
  await broadcast(req.app.get('io'), id, 'message:new', msg);
  res.json(msg);
});

module.exports = r;
