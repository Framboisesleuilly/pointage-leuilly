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

  const prompt = `Voici la photo d'une feuille de présence manuscrite française ("Feuille de présence"), avec un tableau : Date, Jour, Matin (Heure début / Heure fin), Après-midi (Heure début / Heure fin), Pause, Total Jour.

Lis attentivement chaque ligne du tableau qui contient au moins une heure renseignée (ignore les lignes vides, comme les dimanches sans heures).

Réponds UNIQUEMENT avec un tableau JSON strict, sans aucun texte avant ou après, sans balises markdown, au format exact suivant :
[
  {"jour": 1, "matinDebut": "07:30", "matinFin": "12:00", "apremDebut": "12:30", "apremFin": "14:00", "pauseMinutes": 0},
  {"jour": 2, "matinDebut": "07:30", "matinFin": "12:00", "apremDebut": "12:30", "apremFin": "18:00", "pauseMinutes": 0}
]

Règles :
- "jour" est le numéro du jour du mois (1 à 31), tel qu'écrit dans la colonne Date.
- Les heures sont au format "HH:MM" (24h). Si une case est vide ou barrée (tiret), mets null pour ce champ.
- "pauseMinutes" est un nombre de minutes (0 si la case Pause est vide).
- N'inclus pas les lignes totalement vides (sans aucune heure).
- Ne recalcule rien, retranscris fidèlement ce qui est écrit à la main, du mieux que tu peux lire.`;

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

    return res.status(200).json({ ok: true, jours: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
