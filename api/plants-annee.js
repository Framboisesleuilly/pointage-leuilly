import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = (await kv.get('plants-par-annee')) || {};
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    await kv.set('plants-par-annee', req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
