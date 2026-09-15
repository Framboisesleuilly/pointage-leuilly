import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { collection } = req.query;
  if (!collection) return res.status(400).json({ error: 'collection manquante' });
  const key = 'agro-data:' + collection;

  if (req.method === 'GET') {
    const data = await kv.get(key);
    return res.status(200).json(data === undefined ? null : data);
  }
  if (req.method === 'POST') {
    await kv.set(key, req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
