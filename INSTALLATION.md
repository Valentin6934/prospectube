# 🚀 Guide d'installation ProspectTube

## Étape 1 — Ouvre PowerShell
Cherche "PowerShell" dans le menu démarrer Windows et ouvre-le.

## Étape 2 — Va dans le dossier du projet
```
cd C:\Users\TonNom\Downloads\prospectube
```
(adapte le chemin selon où tu as mis le dossier)

## Étape 3 — Installe les dépendances
```
npm install
```
Attends 2-3 minutes.

## Étape 4 — Configure tes clés API
Ouvre le fichier `.env` et remplace :
- `NEXTAUTH_SECRET` → tape n'importe quelle phrase longue ex: "maclésecrete123456789prospectube"
- `ANTHROPIC_API_KEY` → ta clé sur console.anthropic.com

## Étape 5 — Crée la base de données
```
npx prisma db push
```

## Étape 6 — Lance l'application
```
npm run dev
```

## Étape 7 — Ouvre dans ton navigateur
Va sur : http://localhost:3000

---

## 🌐 Mettre en ligne sur Vercel (gratuit)

1. Crée un compte sur vercel.com
2. Installe Vercel : `npm i -g vercel`
3. Dans le dossier du projet : `vercel`
4. Suis les instructions
5. Ajoute tes variables d'environnement dans le dashboard Vercel

---

## 🔑 Où trouver tes clés API

**Anthropic (emails IA) :**
→ console.anthropic.com → API Keys → Create Key

**YouTube (optionnel pour la vraie recherche) :**
→ console.cloud.google.com → Activer "YouTube Data API v3" → Credentials → Create API Key
