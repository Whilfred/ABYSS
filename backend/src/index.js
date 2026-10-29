require('dotenv').config();
require('express-async-errors');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { verify } = require('./auth');
const db = require('./db');
const multer = require('multer');
const cloudinary = require('cloudinary').v2; // <-- IMPORT CLOUDINARY

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET manquant (.env)'); process.exit(1); }

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

// --- CONFIGURATION MULTER (MÉMOIRE) ---
// On garde le fichier en mémoire (buffer) pour l'envoyer à Cloudinary
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 100 * 1024 * 1024 } // 100 Mo
}); 

// --- GESTION DE LA PRESENCE ---
const connectedUsers = new Map(); 

io.use((socket, next) => {
  try { socket.userId = verify(socket.handshake.auth?.token); next(); }
  catch { next(new Error('unauthorized')); }
});

io.on('connection', async (socket) => {
  const userId = socket.userId;
  socket.join('user:' + userId);

  const count = connectedUsers.get(userId) || 0;
  connectedUsers.set(userId, count + 1);

  if (count === 0) {
    await db.query('UPDATE users SET last_seen = NULL WHERE id = $1', [userId]);
    io.emit('user:presence', { user_id: userId, online: true, last_seen: null });
  }

  socket.on('disconnect', async () => {
    const currentCount = connectedUsers.get(userId) || 1;
    const newCount = currentCount - 1;
    
    if (newCount <= 0) {
      connectedUsers.delete(userId);
      const now = new Date();
      await db.query('UPDATE users SET last_seen = $1 WHERE id = $2', [now, userId]);
      io.emit('user:presence', { user_id: userId, online: false, last_seen: now });
    } else {
      connectedUsers.set(userId, newCount);
    }
  });
});

app.use(helmet({ crossOriginResourcePolicy: false })); 
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Route d'upload vers Cloudinary
app.post('/api/upload', upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  try {
    // On envoie le fichier (buffer) à Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'abyss' }, // 'auto' gère images et vidéos
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // On renvoie l'URL sécurisée fournie par Cloudinary
    res.json({ 
      url: result.secure_url,
      name: req.file.originalname,
      type: req.file.mimetype
    });
  } catch (error) {
    console.error('Erreur Cloudinary:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload vers Cloudinary' });
  }
});

app.use('/api/stories', require('./routes/stories'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/chats'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/moderation', require('./routes/moderation'));
app.get('/health', (_, res) => res.json({ ok: true, app: 'ABYSS' }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 100 Mo)' });
    }
    return res.status(400).json({ error: 'Erreur lors de l\'envoi du fichier' });
  }
  
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`ABYSS API sur :${port}`));
