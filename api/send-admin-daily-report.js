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
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'Pointage <onboarding@resend.dev>';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bussy.louis@gmail.com';
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY manquant dans les variables d\'environnement' });
  }

  const workers = (await kv.get('workers')) || [];
  const today = new Date().toISOString().slice(0,10);

  let totalDuJour = 0;
  let ontRempli = [];
  let pasRempli = [];

  for (const w of workers) {
    const entries = (await kv.get('entries:' + w.id)) || {};
    const e = entries[today];
    const t = e ? computeTotal(e) : null;
    if (t !== null) {
      totalDuJour += t;
      ontRempli.push({ prenom: w.prenom, total: t });
    } else {
      pasRempli.push(w.prenom);
    }
  }
  totalDuJour = Math.round(totalDuJour*100)/100;

  const rowsOk = ontRempli.map(function(o){ return `<tr><td style="padding:4px 10px;">${o.prenom}</td><td style="padding:4px 10px;text-align:right;">${o.total} h</td></tr>`; }).join('');
  const rowsMissing = pasRempli.map(function(p){ return `<li>${p}</li>`; }).join('');

  const html = `
    <div style="font-family:sans-serif;color:#2B2B24;">
      <h2 style="color:#33502E;">Récap du jour — ${frDate(today)}</h2>
      <p style="font-weight:bold;font-size:18px;color:#33502E;">Total heures du jour : ${totalDuJour} h</p>
      <h3 style="color:#33502E;">Ont pointé (${ontRempli.length})</h3>
      <table style="border-collapse:collapse;width:100%;max-width:320px;">${rowsOk || '<tr><td style="padding:4px 10px;">Personne pour l\'instant</td></tr>'}</table>
      <h3 style="color:#A32638;">N'ont pas encore pointé (${pasRempli.length})</h3>
      <ul>${rowsMissing || '<li>Tout le monde a pointé 🎉</li>'}</ul>
      <p style="font-size:13px;color:#66655B;">Mont de Leuilly — récap automatique quotidien</p>
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
        to: ADMIN_EMAIL,
        subject: `Récap pointage du ${frDate(today)} — ${totalDuJour} h, ${pasRempli.length} manquant(s)`,
        html: html
      })
    });
    return res.status(200).json({ ok: true, envoye: r.ok, totalDuJour, ontRempli: ontRempli.length, pasRempli: pasRempli.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
