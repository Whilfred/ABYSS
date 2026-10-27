const r = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { AppError } = require('../services/wallet');
const { createMessage, broadcast } = require('../services/chat'); // <-- IMPORT
const multer = require('multer');
const path = require('path');
const fs = require('fs');

r.use(requireAuth);

// Configuration de Multer pour les stories
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'story-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// 1. Créer une story
r.post('/', upload.single('media'), async (req, res) => {
  if (!req.file) throw new AppError('Fichier manquant');
  
  const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
  const mediaUrl = `/uploads/${req.file.filename}`;
  
  const { rows } = await db.query(
    'INSERT INTO stories(user_id, media_url, media_type) VALUES($1, $2, $3) RETURNING *',
    [req.userId, mediaUrl, mediaType]
  );
  
  res.json(rows[0]);
});

// 2. Récupérer les stories
r.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, u.username, u.display_name, u.avatar_url 
     FROM stories s 
     JOIN users u ON u.id = s.user_id 
     WHERE s.expires_at > now() 
     ORDER BY s.created_at DESC`
  );
  res.json(rows);
});

// 3. Supprimer sa propre story
r.delete('/:id', async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM stories WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (rowCount === 0) throw new AppError('Story introuvable ou non autorisée', 404);
  res.json({ ok: true });
});

// 4. Marquer une story comme vue
r.post('/:id/view', async (req, res) => {
  const { id } = req.params;
  await db.query(
    'INSERT INTO story_views(story_id, viewer_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
    [id, req.userId]
  );
  res.json({ ok: true });
});

// 5. Récupérer les vues d'une story (pour l'auteur)
r.get('/:id/views', async (req, res) => {
  const { id } = req.params;
  const story = (await db.query('SELECT user_id FROM stories WHERE id=$1', [id])).rows[0];
  if (!story || story.user_id !== req.userId) return res.status(403).json({ error: 'Non autorisé' });

  const { rows } = await db.query(
    `SELECT v.viewed_at, u.username, u.display_name, u.avatar_url 
     FROM story_views v JOIN users u ON u.id = v.viewer_id 
     WHERE v.story_id=$1 ORDER BY v.viewed_at DESC`,
    [id]
  );
  res.json(rows);
});

// 6. Réagir à une story (avec notification Socket.io et création de message)
r.post('/:id/react', async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji manquant' });

  // 1. Sauvegarder la réaction
  await db.query(
    `INSERT INTO story_reactions(story_id, user_id, emoji) VALUES($1, $2, $3)
     ON CONFLICT (story_id, user_id) DO UPDATE SET emoji=EXCLUDED.emoji, created_at=now()`,
    [id, req.userId, emoji]
  );

  // 2. Trouver le propriétaire de la story
  const story = (await db.query('SELECT user_id FROM stories WHERE id=$1', [id])).rows[0];
  
  if (story) {
    const io = req.app.get('io');
    const user = (await db.query('SELECT username, display_name FROM users WHERE id=$1', [req.userId])).rows[0];
    
    // 3. Envoyer l'événement Socket.io au propriétaire (pour l'animation)
    io.to('user:' + story.user_id).emit('story:reaction', {
      story_id: id,
      emoji,
      user: { username: user.username, display_name: user.display_name }
    });

    // 4. Créer ou récupérer la conversation directe
    const key = [req.userId, story.user_id].sort().join(':');
    let conv = (await db.query('SELECT id FROM conversations WHERE direct_key=$1', [key])).rows[0];
    
    if (!conv) {
      conv = (await db.query(
        `INSERT INTO conversations(type,direct_key,created_by) VALUES('direct',$1,$2)
         ON CONFLICT(direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING id`, 
        [key, req.userId]
      )).rows[0];
      await db.query('INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING',
        [conv.id, req.userId, story.user_id]);
    }

    // 5. Créer un message spécial dans la conversation
    const msg = await createMessage(db, {
      conversationId: conv.id,
      senderId: req.userId,
      body: `${emoji} a réagi à votre story`,
      type: 'text', // On garde 'text' pour l'instant
      meta: { story_id: id, action: 'story_reaction', emoji }
    });

    // 6. Envoyer le message en temps réel à l'auteur
    await broadcast(io, conv.id, 'message:new', msg);
  }

  res.json({ ok: true });
});

module.exports = r;
