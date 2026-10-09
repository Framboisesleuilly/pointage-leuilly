import { kv } from '@vercel/kv';
import * as XLSX from 'xlsx';

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

async function buildBackupWorkbook(workers){
  const wb = XLSX.utils.book_new();

  const wsWorkers = [['Prénom','Date de naissance','Email','Fait du tri']];
  workers.forEach(function(w){
    wsWorkers.push([w.prenom, w.dob, w.email||'', w.isTrieur?'Oui':'Non']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsWorkers), 'Salariés');

  const wsHeures = [['Prénom','Date','Matin début','Matin fin','Après-midi début','Après-midi fin','Pause (min)','Total jour','Commentaire']];
  const wsValidations = [['Prénom','Mois','Total heures','Validé le']];

  for (const w of workers) {
    const entries = (await kv.get('entries:' + w.id)) || {};
    Object.keys(entries).sort().forEach(function(day){
      const e = entries[day];
      wsHeures.push([w.prenom, frDate(day), e.matinDebut||'', e.matinFin||'', e.apremDebut||'', e.apremFin||'', e.pause||0, computeTotal(e), e.commentaire||'']);
    });
    const validations = (await kv.get('validations:' + w.id)) || {};
    Object.keys(validations).forEach(function(mois){
      const v = validations[mois];
      wsValidations.push([w.prenom, mois, v.totalHeures, v.validatedAt ? new Date(v.validatedAt).toLocaleString('fr-FR') : '']);
    });
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsHeures), 'Heures');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsValidations), 'Validations');

  // Tri (barquettes) : on relit l'index des dates connues, puis chaque journée.
  const wsTri = [['Date','Cueilleur n°','Barquettes','Trieur','Heure']];
  const barqDates = (await kv.get('barquettes-dates')) || [];
  for (const date of barqDates.sort()) {
    const list = (await kv.get('barquettes:' + date)) || [];
    list.forEach(function(e){
      const heure = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      wsTri.push([frDate(date), e.cueilleurNum, e.barquettes, e.sorterPrenom||'', heure]);
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsTri), 'Tri (barquettes)');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

async function handleSignatures(req, res, RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL) {
  const manual = req.query && req.query.manual === '1';
  const workers = (await kv.get('workers')) || [];
  const attachments = [];
  const marks = [];
  const enAttente = [];
  const faits = [];
  let totalSize = 0;
  for (const w of workers) {
    const docs = (await kv.get('documents:' + w.id)) || [];
    const aSig = docs.filter(function(d){ return d.aSigner; });
    if (!aSig.length) continue;
    const pending = aSig.filter(function(d){ return d.statut !== 'signe'; });
    if (pending.length) enAttente.push({ prenom: w.prenom, docs: pending.map(function(d){ return d.kind === 'reglement' ? 'Règlement intérieur' : (d.kind === 'fincontrat' ? 'Fin de contrat' : 'Contrat/DPAE'); }) });
    let changed = false;
    for (const d of aSig) {
      if ((manual || !pending.length) && d.statut === 'signe' && !d.envoyeLe && totalSize + (d.data||'').length < 30 * 1024 * 1024) {
        attachments.push({ filename: d.name, content: d.data });
        totalSize += (d.data||'').length;
        faits.push(w.prenom + ' — ' + (d.kind === 'reglement' ? 'Règlement intérieur' : (d.kind === 'fincontrat' ? 'Fin de contrat' : 'Contrat/DPAE')));
        d.envoyeLe = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) marks.push({ id: w.id, docs: docs });
  }
  if (!manual && !attachments.length) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'rien de nouveau', enAttente: enAttente.length });
  }
  const html = `
    <div style="font-family:sans-serif;color:#2B2B24;">
      <h2 style="color:#33502E;">Signatures des salariés</h2>
      <h3 style="color:#33502E;">Documents signés joints (${attachments.length})</h3>
      <ul>${faits.map(function(f){ return '<li>' + f + '</li>'; }).join('') || '<li>Aucun nouveau document signé</li>'}</ul>
      <h3 style="color:#A32638;">Reste à faire (${enAttente.length} salarié(s))</h3>
      <ul>${enAttente.map(function(e){ return '<li>' + e.prenom + ' : ' + e.docs.join(', ') + '</li>'; }).join('') || '<li>Tout est signé 🎉</li>'}</ul>
    </div>`;
  const payload = { from: FROM_EMAIL, to: ADMIN_EMAIL, subject: `Signatures : ${attachments.length} document(s) signé(s), ${enAttente.length} salarié(s) à relancer`, html: html };
  if (attachments.length) payload.attachments = attachments;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) { for (const m of marks) { await kv.set('documents:' + m.id, m.docs); } }
    return res.status(200).json({ ok: true, envoye: r.ok, joints: attachments.length, enAttente: enAttente.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  const isSig = req.query && req.query.mode === 'signatures';
  if (!isSig && process.env.CRON_SECRET) {
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

  if (isSig) return await handleSignatures(req, res, RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL);

  const workers = (await kv.get('workers')) || [];
  const today = new Date().toISOString().slice(0,10);
  const dayOfMonth = new Date().getDate();
  const forceBackup = req.query && (req.query.includeBackup === '1');
  const includeBackup = forceBackup || (dayOfMonth % 2 === 0); // un jour sur deux, ou forcé manuellement

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

  // Pas d'activité du tout aujourd'hui : on n'envoie pas le récap automatique (sauf déclenchement manuel volontaire).
  if (!forceBackup && ontRempli.length === 0) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'aucune activité aujourd\'hui', totalDuJour: 0, ontRempli: 0, pasRempli: pasRempli.length });
  }

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
      ${includeBackup ? '<p style="color:#33502E;font-weight:600;">📎 Sauvegarde complète jointe à cet email (salariés, heures, validations, tri).</p>' : ''}
      <p style="font-size:13px;color:#66655B;">Mont de Leuilly — récap automatique quotidien</p>
    </div>
  `;

  const payload = {
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Récap pointage du ${frDate(today)} — ${totalDuJour} h, ${pasRempli.length} manquant(s)${includeBackup ? ' (+ sauvegarde)' : ''}`,
    html: html
  };

  if (includeBackup) {
    try {
      const backupB64 = await buildBackupWorkbook(workers);
      payload.attachments = [{ filename: `Sauvegarde_Pointage_${today}.xlsx`, content: backupB64 }];
    } catch (err) {
      // Si la sauvegarde échoue, on envoie quand même le récap normal sans bloquer.
    }
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return res.status(200).json({ ok: true, envoye: r.ok, totalDuJour, ontRempli: ontRempli.length, pasRempli: pasRempli.length, sauvegardeIncluse: includeBackup });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
