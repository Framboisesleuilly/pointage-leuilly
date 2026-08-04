import { kv } from '@vercel/kv';

function timeToDecimal(t){
  if(!t) return null;
  var parts = t.split(':');
  return parseInt(parts[0],10) + parseInt(parts[1],10)/60;
}
function computeTotal(e){
  if(!e.matinDebut || !e.matinFin) return null;
  var m = timeToDecimal(e.matinFin) - timeToDecimal(e.matinDebut);
  var a = 0;
  if(e.apremDebut && e.apremFin){ a = timeToDecimal(e.apremFin) - timeToDecimal(e.apremDebut); }
  var pause = (parseFloat(e.pause)||0)/60;
  var total = m + a - pause;
  if(total < 0) total = 0;
  return Math.round(total*100)/100;
}
function frDate(iso){ var p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

export default async function handler(req, res) {
  // Sécurité : si CRON_SECRET est configuré, on vérifie l'en-tête envoyé automatiquement par Vercel Cron.
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'Pointage <onboarding@resend.dev>';
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY manquant dans les variables d\'environnement' });
  }

  const workers = (await kv.get('workers')) || [];

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const fromISO = sevenDaysAgo.toISOString().slice(0,10);
  const toISO = today.toISOString().slice(0,10);

  const results = [];

  for (const w of workers) {
    if (!w.email) { results.push({ prenom: w.prenom, statut: 'ignoré (pas d\'email)' }); continue; }

    const entries = (await kv.get('entries:' + w.id)) || {};
    const days = Object.keys(entries).filter(function(d){ return d >= fromISO && d <= toISO; }).sort();

    let total = 0;
    let rows = '';
    days.forEach(function(d){
      const t = computeTotal(entries[d]);
      if (t) total += t;
      rows += `<tr><td style="padding:4px 10px;">${frDate(d)}</td><td style="padding:4px 10px;text-align:right;">${t !== null ? t + ' h' : '—'}</td></tr>`;
    });
    total = Math.round(total*100)/100;

    const html = `
      <div style="font-family:sans-serif;color:#2B2B24;">
        <h2 style="color:#33502E;">Bonjour ${w.prenom},</h2>
        <p>Voici ton récapitulatif d'heures pour la semaine du ${frDate(fromISO)} au ${frDate(toISO)} :</p>
        <table style="border-collapse:collapse;width:100%;max-width:320px;">${rows || '<tr><td style="padding:4px 10px;">Aucune journée saisie</td></tr>'}</table>
        <p style="margin-top:14px;font-weight:bold;font-size:18px;color:#33502E;">Total : ${total} h</p>
        <p style="font-size:13px;color:#66655B;">Mont de Leuilly — pointage automatique</p>
      </div>
    `;

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: w.email,
          subject: `Ton récap d'heures — semaine du ${frDate(fromISO)}`,
          html: html
        })
      });
      results.push({ prenom: w.prenom, statut: r.ok ? 'envoyé' : 'échec (' + r.status + ')' });
    } catch (err) {
      results.push({ prenom: w.prenom, statut: 'erreur: ' + err.message });
    }
  }

  return res.status(200).json({ ok: true, periode: [fromISO, toISO], results });
}
