import { formatCSVField, formatCSVRow } from './formatters';
import { freqBarChartSVG, durationLineSVG, typeBarSVG, phaseStackSVG } from './pdfCharts';
import { esc } from './htmlEscape';
import { phaseDurs } from './phaseCalculations';
import i18n from '../i18n';
import pkg from '../../package.json';

export const filterEventsByDateRange = (events, fromDateStr, toDateStr) => {
  const from = fromDateStr ? new Date(fromDateStr).setHours(0, 0, 0, 0) : 0;
  const to   = toDateStr   ? new Date(toDateStr).setHours(23, 59, 59, 999) : Date.now();
  return events.filter(e => e.startTime >= from && e.startTime <= to);
};

export const exportToJSON = async (events, medications = [], medicationLogs = []) => {
  const payload = {
    version: 6,
    exportedAt: Date.now(),
    events,
    medications,
    medicationLogs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  return saveFileNative(blob, `auratrack-backup-${dateStamp()}.json`, 'AuraTrack Backup', ['.json']);
};

export const exportToCSV = async (events, medications = [], medicationLogs = []) => {
  const header = 'id,date,time,type,duration,notes';
  const rows = events.map(formatCSVRow).join('\n');

  let csv = `${header}\n${rows}`;

  if (medications.length > 0) {
    csv += '\n\nMEDICATIONS\nid,name,dose,unit,frequency,scheduledTimes,isRescue,reminderEnabled,showInEmergency,active\n';
    csv += medications.map(m =>
      [m.id, m.name, m.dose, m.unit, m.frequency,
       (m.scheduledTimes || []).join('|'), m.isRescue ? 1 : 0,
       m.reminderEnabled ? 1 : 0, m.showInEmergency ? 1 : 0, m.active ? 1 : 0]
        .map(formatCSVField)
        .join(',')
    ).join('\n');
  }

  if (medicationLogs.length > 0) {
    csv += '\n\nMEDICATION_LOGS\nid,medicationId,takenAt,scheduledTime,status,note,isEdited\n';
    csv += medicationLogs.map(l =>
      [l.id, l.medicationId, l.takenAt, l.scheduledTime ?? '', l.status ?? '', l.note ?? '', l.isEdited ? 1 : 0]
        .map(formatCSVField)
        .join(',')
    ).join('\n');
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  return saveFileNative(blob, `auratrack-events-${dateStamp()}.csv`, 'AuraTrack CSV Export', ['.csv']);
};

export const buildEventTablePreview = (events) => {
  const locale = getCurrentLocale();
  const t = (key, options) => i18n.t(key, options);

  const fmtSymptomPath = (s) => {
    const path = [s.symptom, s.detail].filter(Boolean).join(' › ');
    const loc = [s.region, s.subRegion, s.specificPart]
      .filter(p => p && p !== 'N/A' && p !== 'Internal/General')
      .join(' › ');
    return esc(loc ? `${path}  @  ${loc}` : path);
  };

  const styles = buildPreviewStyles(`
    .auratrack-simple-report {
      font-family: 'SFMono-Regular', 'Cascadia Mono', 'Roboto Mono', monospace;
      color: #111827;
      font-size: 12px;
    }
    .auratrack-simple-report h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.02em;
    }
    .auratrack-simple-report table { border-collapse: collapse; width: 100%; }
    .auratrack-simple-report td,
    .auratrack-simple-report th {
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }
    .auratrack-simple-report th {
      background: #111827;
      color: #fff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .auratrack-simple-report .symp-row td {
      border-top: none;
      color: #4b5563;
      font-style: italic;
      font-size: 11px;
      background: #f9fafb;
    }
  `);

  const html = `
    <div class="auratrack-simple-report">
      <h2>${esc(t('export.docs.event_log_title'))} - ${new Date().toLocaleDateString(locale)}</h2>
      <table>
        <thead><tr><th>${esc(t('export.docs.date'))}</th><th>${esc(t('export.docs.time'))}</th><th>${esc(t('export.docs.type'))}</th><th>${esc(t('export.docs.duration'))}</th><th>${esc(t('export.docs.notes'))}</th></tr></thead>
        <tbody>
          ${events.map(e => {
            const syms = e.symptoms || [];
            const escapedNotes = esc(e.notes || '').replace(/\n/g, '<br>');
            const eventRow = `<tr><td>${esc(e.date || '')}</td><td>${esc(e.time || '')}</td><td>${esc(e.type || '')}</td><td>${e.duration || 0}s</td><td>${escapedNotes}</td></tr>`;
            const sympRow = syms.length
              ? `<tr class="symp-row"><td colspan="5">${syms.map(fmtSymptomPath).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</td></tr>`
              : '';
            return eventRow + sympRow;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  return {
    title: `${t('export.pdf_label')} - ${new Date().toLocaleDateString(locale)}`,
    styles,
    html,
  };
};

// ─── Clinical Neurologist Report ─────────────────────────────

export const buildNeurologistReportPreview = (events, settings = {}, medications = [], medicationLogs = []) => {
  const locale = getCurrentLocale();
  const t = (key, options) => i18n.t(key, options);
  const {
    personName = '', caretakerName = '', dateOfBirth = '', emergencyContact = '',
    neurologistName = '', neurologistInstitution = '', neurologistContact = '',
    includePatientDOB = true, reportNotes = '', userMode = 'CARETAKER',
  } = settings;

  // ── Date setup
  const now = Date.now();
  const DAY = 86400000;
  const periodStart = now - 30 * DAY;
  const generatedDate = new Date().toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  const periodStartStr = new Date(periodStart).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const periodEndStr   = new Date(now).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
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
  const fmtDur = (s) => {
    if (!s || s <= 0) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };
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
  const recByTag = (mode) => {
    if (!mode) return '';
    return mode === 'CARETAKER'
      ? `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 4px;border-radius:3px;font-size:8px;font-weight:800">CT</span>`
      : `<span style="background:#d1fae5;color:#065f46;padding:1px 4px;border-radius:3px;font-size:8px;font-weight:800">SE</span>`;
  };

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
      <td style="text-align:center">${recByTag(e.userModeAtTime)}</td>
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
    const triggerBadges = (e.triggers || []).map(t =>
      `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700">${esc(t)}</span>`
    ).join('');
    const badges = [
      (e.duration || 0) > 300   && `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">&gt;5 MIN</span>`,
      e.isEmergencyStop          && `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">AUTO-STOPPED</span>`,
      e.isEdited                 && `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">EDITED</span>`,
      triggerBadges,
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
          <span style="font-weight:900;font-size:12px">${esc(e.date || '—')} ${esc(t('export.docs.at'))} ${esc(e.time || '—')}</span>
          <span style="margin-left:8px;font-size:11px;color:#374151;font-weight:700">${esc(e.type || 'Uncategorized')}</span>
          ${e.userModeAtTime ? `<span style="margin-left:6px">${recByTag(e.userModeAtTime)}</span>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${badges}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">
        <div style="text-align:center;padding:5px;background:#f9fafb;border-radius:5px">
          <div style="font-size:8px;color:#9ca3af;text-transform:uppercase;font-weight:700">${esc(t('export.docs.total'))}</div>
          <div style="font-size:12px;font-weight:900">${fmtDur(total)}</div>
        </div>
        <div style="text-align:center;padding:5px;background:#fffbeb;border-radius:5px">
          <div style="font-size:8px;color:#d97706;text-transform:uppercase;font-weight:700">${esc(t('export.docs.aura'))}</div>
          <div style="font-size:12px;font-weight:900;color:#d97706">${fmtDur(d.aura)}</div>
        </div>
        <div style="text-align:center;padding:5px;background:#fef2f2;border-radius:5px">
          <div style="font-size:8px;color:#dc2626;text-transform:uppercase;font-weight:700">${esc(t('export.docs.seizure'))}</div>
          <div style="font-size:12px;font-weight:900;color:#dc2626">${fmtDur(d.seizure)}</div>
        </div>
        <div style="text-align:center;padding:5px;background:#eff6ff;border-radius:5px">
          <div style="font-size:8px;color:#3b82f6;text-transform:uppercase;font-weight:700">${esc(t('export.docs.recovery'))}</div>
          <div style="font-size:12px;font-weight:900;color:#3b82f6">${fmtDur(d.recovery)}</div>
        </div>
      </div>
      ${sympRows ? `<table style="border-collapse:collapse;width:100%;margin-bottom:6px">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:700">${esc(t('export.docs.symptom'))}</th>
          <th style="padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:700">${esc(t('export.docs.medical_term'))}</th>
          <th style="padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:700">${esc(t('export.docs.location'))}</th>
        </tr></thead>
        <tbody>${sympRows}</tbody>
      </table>` : `<p style="font-size:10px;color:#9ca3af;margin:4px 0">${esc(t('export.docs.no_symptoms_recorded'))}</p>`}
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

  // Aggregate trigger stats
  const triggerCounts = {};
  periodEvents.forEach(e => {
    (e.triggers || []).forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; });
  });
  const topTriggers = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topTriggers.length > 0) {
    const items = topTriggers.map(([t, n]) => `${esc(t)} (${n}×)`).join(', ');
    flags.push(`<li><strong>Reported triggers (${periodEvents.filter(e => (e.triggers||[]).length > 0).length} events with triggers):</strong> ${items}</li>`);
  }

  const flagsHtml = flags.length
    ? `<ul style="margin:0;padding-left:16px;font-size:11px;color:#111827;line-height:1.8">${flags.join('')}</ul>`
    : `<p style="color:#059669;font-size:11px;font-weight:700;margin:0">&#10003; ${esc(t('export.docs.no_clinical_flags'))}</p>`;

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

  // ── Medication section HTML
  const FREQ_SHORT = { OD: 'Once daily', BD: 'Twice daily', TDS: 'Three times daily', QDS: 'Four times daily', PRN: 'As needed (rescue)' };
  const medRows = medications.map(m =>
    `<tr><td style="font-weight:700">${esc(m.name)}</td><td>${esc(m.dose)}${esc(m.unit)}</td><td>${esc(m.frequency)} - ${esc(FREQ_SHORT[m.frequency] || m.frequency)}</td></tr>`
  ).join('');

  // Adherence: count logs vs. expected doses (OD=1, BD=2, TDS=3, QDS=4, PRN=variable)
  const freqPerDay = { OD: 1, BD: 2, TDS: 3, QDS: 4, PRN: 0 };
  const expectedDoses = medications.reduce((sum, m) => sum + (freqPerDay[m.frequency] || 0) * 30, 0);
  const medSection = medications.length > 0 ? `
  <div class="section">
    <h2>${esc(t('export.docs.current_medications'))}</h2>
    <table>
      <thead><tr><th>${esc(t('export.docs.drug'))}</th><th>${esc(t('export.docs.dose'))}</th><th>${esc(t('export.docs.frequency'))}</th></tr></thead>
      <tbody>${medRows}</tbody>
    </table>
    ${medicationLogs.length > 0
      ? `<p style="font-size:10px;color:#374151;margin-top:8px"><strong>${esc(t('export.docs.doses_logged', { count: medicationLogs.length }))}</strong>${expectedDoses > 0 ? ` ${esc(t('export.docs.expected_doses', { count: expectedDoses }))}` : ''}.</p>`
      : `<p style="font-size:10px;color:#9ca3af;margin-top:8px">${esc(t('export.docs.no_dose_logs'))}</p>`
    }
  </div>` : '';

  const title = `${t('export.neuro_report_label')} - ${personName || t('export.docs.patient')}`;
  const styles = buildPreviewStyles(`
    .auratrack-neuro-report,
    .auratrack-neuro-report * { box-sizing: border-box; }
    .auratrack-neuro-report {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #111827;
      line-height: 1.4;
    }
    .auratrack-neuro-report h2 {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #374151;
      margin: 0 0 10px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .auratrack-neuro-report table { border-collapse: collapse; width: 100%; }
    .auratrack-neuro-report th {
      background: #1e293b;
      color: #fff;
      padding: 6px 7px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .auratrack-neuro-report td {
      padding: 5px 7px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10px;
      vertical-align: top;
    }
    .auratrack-neuro-report .section { margin-bottom: 20px; page-break-inside: avoid; }
    .auratrack-neuro-report .chart-wrap { margin-bottom: 10px; }
    .auratrack-neuro-report .chart-wrap svg { width: 100%; height: auto; display: block; }
    .auratrack-neuro-report .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 14px; }
    .auratrack-neuro-report .stat-card { background: #1e293b; border-radius: 6px; padding: 10px 8px; text-align: center; color: #fff; }
    .auratrack-neuro-report .stat-value { font-size: 20px; font-weight: 900; font-family: monospace; }
    .auratrack-neuro-report .stat-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-top: 2px; }
    .auratrack-neuro-report .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .auratrack-neuro-report .meta-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 9px 11px; }
    .auratrack-neuro-report .meta-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 700; }
    .auratrack-neuro-report .meta-value { font-size: 12px; font-weight: 800; color: #111827; margin-top: 2px; }
    .auratrack-neuro-report .meta-sm { font-size: 10px; color: #374151; margin-top: 1px; }
    .auratrack-neuro-report .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #dc2626; margin-bottom: 14px; }
    .auratrack-neuro-report .ctx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .auratrack-neuro-report .ctx-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .auratrack-neuro-report .ctx-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.06em; }
    .auratrack-neuro-report .ctx-value { font-size: 10px; font-weight: 600; color: #374151; margin-top: 2px; }
    .auratrack-neuro-report .qual-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }
    .auratrack-neuro-report .qual-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
    .auratrack-neuro-report .qual-num { font-size: 18px; font-weight: 900; font-family: monospace; color: #1e293b; }
    .auratrack-neuro-report .qual-label { font-size: 8px; text-transform: uppercase; color: #9ca3af; font-weight: 700; margin-top: 2px; }
    .auratrack-neuro-report .disclaimer { font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 14px; }
  `);

  const html = `
  <div class="auratrack-neuro-report">
  <div class="header">
    <div>
      <div style="font-size:9px;font-weight:900;letter-spacing:0.4em;color:#dc2626;text-transform:uppercase">AuraTrack</div>
      <div style="font-size:18px;font-weight:900;margin-top:2px;letter-spacing:-0.3px">${esc(t('export.docs.neurological_report'))}</div>
      <div style="font-size:9px;color:#6b7280;margin-top:4px">${esc(t('export.docs.generated'))}: ${generatedDate}</div>
      <div style="font-size:9px;color:#6b7280">${esc(t('export.docs.period'))}: ${periodStartStr} – ${periodEndStr} (${esc(t('export.docs.last_30_days'))})</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;color:#6b7280;margin-bottom:1px">${esc(t('export.docs.prepared_by'))}</div>
      <div style="font-weight:800;font-size:11px">${esc(reporterLabel || '—')}</div>
      ${neurologistName ? `<div style="font-size:9px;color:#374151;margin-top:4px">${esc(t('export.docs.for_label'))}: <strong>${esc(neurologistName)}</strong></div>` : ''}
      ${neurologistInstitution ? `<div style="font-size:9px;color:#6b7280">${esc(neurologistInstitution)}</div>` : ''}
      ${neurologistContact ? `<div style="font-size:9px;color:#6b7280">${esc(neurologistContact)}</div>` : ''}
    </div>
  </div>

  <!-- PATIENT BLOCK -->
  <div class="meta-grid">
    <div class="meta-card">
      <div class="meta-label">${esc(t('export.docs.patient'))}</div>
      <div class="meta-value">${esc(subjectLabel || '—')}</div>
      ${includePatientDOB && dateOfBirth ? `<div class="meta-sm">${esc(t('export.docs.dob'))}: ${new Date(dateOfBirth).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
      ${emergencyContact ? `<div class="meta-sm">${esc(t('export.docs.emergency'))}: ${esc(emergencyContact)}</div>` : ''}
    </div>
    <div class="meta-card">
      <div class="meta-label">${esc(t('export.docs.report_summary'))}</div>
      <div class="meta-sm" style="margin-top:3px"><strong>${totalEvents}</strong> ${esc(t('export.docs.events_in_period', { count: totalEvents }))}</div>
      <div class="meta-sm"><strong>${daysCovered}</strong> ${esc(t('export.docs.days_with_recorded_events', { count: daysCovered }))}</div>
      <div class="meta-sm">${esc(t('export.docs.avg_duration'))}: <strong>${fmtDur(avgDuration)}</strong></div>
    </div>
  </div>

  <!-- STATS GRID -->
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-value">${totalEvents}</div><div class="stat-label">${esc(t('export.docs.events_30d'))}</div></div>
    <div class="stat-card"><div class="stat-value">${fmtDur(avgDuration) === '—' ? '0s' : fmtDur(avgDuration)}</div><div class="stat-label">${esc(t('export.docs.avg_duration'))}</div></div>
    <div class="stat-card"><div class="stat-value">${daysCovered}</div><div class="stat-label">${esc(t('export.docs.days_affected'))}</div></div>
    <div class="stat-card"><div class="stat-value">${Object.keys(byType).length}</div><div class="stat-label">${esc(t('export.docs.seizure_types'))}</div></div>
  </div>

  ${medSection}

  <!-- SECTION 2: RECENT EVENTS TABLE -->
  <div class="section">
    <h2>${esc(t('export.docs.recent_events', { count: recentEvents.length }))}</h2>
    <table>
      <thead><tr>
        <th>#</th><th>${esc(t('export.docs.date'))}</th><th>${esc(t('export.docs.time'))}</th><th>${esc(t('export.docs.type'))}</th>
        <th style="text-align:right">${esc(t('export.docs.total'))}</th>
        <th style="text-align:right">${esc(t('export.docs.aura'))}</th>
        <th style="text-align:right">${esc(t('export.docs.seizure'))}</th>
        <th style="text-align:right">${esc(t('export.docs.recovery'))}</th>
        <th style="text-align:center">${esc(t('export.docs.notes'))}</th>
        <th style="text-align:center">${esc(t('export.docs.edited'))}</th>
        <th style="text-align:center">${esc(t('export.docs.recorded_by'))}</th>
      </tr></thead>
      <tbody>${recentRows || `<tr><td colspan="11" style="color:#9ca3af">${esc(t('export.docs.no_events_recorded'))}</td></tr>`}</tbody>
    </table>
  </div>

  <!-- SECTION 3: MEDICATION & CONTEXT -->
  <div class="section">
    <h2>${esc(t('export.docs.medication_context'))}</h2>
    <div class="ctx-grid">
      <div class="ctx-item">
        <div class="ctx-label">${esc(t('export.docs.awareness_levels'))}</div>
        <div class="ctx-value">
          ${awarenessTotal > 0
            ? `${esc(t('export.docs.fully_awake'))}: ${awareness.awake} &nbsp;|&nbsp; ${esc(t('export.docs.confused'))}: ${awareness.confused} &nbsp;|&nbsp; ${esc(t('export.docs.blackout'))}: ${awareness.blackout}`
            : `<span style="color:#9ca3af">${esc(t('export.docs.not_recorded'))}</span>`}
        </div>
      </div>
      <div class="ctx-item">
        <div class="ctx-label">${esc(t('export.docs.recovery_quality'))}</div>
        <div class="ctx-value" style="color:#9ca3af">${esc(t('export.docs.not_recorded'))}</div>
      </div>
      <div class="ctx-item">
        <div class="ctx-label">${esc(t('export.docs.rescue_medication_use'))}</div>
        <div class="ctx-value" style="color:#9ca3af">${esc(t('export.docs.not_recorded'))}</div>
      </div>
      <div class="ctx-item">
        <div class="ctx-label">${esc(t('export.docs.triggers_medications'))}</div>
        <div class="ctx-value">${reportNotes
          ? esc(reportNotes.length > 140 ? reportNotes.slice(0, 140) + '…' : reportNotes)
          : `<span style="color:#9ca3af">${esc(t('export.docs.not_recorded'))}</span>`}</div>
      </div>
    </div>
  </div>

  <!-- SECTION 4: TREND ANALYSIS -->
  <div class="section">
    <h2>${esc(t('export.docs.trend_analysis'))}</h2>
    <div class="chart-wrap">${chart1}</div>
    <div class="chart-wrap">${chart2}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="chart-wrap">${chart3}</div>
      <div class="chart-wrap">${chart4}</div>
    </div>
  </div>

  <!-- SECTION 5: CONDENSED EVENT DETAILS -->
  <div class="section">
    <h2>${esc(t('export.docs.condensed_event_details'))}</h2>
    ${detailBlocks || `<p style="color:#9ca3af;font-size:11px;margin:0">${esc(t('export.docs.no_events_to_display'))}</p>`}
  </div>

  <!-- SECTION 5b: FULL SYMPTOM LOG -->
  <div class="section">
    <h2>${esc(t('export.docs.ictal_symptom_log'))}</h2>
    ${sympLogRows ? `<table>
      <thead><tr>
        <th>${esc(t('export.docs.date'))}</th><th>${esc(t('export.docs.time'))}</th><th>${esc(t('export.docs.type'))}</th>
        <th>${esc(t('export.docs.symptom_path'))}</th><th>${esc(t('export.docs.medical_term'))}</th><th>${esc(t('export.docs.location'))}</th>
      </tr></thead>
      <tbody>${sympLogRows}</tbody>
    </table>` : `<p style="color:#9ca3af;font-size:11px;margin:0">${esc(t('export.docs.no_symptoms_period'))}</p>`}
  </div>

  <!-- SECTION 6: CLINICAL FLAGS -->
  <div class="section">
    <h2>${esc(t('export.docs.clinical_flags'))}</h2>
    ${flagsHtml}
  </div>

  <!-- SECTION 7: DATA QUALITY -->
  <div class="section">
    <h2>${esc(t('export.docs.data_quality_confidence'))}</h2>
    <div style="margin-bottom:10px">
      <span style="padding:4px 10px;border-radius:4px;font-size:10px;font-weight:900;background:${conf.bg};color:${conf.color}">
        ${esc(t('export.docs.confidence_label'))}: ${conf.label} (${fullyPct}% ${esc(t('export.docs.fully_recorded').toLowerCase())})
      </span>
    </div>
    <div class="qual-grid">
      <div class="qual-item"><div class="qual-num">${fullyRecorded}</div><div class="qual-label">${esc(t('export.docs.fully_recorded'))}</div></div>
      <div class="qual-item"><div class="qual-num">${partialRecorded}</div><div class="qual-label">${esc(t('export.docs.partial'))}</div></div>
      <div class="qual-item"><div class="qual-num">${untagged}</div><div class="qual-label">${esc(t('export.docs.untagged'))}</div></div>
      <div class="qual-item"><div class="qual-num">${autoStopped}</div><div class="qual-label">${esc(t('export.docs.auto_stopped'))}</div></div>
      <div class="qual-item"><div class="qual-num">${edited}</div><div class="qual-label">${esc(t('export.docs.edited'))}</div></div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    ${esc(t('export.docs.disclaimer_intro', { version: pkg.version }))}<br>
    ${esc(t('export.docs.disclaimer_medical'))}<br>
    ${esc(t('export.docs.disclaimer_edited'))}
  </div>
  </div>`;

  return { title, styles, html };
};

// ─── Seizure Diary (one-page monthly calendar) ───────────────

export const buildSeizureDiaryPreview = (allEvents, settings = {}, medications = [], month, year) => {
  const locale = getCurrentLocale();
  const t = (key, options) => i18n.t(key, options);
  const patientName = settings.personName || settings.caretakerName || '';

  // Build a map of day-of-month → events for this month
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based here
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun

  // Map: day (1–31) → array of events
  const eventsByDay = {};
  allEvents.forEach(e => {
    const d = new Date(e.startTime || 0);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  });

  const totalEvents = Object.values(eventsByDay).reduce((n, arr) => n + arr.length, 0);

  // Type→colour + abbreviation mapping
  const TYPE_COLORS = {
    'Tonic-Clonic':    '#dc2626',
    'Focal Aware':     '#f59e0b',
    'Focal Impaired':  '#ef4444',
    'Absence':         '#3b82f6',
    'Aura Only':       '#a855f7',
  };
  const TYPE_ABBREV = {
    'Tonic-Clonic':   'TC',
    'Focal Aware':    'FA',
    'Focal Impaired': 'FI',
    'Absence':        'Ab',
    'Aura Only':      'Au',
    'Uncategorized':  '?',
  };
  const DEFAULT_COLOR = '#6b7280';

  const legendTypes = [...new Set(
    Object.values(eventsByDay).flat().map(e => e.type || 'Uncategorized')
  )];

  const legendHtml = legendTypes.map(t => {
    const color = TYPE_COLORS[t] || DEFAULT_COLOR;
    const abbrev = TYPE_ABBREV[t] || t.slice(0, 2);
    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:10px">
      <span style="background:${color};color:#fff;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:900">${abbrev}</span>${esc(t)}
    </span>`;
  }).join('');

  // Build calendar grid cells
  const startOffset = firstDayOfWeek; // 0=Sun
  const totalCells = startOffset + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  let cells = '';
  for (let cell = 0; cell < rows * 7; cell++) {
    const dayNum = cell - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells += `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;min-height:64px"></div>`;
      continue;
    }
    const dayEvents = eventsByDay[dayNum] || [];

    // Group by type, preserving insertion order for consistent rendering
    const typeCounts = {};
    dayEvents.forEach(e => {
      const t = e.type || 'Uncategorized';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const typeBadges = Object.entries(typeCounts).map(([type, count]) => {
      const color = TYPE_COLORS[type] || DEFAULT_COLOR;
      const abbrev = TYPE_ABBREV[type] || type.slice(0, 2);
      return `<div style="display:flex;align-items:center;gap:3px;margin-top:2px">
        <span style="background:${color};color:#fff;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:900;min-width:18px;text-align:center;line-height:1.4">${count}</span>
        <span style="font-size:8px;font-weight:800;color:${color}">${abbrev}</span>
      </div>`;
    }).join('');

    const hasTriggers = dayEvents.some(e => (e.triggers || []).length > 0);
    const triggerNote = hasTriggers
      ? `<div style="font-size:7px;color:#d97706;font-weight:800;margin-top:2px">▲ trigger</div>`
      : '';
    const bg = dayEvents.length > 0 ? '#fff' : '#f9fafb';
    const border = dayEvents.length > 0 ? '2px solid #fca5a5' : '1px solid #e5e7eb';
    cells += `<div style="background:${bg};border:${border};border-radius:6px;min-height:64px;padding:5px;display:flex;flex-direction:column">
      <span style="font-size:11px;font-weight:${dayEvents.length > 0 ? 900 : 400};color:${dayEvents.length > 0 ? '#111827' : '#9ca3af'}">${dayNum}</span>
      <div style="flex:1">${typeBadges}</div>
      ${triggerNote}
    </div>`;
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });
  const medLine = medications.length > 0
    ? `${t('export.docs.medications_label')}: ${medications.map(m => `${m.name} ${m.dose}${m.unit} ${m.frequency}`).join(' | ')}`
    : '';

  const styles = buildPreviewStyles(`
    @page { size: A4 landscape; margin: 12mm 14mm; }
    .auratrack-diary-preview,
    .auratrack-diary-preview * { box-sizing: border-box; }
    .auratrack-diary-preview {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #111827;
    }
  `);

  const html = `
    <div class="auratrack-diary-preview">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;border-bottom:3px solid #dc2626;padding-bottom:8px">
        <div>
          <div style="font-size:8px;font-weight:900;letter-spacing:0.4em;color:#dc2626;text-transform:uppercase">AuraTrack</div>
          <div style="font-size:20px;font-weight:900;letter-spacing:-0.3px">${esc(monthName)} - ${esc(t('export.diary_title'))}</div>
        </div>
        <div style="text-align:right">
          ${patientName ? `<div style="font-weight:800;font-size:12px">${esc(patientName)}</div>` : ''}
          <div style="font-size:10px;color:#6b7280">${esc(t('export.docs.events_recorded_this_month', { count: totalEvents }))}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
        ${getWeekdayLabels(locale).map(d =>
          `<div style="text-align:center;font-size:9px;font-weight:900;text-transform:uppercase;color:#6b7280;padding:3px 0">${d}</div>`
        ).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${cells}
      </div>

      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
        <div>
          <span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#9ca3af;margin-right:6px">${esc(t('export.docs.legend'))}:</span>
          ${legendHtml || `<span style="font-size:10px;color:#9ca3af">${esc(t('export.docs.no_events'))}</span>`}
          <span style="margin-left:6px;display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#d97706"><span style="font-weight:800">▲</span> ${esc(t('export.docs.trigger_reported'))}</span>
        </div>
        ${medLine ? `<div style="font-size:9px;color:#374151;max-width:400px">${esc(medLine)}</div>` : ''}
      </div>

      <div style="margin-top:6px;font-size:8px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:6px">
        ${esc(t('export.docs.diary_footer', { date: new Date().toLocaleDateString(locale) }))}
      </div>
    </div>
  `;

  return {
    title: `AuraTrack Seizure Diary - ${monthName}`,
    styles,
    html,
  };
};

// ─── Helpers ─────────────────────────────────────────────────

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function buildPreviewStyles(documentStyles) {
  return `
    @page { size: A4; margin: 18mm 16mm; }
    .auratrack-print-preview {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: #e5e7eb;
      display: flex;
      flex-direction: column;
    }
    .auratrack-print-preview-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
      background: #111827;
      color: #fff;
    }
    .auratrack-print-preview-document {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    .auratrack-print-preview-sheet {
      width: min(100%, 960px);
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
      padding: 24px;
    }
    ${documentStyles}
    @media print {
      body { background: #fff !important; }
      .auratrack-print-preview-toolbar { display: none !important; }
      .auratrack-print-preview {
        position: static !important;
        inset: auto !important;
        background: #fff !important;
        display: block !important;
      }
      .auratrack-print-preview-document {
        overflow: visible !important;
        padding: 0 !important;
      }
      .auratrack-print-preview-sheet {
        width: auto !important;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
    }
  `;
}

function getCurrentLocale() {
  return i18n.resolvedLanguage || i18n.language || 'en';
}

function getWeekdayLabels(locale) {
  const sunday = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) =>
    new Date(sunday.getTime() + index * 86400000)
      .toLocaleDateString(locale, { weekday: 'short' })
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function saveFileNative(blob, suggestedName, description, extensions) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [blob.type]: extensions } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, cancelled: false };
    } catch (e) {
      if (e.name === 'AbortError') return { ok: false, cancelled: true };
      // Fall through to legacy download on unexpected errors
    }
  }
  triggerDownload(blob, suggestedName);
  return { ok: true, cancelled: false };
}
