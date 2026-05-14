import React from 'react';

export function ExportCard({ label, description, onExport }) {
  return (
    <button
      onClick={onExport}
      className="w-full bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 text-left shadow-lg active:scale-[0.98] transition-transform"
    >
      <p className="text-white font-black uppercase tracking-widest text-sm mb-1">{label}</p>
      <p className="text-slate-500 text-xs font-medium">{description}</p>
    </button>
  );
}
