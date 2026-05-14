import React from 'react';

export function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1e293b] w-full max-w-sm p-10 rounded-[3rem] border border-slate-700 shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-black italic">!</span>
        </div>
        <h3 className="text-white text-2xl font-black mb-3 tracking-tight">DELETE RECORD?</h3>
        <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium px-2">
          This medical entry will be permanently removed. This action cannot be undone.
        </p>
        <div className="flex flex-col gap-4">
          <button
            onClick={onConfirm}
            className="w-full py-6 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
          >
            YES, DELETE PERMANENTLY
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest active:text-white transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
