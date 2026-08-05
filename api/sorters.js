import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sorters = (await kv.get('sorters-list')) || [];
    return res.status(200).json(sorters);
  }
  if (req.method === 'POST') {
    await kv.set('sorters-list', req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
