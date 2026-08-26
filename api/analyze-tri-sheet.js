export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquant dans les variables d\'environnement' });
  }

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Image manquante' });
  }

  const prompt = `Voici la photo ou le PDF d'une feuille de tri manuscrite. Le tableau a des colonnes : "P" (numéro de ligne), "Numéro" (numéro de cueilleur, de 1 à 56) et "Nombre" (une liste de nombres écrits à la suite sur la même ligne, séparés par des espaces).

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
- Fais de ton mieux même si l'écriture est imparfaite — ne réponds jamais par du texte d'excuse ou d'explication, uniquement le tableau JSON (même vide : [] si rien n'est lisible).`;

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

    return res.status(200).json({ ok: true, lignes: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
