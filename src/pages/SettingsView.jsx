import React from 'react';
import { SettingsForm } from '../components/SettingsForm';

export default function SettingsView({ settings, onUpdate, onBack }) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="bg-slate-800 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all"
        >
          ← BACK
        </button>
        <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <SettingsForm settings={settings} onUpdate={onUpdate} />
      </div>

    </div>
  );
}
