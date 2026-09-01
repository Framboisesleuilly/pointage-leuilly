import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const list = (await kv.get('bons-apport')) || [];
    return res.status(200).json(list);
  }
  if (req.method === 'POST') {
    await kv.set('bons-apport', req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
