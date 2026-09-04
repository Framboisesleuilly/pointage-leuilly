const PROMPTS = {
  timesheet: `Voici la photo ou le PDF d'une feuille de présence manuscrite française ("Feuille de présence"), avec un tableau : Date, Jour, Matin (Heure début / Heure fin), Après-midi (Heure début / Heure fin), Pause, Total Jour. Il peut aussi y avoir des cases barrées d'un tiret ("—") pour les jours sans travail (dimanches, jours de repos) — ignore ces lignes.

Lis attentivement chaque ligne du tableau qui contient au moins une heure renseignée à la main.

Réponds UNIQUEMENT avec un tableau JSON strict, rien d'autre : pas de texte avant, pas de texte après, pas d'explication, pas de balises markdown. Format exact :
[
  {"jour": 1, "matinDebut": "07:30", "matinFin": "12:00", "apremDebut": "12:30", "apremFin": "14:00", "pauseMinutes": 0},
  {"jour": 2, "matinDebut": "07:30", "matinFin": "12:00", "apremDebut": "12:30", "apremFin": "18:00", "pauseMinutes": 0}
]

Règles :
- "jour" est le numéro du jour du mois (1 à 31), tel qu'écrit dans la colonne Date.
- Les heures sont au format "HH:MM" (24h). Si une case est vide ou barrée (tiret), mets null pour ce champ.
- "pauseMinutes" est un nombre de minutes (0 si la case Pause est vide).
- N'inclus pas les lignes totalement vides ou barrées (sans aucune heure).
- Retranscris fidèlement ce qui est écrit à la main, du mieux que tu peux lire, même si l'écriture est imparfaite — fais une estimation raisonnable plutôt que de laisser passer une ligne lisible.
- Ne réponds jamais par du texte d'excuse ou d'explication, uniquement le tableau JSON (même vide : [] si rien n'est lisible du tout).`,

  tri: `Voici la photo ou le PDF d'une feuille de tri manuscrite. Le tableau a des colonnes : "P" (numéro de ligne), "Numéro" (numéro de cueilleur, de 1 à 56) et "Nombre" (une liste de nombres écrits à la suite sur la même ligne, séparés par des espaces).

Chaque nombre dans la colonne "Nombre" correspond à UN passage distinct pour ce cueilleur ce jour-là (une caisse ou un lot compté séparément) — ce n'est PAS une seule quantité totale, il peut y en avoir plusieurs sur la même ligne (ex: "24 24 24 24" = quatre passages de 24 chacun pour ce cueilleur, à retourner comme quatre entrées séparées).

Ignore les lignes de numéro sans aucun nombre écrit à côté.

Réponds UNIQUEMENT avec un tableau JSON strict, rien d'autre : pas de texte avant, pas de texte après, pas d'explication, pas de balises markdown. Une entrée par nombre individuel lu (pas de somme). Format exact :
[
  {"cueilleurNum": 1, "barquettes": 24},
  {"cueilleurNum": 1, "barquettes": 24},
  {"cueilleurNum": 5, "barquettes": 24}
]

Règles :
- "cueilleurNum" est un nombre entier entre 1 et 56, lu dans la colonne "Numéro".
- "barquettes" est un des nombres individuels lus dans la colonne "Nombre" pour cette ligne.
- Si un nombre est illisible, ignore-le plutôt que de deviner.
- Fais de ton mieux même si l'écriture est imparfaite — ne réponds jamais par du texte d'excuse ou d'explication, uniquement le tableau JSON (même vide : [] si rien n'est lisible).`,

  bonApport: `Voici un bon d'apport (bordereau de livraison de fruits) au format PDF ou photo, remis par un point de collecte ou une coopérative, indiquant les quantités livrées et leur prix. Le document classe souvent les fruits par catégorie de qualité (des codes courts comme E, A, B, C, IQF, ou "Vente directe"), en plus ou à la place d'une variété.

Lis attentivement chaque ligne qui indique une date, une catégorie/note de qualité, éventuellement une variété, une quantité en kg et un prix.

Réponds UNIQUEMENT avec un tableau JSON strict, rien d'autre : pas de texte avant, pas de texte après, pas d'explication, pas de balises markdown. Format exact :
[
  {"date": "2026-08-05", "note": "E", "variete": "Kwanza", "kg": 45.5, "prixKg": 4.20},
  {"date": "2026-08-05", "note": "IQF", "variete": "", "kg": 12, "prixKg": 5.00}
]

Règles :
- "date" au format AAAA-MM-JJ. Si une seule date apparaît pour tout le document, applique-la à toutes les lignes.
- "note" est le code de catégorie/qualité tel qu'écrit sur le document (ex: E, A, B, C, IQF, "HS A", "HS B", "HS C", "HS E", "Vente directe"). Le préfixe "HS" (Hors Standard) fait partie du code s'il est présent — ne l'ignore pas, il distingue une catégorie différente de la lettre seule. Si le document n'a pas de catégorie de ce type, mets une chaîne vide "".
- "variete" est le nom de la variété si elle est indiquée séparément de la catégorie ; sinon laisse une chaîne vide "".
- "kg" et "prixKg" sont des nombres (utilise un point comme séparateur décimal, pas de virgule).
- Si le document indique un montant total au lieu d'un prix au kg, calcule prixKg = montant / kg.
- Ignore les lignes de total ou de sous-total, ne retourne que le détail ligne par ligne.
- Ne réponds jamais par du texte d'excuse ou d'explication, uniquement le tableau JSON (même vide : [] si rien n'est lisible).`
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquant dans les variables d\'environnement' });
  }

  const { imageBase64, mediaType, mode } = req.body;
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Image manquante' });
  }
  const prompt = PROMPTS[mode];
  if (!prompt) {
    return res.status(400).json({ error: 'mode inconnu (attendu: timesheet, tri, bonApport)' });
  }

  const isPdf = mediaType === 'application/pdf';
  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.error ? data.error.message : 'Erreur API Anthropic' });
    }

    const textBlock = (data.content || []).find(function(b){ return b.type === 'text'; });
    if (!textBlock) return res.status(500).json({ error: 'Réponse vide de l\'API' });

    var cleaned = textBlock.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      var start = cleaned.indexOf('[');
      var end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          parsed = JSON.parse(cleaned.slice(start, end+1));
        } catch (e2) {
          return res.status(500).json({ error: 'Réponse non exploitable, réessaie avec une photo plus nette.', raw: cleaned });
        }
      } else {
        return res.status(500).json({ error: 'Réponse non exploitable, réessaie avec une photo plus nette.', raw: cleaned });
      }
    }

    return res.status(200).json({ ok: true, resultats: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
