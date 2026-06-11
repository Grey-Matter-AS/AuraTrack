export const formatEventDate = (startTime, dateFormat = 'locale') => {
  if (!startTime) return '—';
  const d = new Date(startTime);
  switch (dateFormat) {
    case 'ISO': return d.toISOString().slice(0, 10);
    case 'US':  return d.toLocaleDateString('en-US');
    case 'EU':  return d.toLocaleDateString('en-GB');
    default:    return d.toLocaleDateString();
  }
};

export const formatEventTime = (startTime, timeFormat = '12h') => {
  if (!startTime) return '—';
  return new Date(startTime).toLocaleTimeString(
    timeFormat === '24h' ? 'en-GB' : 'en-US',
    { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' }
  );
};

export const formatDuration = (seconds) => {
  const safe = typeof seconds === 'number' && isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const formatCSVField = (value) => {
  const raw = value == null ? '' : String(value);
  const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

export const formatCSVRow = (event) => {
  const postIctalFindings = Array.isArray(event.postIctal?.findings) ? event.postIctal.findings.join('|') : '';
  const postIctalParalysisLocations = Array.isArray(event.postIctal?.paralysisLocations)
    ? event.postIctal.paralysisLocations
      .map((location) => [location.region, location.subRegion, location.specificPart].filter(Boolean).join(' > '))
      .join('|')
    : '';

  return [
    event.id,
    event.date,
    event.time,
    event.type,
    event.duration,
    event.notes || '',
    postIctalFindings,
    postIctalParalysisLocations,
  ]
    .map(formatCSVField)
    .join(',');
};
