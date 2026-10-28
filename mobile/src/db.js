import * as SQLite from 'expo-sqlite';

// On ouvre la base de données locale
export const db = SQLite.openDatabaseSync('abyss_offline.db');

// 1. Initialiser les tables au démarrage
export const initDB = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        sender_id TEXT,
        sender_name TEXT,
        sender_avatar TEXT,
        type TEXT,
        body TEXT,
        file_url TEXT,
        file_name TEXT,
        meta TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        avatar_url TEXT,
        last_message TEXT,
        last_at TEXT
      );
    `);
    console.log('Base locale prête');
  } catch (e) {
    console.error('Erreur init DB locale', e);
  }
};

// 2. Sauvegarder une liste de messages (reçus du serveur ou envoyés)
export const saveMessagesToLocal = (messages) => {
  messages.forEach((m) => {
    db.runSync(
      `INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, sender_name, sender_avatar, type, body, file_url, file_name, meta, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id, m.conversation_id, m.sender_id, m.sender_name, m.sender_avatar, 
        m.type, m.body, m.file_url, m.file_name, m.meta ? JSON.stringify(m.meta) : null, m.created_at
      ]
    );
  });
};

// 3. Lire les messages d'une conversation depuis le téléphone
export const getLocalMessages = (conversationId) => {
  const rows = db.getAllSync(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC`,
    [conversationId]
  );
  // On reformate les données pour qu'elles ressemblent à ce que le serveur envoie
  return rows.map(r => ({
    ...r,
    meta: r.meta ? JSON.parse(r.meta) : null
  }));
};

// 4. Sauvegarder la liste des conversations
export const saveConversationsToLocal = (conversations) => {
  db.execSync('DELETE FROM conversations'); // On nettoie et on remplace
  conversations.forEach((c) => {
    db.runSync(
      `INSERT INTO conversations (id, title, type, avatar_url, last_message, last_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.title, c.type, c.avatar_url, c.last_message, c.last_at]
    );
  });
};

// 5. Lire la liste des conversations locales
export const getLocalConversations = () => {
  return db.getAllSync('SELECT * FROM conversations ORDER BY last_at DESC');
};
