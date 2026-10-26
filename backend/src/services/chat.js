const db = require('../db');

const JOIN = 'JOIN users u ON u.id=m.sender_id';
const COLS = 'm.*, u.display_name AS sender_name, u.username AS sender_username';

async function createMessage(q, { conversationId, senderId, type = 'text', body = null, meta = null }) {
  const { rows } = await q.query(
    `WITH m AS (INSERT INTO messages(conversation_id,sender_id,type,body,meta) VALUES($1,$2,$3,$4,$5) RETURNING *)
     SELECT ${COLS} FROM m ${JOIN}`,
    [conversationId, senderId, type, body, meta ? JSON.stringify(meta) : null]);
  return rows[0];
}
async function getMessage(q, id) {
  const { rows } = await q.query(`SELECT ${COLS} FROM messages m ${JOIN} WHERE m.id=$1`, [id]);
  return rows[0];
}
async function memberIds(conversationId) {
  const { rows } = await db.query('SELECT user_id FROM conversation_members WHERE conversation_id=$1', [conversationId]);
  return rows.map((r) => r.user_id);
}
async function isMember(q, conversationId, userId) {
  const { rowCount } = await q.query('SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [conversationId, userId]);
  return rowCount > 0;
}
async function broadcast(io, conversationId, event, payload) {
  (await memberIds(conversationId)).forEach((id) => io.to('user:' + id).emit(event, payload));
}
module.exports = { createMessage, getMessage, memberIds, isMember, broadcast };
