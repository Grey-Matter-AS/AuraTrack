import React from 'react';

export function ExportCard({ label, description, onExport }) {
  return (
    <button
      onClick={onExport}
      className="w-full p-6 rounded-2xl text-left shadow-lg active:scale-[0.98] transition-transform"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="font-black uppercase tracking-widest text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{description}</p>
    </button>
  );
}
