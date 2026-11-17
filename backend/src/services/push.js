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
  console.log(`[PUSH] >>> Tentative d'envoi à l'utilisateur ${userId} : "${title}" - "${body}"`); // LOG
  
  try {
    const expo = await getExpoClient();
    
    // 1. Récupérer les tokens de l'utilisateur
    const { rows } = await db.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    
    console.log(`[PUSH] >>> ${rows.length} token(s) trouvé(s) en base pour ${userId}`); // LOG
    
    if (rows.length === 0) return;

    const messages = [];
    for (const row of rows) {
      if (!expo.isExpoPushToken(row.token)) {
        console.error(`[PUSH] >>> Token INVALIDE : ${row.token}`); // LOG
        continue;
      }
      messages.push({
        to: row.token,
        sound: 'default',
        title,
        body,
        data,
      });
      console.log(`[PUSH] >>> Token ajouté au message : ${row.token}`); // LOG
    }

    // 2. Envoyer par lots
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      console.log(`[PUSH] >>> Envoi d'un lot de ${chunk.length} notification(s)...`); // LOG
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log(`[PUSH] >>> Réponse d'Expo :`, JSON.stringify(tickets)); // LOG
    }
    
    console.log(`[PUSH] >>> Fin de l'envoi pour ${userId}`); // LOG
  } catch (error) {
    console.error(`[PUSH] >>> ERREUR CRITIQUE pour ${userId}:`, error); // LOG
  }
}

module.exports = { sendPushToUser };
