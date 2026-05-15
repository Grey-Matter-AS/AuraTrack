import { formatCSVRow } from './formatters';

export const filterEventsByDateRange = (events, fromDateStr, toDateStr) => {
  const from = fromDateStr ? new Date(fromDateStr).setHours(0, 0, 0, 0) : 0;
  const to   = toDateStr   ? new Date(toDateStr).setHours(23, 59, 59, 999) : Date.now();
  return events.filter(e => e.startTime >= from && e.startTime <= to);
};

export const exportToJSON = (events) => {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `auratrack-backup-${dateStamp()}.json`);
};

export const exportToCSV = (events) => {
  const header = 'id,date,time,type,duration,notes';
  const rows = events.map(formatCSVRow).join('\n');
  const blob = new Blob([`${header}\n${rows}`], { type: 'text/csv' });
  triggerDownload(blob, `auratrack-events-${dateStamp()}.csv`);
};

export const exportToPDF = (events) => {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html><head><title>AuraTrack Export</title>
    <style>
      body { font-family: monospace; padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    </style>
    </head><body>
    <h2>AuraTrack Event Log — ${new Date().toLocaleDateString()}</h2>
    <table>
      <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Duration</th><th>Notes</th></tr></thead>
      <tbody>
        ${events.map(e =>
          `<tr><td>${e.date||''}</td><td>${e.time||''}</td><td>${e.type||''}</td><td>${e.duration||0}s</td><td>${(e.notes||'').replace(/\n/g,'<br>')}</td></tr>`
        ).join('')}
      </tbody>
    </table>
    </body></html>
  `);
  win.document.close();
  win.print();
};

// ─── Clinical Neurologist Report ─────────────────────────────

export const exportNeurologistReport = (events, settings = {}) => {
  const win = window.open('', '_blank');
  if (!win) return;

  const { personName = '', caretakerName = '', dateOfBirth = '', emergencyContact = '',
          neurologistName = '', neurologistInstitution = '', neurologistContact = '',
          includePatientDOB = true, reportNotes = '', userMode = 'CARETAKER' } = settings;

  const generatedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const reporterLabel = userMode === 'CARETAKER' ? caretakerName : personName;
  const subjectLabel  = userMode === 'CARETAKER' ? personName : 'Self';

  // ── Summary statistics
  const totalEvents = events.length;
  const byType = {};
  let totalDuration = 0;
  const symptomFreq = {};

  events.forEach(e => {
    byType[e.type || 'Uncategorized'] = (byType[e.type || 'Uncategorized'] || 0) + 1;
    totalDuration += (e.duration || 0);
    (e.symptoms || []).forEach(s => {
      const key = s.symptom || s.detail || 'Unknown';
      symptomFreq[key] = (symptomFreq[key] || 0) + 1;
    });
  });

  const avgDuration = totalEvents ? Math.round(totalDuration / totalEvents) : 0;
  const dateRange = events.length
    ? `${events[events.length - 1].date || '—'} to ${events[0].date || '—'}`
    : '—';

  const typeRows = Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td><td>${Math.round(count / totalEvents * 100)}%</td></tr>`)
    .join('');

  const symptomRows = Object.entries(symptomFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([sym, count]) => `<tr><td>${sym}</td><td>${count}</td></tr>`)
    .join('');

  // ── Per-event rows
  const eventRows = events.map((e, i) => {
    const auraDur    = e.laps?.aura && e.startTime    ? Math.round((e.laps.aura - e.startTime) / 1000)    : '—';
    const seizureDur = e.laps?.aura && e.laps?.seizure ? Math.round((e.laps.seizure - e.laps.aura) / 1000) : '—';
    const recoveryDur= e.laps?.seizure && e.laps?.recovery ? Math.round((e.laps.recovery - e.laps.seizure) / 1000) : '—';
    const symptoms   = (e.symptoms || []).map(s => `${s.symptom}${s.specificPart ? ` (${s.specificPart})` : ''}`).join('; ') || '—';
    const notes      = (e.notes || '').replace(/\n/g, '<br>');

    return `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="font-weight:bold">${i + 1}</td>
        <td>${e.date || '—'}</td>
        <td>${e.time || '—'}</td>
        <td>${e.type || 'Uncategorized'}</td>
        <td style="text-align:right">${e.duration || 0}s</td>
        <td style="text-align:right">${auraDur}s</td>
        <td style="text-align:right">${seizureDur}s</td>
        <td style="text-align:right">${recoveryDur}s</td>
      </tr>
      ${symptoms !== '—' ? `<tr style="background:${i % 2 === 0 ? '#f0f4ff' : '#f8faff'}"><td></td><td colspan="4" style="color:#374151;font-size:11px;padding:4px 8px"><em>Symptoms:</em> ${symptoms}</td><td colspan="3" style="color:#374151;font-size:11px;padding:4px 8px">${notes ? `<em>Notes:</em> ${notes}` : ''}</td></tr>` : ''}
    `;
  }).join('');

  win.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>AuraTrack Clinical Report — ${personName || 'Patient'}</title>
    <style>
      @page { size: A4; margin: 20mm 18mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111827; margin: 0; padding: 0; }
      h1 { font-size: 22px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
      h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; margin: 0 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
      h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 0 0 6px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
      th { background: #1e293b; color: #fff; padding: 8px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
      td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; vertical-align: top; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #dc2626; margin-bottom: 20px; }
      .logo { color: #dc2626; font-size: 10px; font-weight: 900; letter-spacing: 0.4em; text-transform: uppercase; }
      .logo-sub { font-size: 9px; color: #9ca3af; margin-top: 2px; }
      .meta-block { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
      .meta-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
      .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 700; }
      .meta-value { font-size: 13px; font-weight: 800; color: #111827; margin-top: 2px; }
      .meta-value-sm { font-size: 11px; font-weight: 600; color: #374151; margin-top: 1px; }
      .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
      .stat-card { background: #1e293b; border-radius: 8px; padding: 12px 10px; text-align: center; color: #fff; }
      .stat-value { font-size: 22px; font-weight: 900; font-family: monospace; }
      .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-top: 3px; }
      .section { margin-bottom: 24px; page-break-inside: avoid; }
      .disclaimer { font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 20px; }
      .notes-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; font-size: 11px; color: #374151; white-space: pre-wrap; }
    </style>
    </head><body>

    <!-- HEADER -->
    <div class="header">
      <div>
        <div class="logo">AuraTrack</div>
        <div class="logo-sub">Seizure Event Log — Clinical Report</div>
        <div style="margin-top:8px; font-size:10px; color:#6b7280">Generated: ${generatedDate}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#6b7280;margin-bottom:2px">Prepared by</div>
        <div style="font-weight:800">${reporterLabel || '—'}</div>
        ${neurologistName ? `<div style="font-size:10px;color:#374151;margin-top:6px">Addressed to:</div><div style="font-weight:700">${neurologistName}</div>` : ''}
        ${neurologistInstitution ? `<div style="font-size:10px;color:#6b7280">${neurologistInstitution}</div>` : ''}
        ${neurologistContact    ? `<div style="font-size:10px;color:#6b7280">${neurologistContact}</div>` : ''}
      </div>
    </div>

    <!-- PATIENT / SUBJECT BLOCK -->
    <div class="meta-block">
      <div class="meta-card">
        <div class="meta-label">Subject / Patient</div>
        <div class="meta-value">${subjectLabel || '—'}</div>
        ${includePatientDOB && dateOfBirth ? `<div class="meta-value-sm">DOB: ${new Date(dateOfBirth).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}</div>` : ''}
        ${emergencyContact ? `<div class="meta-value-sm">Emergency: ${emergencyContact}</div>` : ''}
      </div>
      <div class="meta-card">
        <div class="meta-label">Report Coverage</div>
        <div class="meta-value-sm" style="margin-top:4px">${dateRange}</div>
        <div class="meta-value-sm">${totalEvents} event${totalEvents !== 1 ? 's' : ''} recorded</div>
      </div>
    </div>

    <!-- SUMMARY STATISTICS -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${totalEvents}</div>
        <div class="stat-label">Total Events</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgDuration}s</div>
        <div class="stat-label">Avg Duration</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Math.round(totalDuration / 60)}m</div>
        <div class="stat-label">Total Record Time</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Object.keys(byType).length}</div>
        <div class="stat-label">Seizure Types</div>
      </div>
    </div>

    <!-- EVENT TYPE BREAKDOWN -->
    <div class="section">
      <h2>Event Type Breakdown</h2>
      <table>
        <thead><tr><th>Seizure Type</th><th>Count</th><th>% of Total</th></tr></thead>
        <tbody>${typeRows || '<tr><td colspan="3">No events recorded</td></tr>'}</tbody>
      </table>
    </div>

    <!-- DETAILED EVENT LOG -->
    <div class="section">
      <h2>Detailed Event Log (most recent first)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Date</th><th>Time</th><th>Type</th>
            <th style="text-align:right">Total</th>
            <th style="text-align:right">Aura</th>
            <th style="text-align:right">Seizure</th>
            <th style="text-align:right">Recovery</th>
          </tr>
        </thead>
        <tbody>${eventRows || '<tr><td colspan="8">No events recorded</td></tr>'}</tbody>
      </table>
    </div>

    <!-- SYMPTOM FREQUENCY -->
    ${symptomRows ? `
    <div class="section">
      <h2>Symptom Frequency (top 20)</h2>
      <table>
        <thead><tr><th>Symptom</th><th>Occurrences</th></tr></thead>
        <tbody>${symptomRows}</tbody>
      </table>
    </div>` : ''}

    <!-- ADDITIONAL NOTES -->
    ${reportNotes ? `
    <div class="section">
      <h2>Caretaker / Patient Notes</h2>
      <div class="notes-box">${reportNotes.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <!-- DISCLAIMER -->
    <div class="disclaimer">
      This report was generated by AuraTrack v0.1.0, a personal seizure-logging PWA.
      All data was entered by the caretaker or patient. This document is not a substitute for professional medical assessment.
      Times and durations are approximations based on manual input.
    </div>

    <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
};

// ─── Helpers ─────────────────────────────────────────────────

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
