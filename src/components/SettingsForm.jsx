import React from 'react';

export function SettingsForm({ settings, onUpdate }) {
  return (
    <div className="space-y-6 w-full">

      {/* User Mode */}
      <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Mode</p>
        <div className="flex gap-3">
          {['CARETAKER', 'PATIENT'].map(mode => (
            <button
              key={mode}
              onClick={() => onUpdate('userMode', mode)}
              className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
                settings.userMode === mode
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-slate-800 text-slate-400 border-2 border-slate-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Names */}
      <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50 space-y-4">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Names</p>
        {[
          { key: 'patientName', label: 'Patient Name' },
          { key: 'caretakerName', label: 'Caretaker Name' }
        ].map(({ key, label }) => (
          <div key={key}>
            <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest mb-1">{label}</p>
            <input
              type="text"
              value={settings[key]}
              onChange={e => onUpdate(key, e.target.value)}
              placeholder={label}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        ))}
      </div>

      {/* Emergency Contact */}
      <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Emergency Contact</p>
        <input
          type="text"
          value={settings.emergencyContact}
          onChange={e => onUpdate('emergencyContact', e.target.value)}
          placeholder="Phone number or name"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-blue-500 outline-none transition-all"
        />
      </div>

      {/* History Page Size */}
      <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">History Page Size</p>
        <div className="flex gap-3">
          {[5, 10, 25, 50].map(size => (
            <button
              key={size}
              onClick={() => onUpdate('historyPageSize', size)}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                settings.historyPageSize === size
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-slate-800 text-slate-400 border-2 border-slate-700'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
