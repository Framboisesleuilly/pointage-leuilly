# Activer l'import de feuilles d'heures par photo

Cette fonction envoie la photo à l'API Anthropic (Claude) pour lire le tableau manuscrit. Il faut une clé API Anthropic — payante à l'usage, quelques centimes par photo analysée.

## 1. Créer une clé API

1. Va sur https://console.anthropic.com et crée un compte (ou connecte-toi si tu en as déjà un).
2. Ajoute un moyen de paiement (facturation à l'usage, pas d'abonnement).
3. Va dans "API Keys", clique "Create Key", donne-lui un nom (ex: `pointage`), copie la clé générée (elle commence par `sk-ant-`).

## 2. Ajouter la clé dans Vercel

1. Dans ton projet Vercel, **Settings → Environment Variables**.
2. Ajoute une variable nommée `ANTHROPIC_API_KEY`, colle la clé copiée, coche "Production", enregistre.
3. Redéploie le projet (Deployments → "..." → Redeploy).

## Utilisation

Espace responsable → **"Importer une feuille d'heures"** → section du bas "Ou importer depuis une photo" : choisis le salarié, le mois, dépose la photo. L'IA propose les heures détectées jour par jour, modifiables avant de confirmer l'import — vérifie toujours avant de valider, la lecture d'une écriture manuscrite n'est jamais garantie à 100%.
