# ABYSS — messagerie + portefeuille interne (FCFA)

Stack : React Native (Expo) · Node.js (Express + Socket.io) · PostgreSQL

## 1. Backend
```bash
cd backend
docker compose up -d          # PostgreSQL (ou utilisez votre propre Postgres)
cp .env.example .env          # changez JWT_SECRET
npm install
npm run migrate               # crée les tables
npm run dev                   # API sur http://localhost:4000
```

## 2. Mobile
```bash
cd mobile
# éditez src/config.js : SERVER_URL = IP locale de votre PC (ex: http://192.168.1.20:4000)
npm install
npx expo install --fix        # aligne les versions Expo si besoin
npx expo start                # scannez le QR code avec Expo Go
```

## Inclus
- Inscription / connexion (nom d'utilisateur ou téléphone) — 6 pays : BJ, TG, CI, NE, BF, SN
- Discussions privées + groupes, temps réel (Socket.io), non-lus, confirmations de lecture (✓ / ✓✓)
- Portefeuille interne FCFA : solde, historique, PIN 4 chiffres (blocage 15 min après 5 erreurs)
- Envoi / demande d'argent directement dans la conversation, reçu avec référence
- Dépôt et retrait Mobile Money par pays/opérateur (retrait : frais configurables `WITHDRAW_FEE_RATE`)

## Pas encore inclus (volontairement)
Appels audio/vidéo, messages vocaux, photos/vidéos/documents, notifications push.

## Avant la production
- Brancher un agrégateur de paiement agréé dans `backend/src/services/payments.js` (mode `sandbox` = simulé)
- Dépôts réels = asynchrones (webhook) ; ajouter KYC / plafonds / anti-fraude
- Vérifier la conformité réglementaire monnaie électronique (BCEAO / UEMOA) ou passer par un partenaire agréé
- HTTPS obligatoire, `JWT_SECRET` fort, sauvegardes Postgres
