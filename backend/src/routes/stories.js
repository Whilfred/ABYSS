const r = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { AppError } = require('../services/wallet');
const { createMessage, broadcast } = require('../services/chat');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

r.use(requireAuth);

// Configuration Multer (Mémoire)
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 100 * 1024 * 1024 } // 100 Mo
});

// 1. Créer une story (avec upload Cloudinary)
r.post('/', upload.single('media'), async (req, res) => {
  // --- LOG DE VÉRIFICATION ---
  console.log('FICHIER REÇU:', req.file ? `${req.file.size} octets, type: ${req.file.mimetype}` : 'AUCUN FICHIER');
  
  if (!req.file) throw new AppError('Fichier manquant');
  
  try {
    // On envoie le fichier à Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'abyss_stories' }, 
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    const mediaUrl = result.secure_url;
    
    const { rows } = await db.query(
      'INSERT INTO stories(user_id, media_url, media_type) VALUES($1, $2, $3) RETURNING *',
      [req.userId, mediaUrl, mediaType]
    );
    
    res.json(rows[0]);
  } catch (error) {
    // --- LOG D'ERREUR DÉTAILLÉ ---
    console.error('ERREUR CLOUDINARY DÉTAIL:', error);
    throw new AppError("Erreur lors de l'upload de la story");
  }
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

  await db.query(
    `INSERT INTO story_reactions(story_id, user_id, emoji) VALUES($1, $2, $3)
     ON CONFLICT (story_id, user_id) DO UPDATE SET emoji=EXCLUDED.emoji, created_at=now()`,
    [id, req.userId, emoji]
  );

  const story = (await db.query('SELECT user_id FROM stories WHERE id=$1', [id])).rows[0];
  
  if (story) {
    const io = req.app.get('io');
    const user = (await db.query('SELECT username, display_name FROM users WHERE id=$1', [req.userId])).rows[0];
    
    io.to('user:' + story.user_id).emit('story:reaction', {
      story_id: id,
      emoji,
      user: { username: user.username, display_name: user.display_name }
    });

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

    const msg = await createMessage(db, {
      conversationId: conv.id,
      senderId: req.userId,
      body: `${emoji} a réagi à votre story`,
      type: 'text',
      meta: { story_id: id, action: 'story_reaction', emoji }
    });

    await broadcast(io, conv.id, 'message:new', msg);
  }

  res.json({ ok: true });
});

module.exports = r;
