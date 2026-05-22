export const formatDuration = (seconds) => {
  const safe = typeof seconds === 'number' && isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const formatCSVRow = (event) =>
  [event.id, event.date, event.time, event.type, event.duration, `"${(event.notes || '').replace(/"/g, '""')}"`].join(',');
