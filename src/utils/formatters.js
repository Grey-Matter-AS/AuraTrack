export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const formatDateTime = (ts) => new Date(ts).toLocaleString();

export const formatCSVRow = (event) =>
  [event.id, event.date, event.time, event.type, event.duration, `"${(event.notes || '').replace(/"/g, '""')}"`].join(',');
