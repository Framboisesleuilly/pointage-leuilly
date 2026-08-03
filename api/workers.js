Workers · JS
import { kv } from '@vercel/kv';
 
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const workers = (await kv.get('workers')) || [];
    return res.status(200).json(workers);
  }
  if (req.method === 'POST') {
    await kv.set('workers', req.body);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
 
