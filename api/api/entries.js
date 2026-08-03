import { kv } from '@vercel/kv';
 
export default async function handler(req, res) {
  const { workerId } = req.query;
  if (!workerId) return res.status(400).json({ error: 'workerId manquant' });
  const key = 'entries:' + workerId;
 
  if (req.method === 'GET') {
    const entries = (await kv.get(key)) || {};
    return res.status(200).json(entries);
  }
  if (req.method === 'POST') {
    await kv.set(key, req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
 
