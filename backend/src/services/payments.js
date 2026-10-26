// Adaptateur partenaires de paiement (dépôts / retraits hors plateforme).
// En production, branchez ici un agrégateur agréé (CinetPay, PayDunya, Flutterwave, etc.)
// Les dépôts réels sont asynchrones : créez la transaction en 'pending' puis créditez via webhook.
async function collect({ country, provider, phone, amount }) {
  if (process.env.PAYMENT_MODE === 'sandbox') return { ok: true, providerRef: 'SBX-' + Date.now() };
  throw new Error('Aucun fournisseur de paiement configuré');
}
async function payout({ country, provider, phone, amount }) {
  if (process.env.PAYMENT_MODE === 'sandbox') return { ok: true, providerRef: 'SBX-' + Date.now() };
  throw new Error('Aucun fournisseur de paiement configuré');
}
module.exports = { collect, payout };
