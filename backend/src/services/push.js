const expoServerSdk = require('expo-server-sdk');
const { Expo } = expoServerSdk;
const db = require('../db');

const expo = new Expo();


async function sendPushToUser(userId, title, body, data = {}) {
  try {
    // 1. Récupérer les tokens de l'utilisateur
    const { rows } = await db.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    if (rows.length === 0) return;

    const messages = [];
    for (const row of rows) {
      if (!Expo.isExpoPushToken(row.token)) {
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

    // 2. Envoyer par lots (Expo gère les batchs)
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error('Erreur envoi push:', error);
  }
}

module.exports = { sendPushToUser };
