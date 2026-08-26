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

  const prompt = `Voici la photo d'une feuille de tri manuscrite, utilisée par une personne qui compte des barquettes de fruits récoltées, en les attribuant à un numéro de cueilleur (numéroté de 1 à 56). La feuille peut se présenter sous forme de liste, de tableau, ou de bâtons/traits de comptage (tally marks) à côté de chaque numéro.

Lis attentivement chaque ligne ou groupe qui associe un numéro de cueilleur à une quantité de barquettes (compte les bâtons/traits si c'est ce format qui est utilisé).

Réponds UNIQUEMENT avec un tableau JSON strict, sans aucun texte avant ou après, sans balises markdown, au format exact suivant :
[
  {"cueilleurNum": 5, "barquettes": 12},
  {"cueilleurNum": 12, "barquettes": 8}
]

Règles :
- "cueilleurNum" est un nombre entier entre 1 et 56.
- "barquettes" est le nombre total de barquettes comptées pour ce cueilleur sur cette feuille.
- S'il y a plusieurs lignes pour le même numéro de cueilleur (plusieurs passages dans la journée), additionne-les en une seule entrée, sauf si elles semblent clairement séparées à des moments différents — dans ce cas, retourne une entrée par ligne.
- Ignore les numéros illisibles ou hors de la plage 1-56.
- Ne retranscris que ce qui est écrit, sans deviner au-delà de ce qui est visible.`;

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
      return res.status(500).json({ error: 'Réponse non exploitable, réessaie avec une photo plus nette.', raw: cleaned });
    }

    return res.status(200).json({ ok: true, lignes: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
