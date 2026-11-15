const db = require('../db');

// On charge le SDK de manière asynchrone (import dynamique)
let expoClient = null;

async function getExpoClient() {
  if (!expoClient) {
    const { Expo } = await import('expo-server-sdk');
    expoClient = new Expo();
  }
  return expoClient;
}

async function sendPushToUser(userId, title, body, data = {}) {
  try {
    const expo = await getExpoClient();
    
    // 1. Récupérer les tokens de l'utilisateur
    const { rows } = await db.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    if (rows.length === 0) return;

    const messages = [];
    for (const row of rows) {
      // Attention : avec l'import dynamique, on utilise expo.isExpoPushToken
      if (!expo.isExpoPushToken(row.token)) {
        console.error(`Token invalide : ${row.token}`);
        continue;
      }
      messages.push({
        to: row.token,
        sound: 'default',
        title,
        body,
        data,
      });
    }

    // 2. Envoyer par lots
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error('Erreur envoi push:', error);
  }
}

module.exports = { sendPushToUser };