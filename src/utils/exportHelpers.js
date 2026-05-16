import { formatCSVRow } from './formatters';
import { freqBarChartSVG, durationLineSVG, typeBarSVG, phaseStackSVG } from './pdfCharts';

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

  const fmtSymptomPath = (s) => {
    const path = [s.symptom, s.detail].filter(Boolean).join(' › ');
    const loc = [s.region, s.subRegion, s.specificPart]
      .filter(p => p && p !== 'N/A' && p !== 'Internal/General')
      .join(' › ');
    return loc ? `${path}  @  ${loc}` : path;
  };

  win.document.write(`
    <html><head><title>AuraTrack Export</title>
    <style>
      body { font-family: monospace; padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
      .symp-row td { border-top: none; color: #666; font-style: italic; font-size: 0.9em; background: #fafafa; }
    </style>
    </head><body>
    <h2>AuraTrack Event Log — ${new Date().toLocaleDateString()}</h2>
    <table>
      <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Duration</th><th>Notes</th></tr></thead>
      <tbody>
        ${events.map(e => {
          const syms = e.symptoms || [];
          const eventRow = `<tr><td>${e.date||''}</td><td>${e.time||''}</td><td>${e.type||''}</td><td>${e.duration||0}s</td><td>${(e.notes||'').replace(/\n/g,'<br>')}</td></tr>`;
          const sympRow = syms.length
            ? `<tr class="symp-row"><td colspan="5">${syms.map(fmtSymptomPath).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</td></tr>`
            : '';
          return eventRow + sympRow;
        }).join('')}
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

  const {
    personName = '', caretakerName = '', dateOfBirth = '', emergencyContact = '',
    neurologistName = '', neurologistInstitution = '', neurologistContact = '',
    includePatientDOB = true, reportNotes = '', userMode = 'CARETAKER',
  } = settings;

  // ── Date setup
  const now = Date.now();
  const DAY = 86400000;
  const periodStart = now - 30 * DAY;
  const generatedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const periodStartStr = new Date(periodStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const periodEndStr   = new Date(now).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const reporterLabel  = userMode === 'CARETAKER' ? caretakerName : personName;
  const subjectLabel   = userMode === 'CARETAKER' ? personName : 'Self';

  // ── Event sets
  const allSorted    = [...events].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  const periodEvents = allSorted.filter(e => (e.startTime || 0) >= periodStart);

  // Recent: last 10 events OR last 10 days — whichever is larger
  const last10       = allSorted.slice(0, 10);
  const last10days   = allSorted.filter(e => (e.startTime || 0) >= now - 10 * DAY);
  const recentEvents = last10days.length >= last10.length ? last10days : last10;

  // ── Summary stats (30-day period)
  const totalEvents = periodEvents.length;
  const byType = {};
  let totalDuration = 0;
  periodEvents.forEach(e => {
    byType[e.type || 'Uncategorized'] = (byType[e.type || 'Uncategorized'] || 0) + 1;
    totalDuration += (e.duration || 0);
  });
  const avgDuration = totalEvents ? Math.round(totalDuration / totalEvents) : 0;
  const daysCovered = new Set(periodEvents.map(e => e.date || '')).size;

  // ── Helpers
  const phaseDurs = (e) => {
    const m = e.manualDurations || {};
    return {
      aura:     m.aura     ?? (e.laps?.aura && e.startTime ? Math.round((e.laps.aura - e.startTime) / 1000) : 0),
      seizure:  m.seizure  ?? (e.laps?.aura && e.laps?.seizure ? Math.round((e.laps.seizure - e.laps.aura) / 1000) : 0),
      recovery: m.recovery ?? (e.laps?.seizure && e.laps?.recovery ? Math.round((e.laps.recovery - e.laps.seizure) / 1000) : 0),
    };
  };

  const fmtDur = (s) => {
    if (!s || s <= 0) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ── Awareness analysis (scan symptoms for Mental & Speech > Awareness)
  const awareness = { awake: 0, confused: 0, blackout: 0 };
  periodEvents.forEach(e => {
    (e.symptoms || []).forEach(s => {
      const sym = (s.symptom || s.detail || '').toLowerCase();
      if (sym.includes('awake') || sym.includes('fully'))       awareness.awake++;
      else if (sym.includes('confused') || sym.includes('dream')) awareness.confused++;
      else if (sym.includes('blackout') || sym.includes('loss')) awareness.blackout++;
    });
  });
  const awarenessTotal = awareness.awake + awareness.confused + awareness.blackout;

  // ── SECTION 2: Recent Events Table
  const recentRows = recentEvents.map((e, i) => {
    const d       = phaseDurs(e);
    const total   = e.manualDurations?.total ?? e.duration ?? 0;
    const hasNote = !!(e.notes && e.notes.trim());
    return `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="font-weight:700;color:#374151">${i + 1}</td>
      <td>${esc(e.date || '—')}</td>
      <td>${esc(e.time || '—')}</td>
      <td style="font-weight:700">${esc(e.type || 'Uncategorized')}</td>
      <td style="text-align:right;font-weight:700">${fmtDur(total)}</td>
      <td style="text-align:right;color:#d97706">${fmtDur(d.aura)}</td>
      <td style="text-align:right;color:#dc2626">${fmtDur(d.seizure)}</td>
      <td style="text-align:right;color:#3b82f6">${fmtDur(d.recovery)}</td>
      <td style="text-align:center">${hasNote ? '✓' : ''}</td>
      <td style="text-align:center">${e.isEdited ? '✎' : ''}</td>
    </tr>`;
  }).join('');

  // ── SECTION 4: Charts
  const chart1 = freqBarChartSVG(periodEvents, 30);
  const chart2 = durationLineSVG(periodEvents);
  const chart3 = typeBarSVG(byType, totalEvents);
  const chart4 = phaseStackSVG(periodEvents, 10);

  // ── SECTION 5: Condensed Event Details
  // last 3 overall + any period events >5min or edited, deduped
  const detailMap = new Map();
  const addDetail = (e) => { if (e?.id != null) detailMap.set(e.id, e); };
  allSorted.slice(0, 3).forEach(addDetail);
  periodEvents.filter(e => (e.duration || 0) > 300 || e.isEdited).forEach(addDetail);
  const detailEvents = [...detailMap.values()].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

  const detailBlocks = detailEvents.map(e => {
    const d     = phaseDurs(e);
    const total = e.manualDurations?.total ?? e.duration ?? 0;
    const badges = [
      (e.duration || 0) > 300   && `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">&gt;5 MIN</span>`,
      e.isEmergencyStop          && `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">AUTO-STOPPED</span>`,
      e.isEdited                 && `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">EDITED</span>`,
    ].filter(Boolean).join('');

    const sympRows = (e.symptoms || []).map(s => {
      const path = [s.symptom, s.detail].filter(Boolean).join(' › ');
      const loc = [s.region, s.subRegion, s.specificPart]
        .filter(p => p && p !== 'N/A' && p !== 'Internal/General')
        .join(' › ');
      return `<tr>
        <td style="color:#374151;padding:3px 5px">${esc(path || '—')}</td>
        <td style="color:#6b7280;font-style:italic;padding:3px 5px">${esc(s.med || '—')}</td>
        <td style="color:#6b7280;padding:3px 5px">${esc(loc || '—')}</td>
      </tr>`;
    }).join('');

    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <span style="font-weight:900;font-size:12px">${esc(e.date || '—')} at ${esc(e.time || '—')}</span>
          <span style="margin-left:8px;font-size:11px;color:#374151;font-weight:700">${esc(e.type || 'Uncategorized')}</span>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${badges}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">
        <div style="text-align:center;padding:5px;background:#f9fafb;border-radius:5px">
          <div style="font-size:8px;color:#9ca3af;text-transform:uppercase;font-weight:700">Total</div>
          <div style="font-size:12px;font-weight:900">${fmtDur(total)}</div>
        </div>
        <div style="text-align:center;padding:5px;background:#fffbeb;border-radius:5px">
          <div style="font-size:8px;color:#d97706;text-transform:uppercase;font-weight:700">Aura</div>
          <div style="font-size:12px;font-weight:900;color:#d97706">${fmtDur(d.aura)}</div>
        </div>
        <div style="text-align:center;padding:5px;background:#fef2f2;border-radius:5px">
          <div style="font-size:8px;color:#dc2626;text-transform:uppercase;font-weight:700">Seizure</div>
          <div style="font-size:12px;font-weight:900;color:#dc2626">${fmtDur(d.seizure)}</div>
        </div>
        <div style="text-align:center;padding:5px;background:#eff6ff;border-radius:5px">
          <div style="font-size:8px;color:#3b82f6;text-transform:uppercase;font-weight:700">Recovery</div>
          <div style="font-size:12px;font-weight:900;color:#3b82f6">${fmtDur(d.recovery)}</div>
        </div>
      </div>
      ${sympRows ? `<table style="border-collapse:collapse;width:100%;margin-bottom:6px">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:700">Symptom</th>
          <th style="padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:700">Medical Term</th>
          <th style="padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:700">Location</th>
        </tr></thead>
        <tbody>${sympRows}</tbody>
      </table>` : '<p style="font-size:10px;color:#9ca3af;margin:4px 0">No symptoms recorded</p>'}
      ${e.notes ? `<div style="margin-top:6px;padding:7px 9px;background:#f9fafb;border-radius:5px;font-size:10px;color:#374151;white-space:pre-wrap">${esc(e.notes)}</div>` : ''}
    </div>`;
  }).join('');

  // ── SECTION 5b: Full Symptom Log (all period events)
  const sympLogRows = periodEvents
    .filter(e => (e.symptoms || []).length > 0)
    .flatMap(e => e.symptoms.map(s => {
      const path = [s.symptom, s.detail].filter(Boolean).join(' › ');
      const loc = [s.region, s.subRegion, s.specificPart]
        .filter(p => p && p !== 'N/A' && p !== 'Internal/General')
        .join(' › ');
      return `<tr>
        <td>${esc(e.date || '—')}</td>
        <td>${esc(e.time || '—')}</td>
        <td style="font-weight:700">${esc(e.type || '—')}</td>
        <td>${esc(path)}</td>
        <td style="font-style:italic;color:#6b7280">${esc(s.med || '—')}</td>
        <td style="color:#6b7280">${esc(loc || '—')}</td>
      </tr>`;
    }))
    .join('');

  // ── SECTION 6: Clinical Flags
  const flags = [];

  const longList = periodEvents.filter(e => (e.duration || 0) > 300);
  if (longList.length > 0) {
    const items = longList.map(e => `${esc(e.date)} ${esc(e.time)} (${fmtDur(e.duration)})`).join('; ');
    flags.push(`<li><strong>Events exceeding 5 minutes (${longList.length}):</strong> ${items}</li>`);
  }

  const midPoint  = periodStart + 15 * DAY;
  const firstHalf = periodEvents.filter(e => (e.startTime || 0) < midPoint).length;
  const secHalf   = periodEvents.filter(e => (e.startTime || 0) >= midPoint).length;
  if (secHalf > firstHalf * 1.5 && secHalf > 1) {
    flags.push(`<li><strong>Increasing frequency:</strong> ${secHalf} events in the most recent 15 days vs. ${firstHalf} in the prior 15 days.</li>`);
  }

  const byTime = [...periodEvents].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  if (byTime.length >= 4) {
    const half = Math.floor(byTime.length / 2);
    const avgEarly  = byTime.slice(0, half).reduce((s, e) => s + (e.duration || 0), 0) / half;
    const avgRecent = byTime.slice(half).reduce((s, e) => s + (e.duration || 0), 0) / (byTime.length - half);
    if (avgRecent > avgEarly * 1.3) {
      flags.push(`<li><strong>Increasing duration trend:</strong> Recent avg ${fmtDur(Math.round(avgRecent))} vs. earlier avg ${fmtDur(Math.round(avgEarly))}.</li>`);
    }
  }

  const autoCount = periodEvents.filter(e => e.isEmergencyStop).length;
  if (autoCount > 0) {
    flags.push(`<li><strong>Auto-terminated events (${autoCount}):</strong> Timer stopped automatically at 12 min due to patient unresponsiveness — may indicate prolonged post-ictal state.</li>`);
  }

  const editedCount = periodEvents.filter(e => e.isEdited).length;
  if (editedCount > 0) {
    flags.push(`<li><strong>Edited records (${editedCount}):</strong> Phase durations or details were modified after initial recording — may differ from real-time capture.</li>`);
  }

  const flagsHtml = flags.length
    ? `<ul style="margin:0;padding-left:16px;font-size:11px;color:#111827;line-height:1.8">${flags.join('')}</ul>`
    : `<p style="color:#059669;font-size:11px;font-weight:700;margin:0">&#10003; No clinical flags detected in this reporting period.</p>`;

  // ── SECTION 7: Data Quality
  const fullyRecorded  = periodEvents.filter(e => e.isComplete && e.laps?.aura && e.laps?.seizure && e.laps?.recovery).length;
  const partialRecorded = periodEvents.filter(e => e.isComplete && !(e.laps?.aura && e.laps?.seizure && e.laps?.recovery)).length;
  const untagged        = periodEvents.filter(e => !e.isComplete).length;
  const autoStopped     = periodEvents.filter(e => e.isEmergencyStop).length;
  const edited          = periodEvents.filter(e => e.isEdited).length;
  const fullyPct        = totalEvents ? Math.round(fullyRecorded / totalEvents * 100) : 0;
  const conf = fullyPct >= 80
    ? { label: 'HIGH',   color: '#059669', bg: '#d1fae5' }
    : fullyPct >= 50
    ? { label: 'MEDIUM', color: '#d97706', bg: '#fef3c7' }
    : { label: 'LOW',    color: '#dc2626', bg: '#fee2e2' };

  // ── Write HTML ────────────────────────────────────────────────

  win.document.write(`<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <title>AuraTrack Neurological Report — ${esc(personName || 'Patient')}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111827; margin: 0; padding: 0; line-height: 1.4; }
    h2 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; margin: 0 0 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1e293b; color: #fff; padding: 6px 7px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; font-size: 10px; vertical-align: top; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .chart-wrap { margin-bottom: 10px; }
    .chart-wrap svg { width: 100%; height: auto; display: block; }
    .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 14px; }
    .stat-card { background: #1e293b; border-radius: 6px; padding: 10px 8px; text-align: center; color: #fff; }
    .stat-value { font-size: 20px; font-weight: 900; font-family: monospace; }
    .stat-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-top: 2px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .meta-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 9px 11px; }
    .meta-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 700; }
    .meta-value { font-size: 12px; font-weight: 800; color: #111827; margin-top: 2px; }
    .meta-sm { font-size: 10px; color: #374151; margin-top: 1px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #dc2626; margin-bottom: 14px; }
    .ctx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ctx-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .ctx-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.06em; }
    .ctx-value { font-size: 10px; font-weight: 600; color: #374151; margin-top: 2px; }
    .qual-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }
    .qual-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
    .qual-num { font-size: 18px; font-weight: 900; font-family: monospace; color: #1e293b; }
    .qual-label { font-size: 8px; text-transform: uppercase; color: #9ca3af; font-weight: 700; margin-top: 2px; }
    .disclaimer { font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 14px; }
    @media print { .section { page-break-inside: avoid; } }
  </style>
  </head><body>

  <!-- HEADER -->
  <div class="header">
    <div>
      <div style="font-size:9px;font-weight:900;letter-spacing:0.4em;color:#dc2626;text-transform:uppercase">AuraTrack</div>
      <div style="font-size:18px;font-weight:900;margin-top:2px;letter-spacing:-0.3px">Neurological Report</div>
      <div style="font-size:9px;color:#6b7280;margin-top:4px">Generated: ${generatedDate}</div>
      <div style="font-size:9px;color:#6b7280">Period: ${periodStartStr} – ${periodEndStr} (30 days)</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;color:#6b7280;margin-bottom:1px">Prepared by</div>
      <div style="font-weight:800;font-size:11px">${esc(reporterLabel || '—')}</div>
      ${neurologistName ? `<div style="font-size:9px;color:#374151;margin-top:4px">For: <strong>${esc(neurologistName)}</strong></div>` : ''}
      ${neurologistInstitution ? `<div style="font-size:9px;color:#6b7280">${esc(neurologistInstitution)}</div>` : ''}
      ${neurologistContact ? `<div style="font-size:9px;color:#6b7280">${esc(neurologistContact)}</div>` : ''}
    </div>
  </div>

  <!-- PATIENT BLOCK -->
  <div class="meta-grid">
    <div class="meta-card">
      <div class="meta-label">Patient</div>
      <div class="meta-value">${esc(subjectLabel || '—')}</div>
      ${includePatientDOB && dateOfBirth ? `<div class="meta-sm">DOB: ${new Date(dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
      ${emergencyContact ? `<div class="meta-sm">Emergency: ${esc(emergencyContact)}</div>` : ''}
    </div>
    <div class="meta-card">
      <div class="meta-label">Report Summary</div>
      <div class="meta-sm" style="margin-top:3px"><strong>${totalEvents}</strong> event${totalEvents !== 1 ? 's' : ''} in 30-day period</div>
      <div class="meta-sm"><strong>${daysCovered}</strong> day${daysCovered !== 1 ? 's' : ''} with recorded events</div>
      <div class="meta-sm">Avg duration: <strong>${fmtDur(avgDuration)}</strong></div>
    </div>
  </div>

  <!-- STATS GRID -->
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-value">${totalEvents}</div><div class="stat-label">Events (30d)</div></div>
    <div class="stat-card"><div class="stat-value">${fmtDur(avgDuration) === '—' ? '0s' : fmtDur(avgDuration)}</div><div class="stat-label">Avg Duration</div></div>
    <div class="stat-card"><div class="stat-value">${daysCovered}</div><div class="stat-label">Days Affected</div></div>
    <div class="stat-card"><div class="stat-value">${Object.keys(byType).length}</div><div class="stat-label">Seizure Types</div></div>
  </div>

  <!-- SECTION 2: RECENT EVENTS TABLE -->
  <div class="section">
    <h2>Recent Events (last ${recentEvents.length})</h2>
    <table>
      <thead><tr>
        <th>#</th><th>Date</th><th>Time</th><th>Type</th>
        <th style="text-align:right">Total</th>
        <th style="text-align:right">Aura</th>
        <th style="text-align:right">Seizure</th>
        <th style="text-align:right">Recovery</th>
        <th style="text-align:center">Notes</th>
        <th style="text-align:center">Edited</th>
      </tr></thead>
      <tbody>${recentRows || '<tr><td colspan="10" style="color:#9ca3af">No events recorded</td></tr>'}</tbody>
    </table>
  </div>

  <!-- SECTION 3: MEDICATION & CONTEXT -->
  <div class="section">
    <h2>Medication &amp; Clinical Context</h2>
    <div class="ctx-grid">
      <div class="ctx-item">
        <div class="ctx-label">Awareness Levels (30-day period)</div>
        <div class="ctx-value">
          ${awarenessTotal > 0
            ? `Fully awake: ${awareness.awake} &nbsp;|&nbsp; Confused: ${awareness.confused} &nbsp;|&nbsp; Blackout: ${awareness.blackout}`
            : '<span style="color:#9ca3af">Not recorded</span>'}
        </div>
      </div>
      <div class="ctx-item">
        <div class="ctx-label">Recovery Quality</div>
        <div class="ctx-value" style="color:#9ca3af">Not recorded</div>
      </div>
      <div class="ctx-item">
        <div class="ctx-label">Rescue Medication Use</div>
        <div class="ctx-value" style="color:#9ca3af">Not recorded</div>
      </div>
      <div class="ctx-item">
        <div class="ctx-label">Triggers / Medications (from report notes)</div>
        <div class="ctx-value">${reportNotes
          ? esc(reportNotes.length > 140 ? reportNotes.slice(0, 140) + '…' : reportNotes)
          : '<span style="color:#9ca3af">Not recorded</span>'}</div>
      </div>
    </div>
  </div>

  <!-- SECTION 4: TREND ANALYSIS -->
  <div class="section">
    <h2>Trend Analysis</h2>
    <div class="chart-wrap">${chart1}</div>
    <div class="chart-wrap">${chart2}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="chart-wrap">${chart3}</div>
      <div class="chart-wrap">${chart4}</div>
    </div>
  </div>

  <!-- SECTION 5: CONDENSED EVENT DETAILS -->
  <div class="section">
    <h2>Condensed Event Details</h2>
    ${detailBlocks || '<p style="color:#9ca3af;font-size:11px;margin:0">No events to display.</p>'}
  </div>

  <!-- SECTION 5b: FULL SYMPTOM LOG -->
  <div class="section">
    <h2>Ictal Symptom Log — All Period Events</h2>
    ${sympLogRows ? `<table>
      <thead><tr>
        <th>Date</th><th>Time</th><th>Type</th>
        <th>Symptom Path</th><th>Medical Term</th><th>Location</th>
      </tr></thead>
      <tbody>${sympLogRows}</tbody>
    </table>` : '<p style="color:#9ca3af;font-size:11px;margin:0">No symptoms recorded in this period.</p>'}
  </div>

  <!-- SECTION 6: CLINICAL FLAGS -->
  <div class="section">
    <h2>Clinical Flags</h2>
    ${flagsHtml}
  </div>

  <!-- SECTION 7: DATA QUALITY -->
  <div class="section">
    <h2>Data Quality &amp; Confidence</h2>
    <div style="margin-bottom:10px">
      <span style="padding:4px 10px;border-radius:4px;font-size:10px;font-weight:900;background:${conf.bg};color:${conf.color}">
        CONFIDENCE: ${conf.label} (${fullyPct}% fully recorded)
      </span>
    </div>
    <div class="qual-grid">
      <div class="qual-item"><div class="qual-num">${fullyRecorded}</div><div class="qual-label">Fully Recorded</div></div>
      <div class="qual-item"><div class="qual-num">${partialRecorded}</div><div class="qual-label">Partial</div></div>
      <div class="qual-item"><div class="qual-num">${untagged}</div><div class="qual-label">Untagged</div></div>
      <div class="qual-item"><div class="qual-num">${autoStopped}</div><div class="qual-label">Auto-Stopped</div></div>
      <div class="qual-item"><div class="qual-num">${edited}</div><div class="qual-label">Edited</div></div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    This report was generated by AuraTrack v0.1.0, a personal seizure-logging PWA. All data was entered by the caretaker or patient.
    This document is not a substitute for professional medical assessment. Times and durations are based on manual input.
    Phase durations marked as edited may differ from real-time capture.
  </div>

  <script>window.onload = () => window.print();</script>
  </body></html>`);
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
