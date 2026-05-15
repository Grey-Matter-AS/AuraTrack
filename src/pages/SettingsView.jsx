import React from 'react';
import { SettingsForm } from '../components/SettingsForm';

export default function SettingsView({ settings, onUpdate, onReset, onBack }) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← BACK
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          Settings
        </h2>
        <span className="ml-auto text-[9px] font-bold px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
          {settings.userMode === 'CARETAKER' ? 'CARETAKER' : 'SELF'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <SettingsForm settings={settings} onUpdate={onUpdate} onReset={onReset} />
      </div>

    </div>
  );
}
