# Déployer l'appli Pointage sur Vercel — guide détaillé

Aucune compétence en code n'est nécessaire. Compte 20-30 minutes la première fois. Prévois un ordinateur pour cette étape (plus simple qu'au téléphone) .

---

## Étape 1 — Créer un compte GitHub

GitHub va héberger le code source (gratuit).

1. Va sur https://github.com
2. Clique sur "Sign up" en haut à droite.
3. Renseigne une adresse email, un mot de passe, un nom d'utilisateur.
4. Vérifie ton email si demandé.

## Étape 2 — Créer le dépôt (le dossier du projet)

1. Une fois connecté, clique sur le "+" en haut à droite, puis "New repository".
2. Dans "Repository name", écris par exemple `pointage-leuilly`.
3. Laisse "Public" coché (ou "Private" si tu préfères, ça ne change rien pour la suite).
4. Ne coche aucune case en dessous (pas de README, pas de .gitignore).
5. Clique sur le bouton vert "Create repository".

## Étape 3 — Déposer les fichiers

Tu es maintenant sur la page du dépôt vide.

1. Clique sur le lien "uploading an existing file" (au milieu de la page).
2. Glisse-dépose ces 3 fichiers depuis ton ordinateur : `index.html`, `package.json`, `LISEZ-MOI.md`.
3. En bas de page, clique sur le bouton vert "Commit changes".
4. Il faut maintenant créer le dossier `api` avec les 2 fichiers dedans. GitHub ne permet pas de glisser un dossier directement au même endroit, donc :
   - Retourne sur la page principale du dépôt (clique sur le nom du dépôt en haut).
   - Clique "Add file" puis "Create new file".
   - Dans le champ du nom de fichier, tape `api/workers.js` (le `api/` avant le nom crée automatiquement le dossier).
   - Colle le contenu du fichier `workers.js` que je t'ai donné (ouvre-le avec un éditeur de texte type Bloc-notes/TextEdit pour copier son contenu).
   - En bas, clique "Commit changes".
   - Refais la même chose pour `api/entries.js`.
5. Vérifie que ton dépôt contient bien : `index.html`, `package.json`, `LISEZ-MOI.md`, et un dossier `api` avec `workers.js` et `entries.js` dedans.

## Étape 4 — Créer un compte Vercel

1. Va sur https://vercel.com
2. Clique "Sign Up".
3. Choisis "Continue with GitHub" — ça relie directement ton compte GitHub, pas besoin de nouveau mot de passe.
4. Autorise Vercel à accéder à ton compte GitHub quand c'est demandé.

## Étape 5 — Importer le projet

1. Sur le tableau de bord Vercel, clique "Add New..." puis "Project".
2. Dans la liste de tes dépôts GitHub, trouve `pointage-leuilly` et clique "Import" à côté.
3. Laisse tous les réglages par défaut (Framework: "Other" est très bien, ne change rien).
4. Clique "Deploy".
5. Patiente 30 à 60 secondes. Une page de félicitations s'affiche avec un aperçu du site et une adresse du type `pointage-leuilly.vercel.app`.

À ce stade, l'appli s'affiche déjà si tu ouvres l'adresse, mais la sauvegarde des heures ne fonctionnera pas encore — il manque la base de données.

## Étape 6 — Ajouter la base de données (gratuite)

Le stockage KV de Vercel est maintenant proposé via son "Marketplace" (une place de marché de fournisseurs partenaires) plutôt qu'en direct, mais ça reste gratuit pour ce projet et ça se fait toujours depuis le tableau de bord Vercel.

1. Dans ton projet Vercel, clique sur l'onglet "Storage" (dans le menu du haut).
2. Clique "Create Database" (ou "Browse Marketplace" selon ce qui s'affiche).
3. Choisis un fournisseur de type "KV" ou "Redis" — en général "Upstash" est celui proposé pour ça.
4. Choisis le plan gratuit ("Hobby" ou "Free"), donne un nom à la base (ex: `pointage-db`), clique "Continue" puis "Create".
5. Une fois créée, clique "Connect Project" (ou "Connect" à côté du nom de ton projet) pour la relier à `pointage-leuilly`.
6. Vercel ajoute automatiquement les codes d'accès nécessaires à ton projet et propose un redéploiement — accepte ("Redeploy" ou "Deploy").

Si les noms exacts des boutons ont légèrement changé d'ici que tu fasses cette étape (Vercel met à jour son interface régulièrement), cherche les mots-clés "Storage", "Database", "KV" ou "Redis" — la logique reste la même.

## Étape 7 — Tester

1. Ouvre l'adresse `https://pointage-leuilly.vercel.app` sur ton téléphone.
2. Crée un compte test : un prénom quelconque + une date de naissance.
3. Remplis une journée d'heures, enregistre.
4. Reviens à l'accueil, entre dans "Espace responsable" avec le code `LEUILLY2026`.
5. Vérifie que le total du salarié test apparaît, puis clique "Exporter en Excel" pour confirmer que le fichier se télécharge correctement.

Si rien ne s'enregistre, c'est presque toujours que la base de données de l'étape 6 n'est pas bien connectée — reviens sur l'onglet Storage et vérifie que le statut est "Connected" à ton projet.

## Étape 8 — Distribuer aux salariés

Partage l'adresse `https://pointage-leuilly.vercel.app` (par SMS, affichage papier, etc.). Ils l'ouvrent dans leur navigateur — aucun compte requis — et peuvent appuyer sur "Partager" puis "Sur l'écran d'accueil" (iPhone) ou le menu ⋮ puis "Ajouter à l'écran d'accueil" (Android) pour l'avoir comme une appli.

## Pour modifier l'appli plus tard

Reviens dans cette conversation, dis-moi ce qu'il faut changer, je te redonne les fichiers mis à jour. Tu les remplaces alors sur GitHub :

1. Va sur ton dépôt GitHub, ouvre le fichier à remplacer (ex: `index.html`).
2. Clique sur l'icône crayon (Edit) en haut à droite du contenu du fichier.
3. Sélectionne tout, supprime, colle le nouveau contenu.
4. Clique "Commit changes".

Vercel redéploie automatiquement l'appli dès qu'un fichier change sur GitHub — pas besoin de retoucher à Vercel.

## Le code responsable

Fixé à `LEUILLY2026` dans `index.html` (cherche `ADMIN_CODE`). Pour le changer : soit tu me le demandes ici, soit tu modifies directement cette ligne sur GitHub en suivant la méthode ci-dessus.
