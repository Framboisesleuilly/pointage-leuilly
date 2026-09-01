import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date manquante' });
  const key = 'barquettes:' + date;

  if (req.method === 'GET') {
    const list = (await kv.get(key)) || [];
    return res.status(200).json(list);
  }
  if (req.method === 'POST') {
    await kv.set(key, req.body);
    // On garde un index des dates utilisées, pour pouvoir tout retrouver (export, sauvegarde) sans deviner les dates.
    const dates = (await kv.get('barquettes-dates')) || [];
    if (!dates.includes(date)) {
      dates.push(date);
      await kv.set('barquettes-dates', dates);
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
