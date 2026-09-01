import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const secteurs = (await kv.get('secteurs')) || [];
    return res.status(200).json(secteurs);
  }
  if (req.method === 'POST') {
    await kv.set('secteurs', req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
