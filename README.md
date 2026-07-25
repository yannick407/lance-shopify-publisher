# Lancé — déploiement Netlify

Site Netlify déjà créé : https://lance-shopify-publisher.netlify.app (vide pour l'instant, en attente du premier déploiement).

## Pour mettre ce code en ligne

1. Crée un dépôt GitHub vide.
2. Depuis ce dossier :
   ```
   git init
   git add .
   git commit -m "Lancé - v1"
   git remote add origin <URL de ton dépôt>
   git push -u origin main
   ```
3. Dans le dashboard Netlify du site `lance-shopify-publisher` : Site settings > Build & deploy > Link repository, connecte ce dépôt.

Netlify détecte `netlify.toml` automatiquement (dossier `public` publié, fonctions dans `netlify/functions`).

## Structure
- `public/index.html` — interface (formulaire boutique + token, scan, publication)
- `netlify/functions/scan.js` — scanne les ressources non publiées
- `netlify/functions/publish.js` — publie les ressources sélectionnées
- `netlify/functions/publish-theme.js` — publie un thème (avec confirmation côté interface)
- `netlify/functions/lib/shopify.js` — logique partagée d'appel à l'API Admin Shopify
