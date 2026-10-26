require('dotenv').config();
require('express-async-errors');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { verify } = require('./auth');

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET manquant (.env)'); process.exit(1); }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.use((socket, next) => {
  try { socket.userId = verify(socket.handshake.auth?.token); next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => socket.join('user:' + socket.userId));

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/chats'));
app.use('/api/wallet', require('./routes/wallet'));
app.get('/health', (_, res) => res.json({ ok: true, app: 'ABYSS' }));

app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`ABYSS API sur :${port}`));
