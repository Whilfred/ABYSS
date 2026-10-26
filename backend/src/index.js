require('dotenv').config();
require('express-async-errors');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { verify } = require('./auth');

// --- AJOUT FICHIERS ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET manquant (.env)'); process.exit(1); }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

// --- AJOUT FICHIERS ---
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); 

io.use((socket, next) => {
  try { socket.userId = verify(socket.handshake.auth?.token); next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => socket.join('user:' + socket.userId));

app.use(helmet({ crossOriginResourcePolicy: false })); 
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use('/uploads', express.static(uploadDir));

app.post('/api/upload', upload.single('fichier'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  res.json({ 
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype
  });
});

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/chats'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/moderation', require('./routes/moderation')); // <--- AJOUT ICI
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
