import { formatCSVRow } from './formatters';

export const filterEventsByDateRange = (events, days) => {
  if (!days) return events;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter(e => e.startTime >= cutoff);
};

export const exportToJSON = (events) => {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `auratrack-export-${dateStamp()}.json`);
};

export const exportToCSV = (events) => {
  const header = 'id,date,time,type,duration,notes';
  const rows = events.map(formatCSVRow).join('\n');
  const blob = new Blob([`${header}\n${rows}`], { type: 'text/csv' });
  triggerDownload(blob, `auratrack-export-${dateStamp()}.csv`);
};

export const exportToPDF = (events) => {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html><head><title>AuraTrack Export</title>
    <style>body{font-family:monospace;padding:20px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}</style>
    </head><body>
    <h2>AuraTrack Event Log — ${new Date().toLocaleDateString()}</h2>
    <table>
      <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Duration</th><th>Notes</th></tr></thead>
      <tbody>
        ${events.map(e => `<tr><td>${e.date||''}</td><td>${e.time||''}</td><td>${e.type||''}</td><td>${e.duration||0}s</td><td>${(e.notes||'').replace(/\n/g,'<br>')}</td></tr>`).join('')}
      </tbody>
    </table>
    </body></html>
  `);
  win.document.close();
  win.print();
};

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
