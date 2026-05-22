import React from 'react';

export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div
      className="flex gap-2 pb-1 shrink-0"
      style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {tabs.map(tab => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="whitespace-nowrap px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'var(--bg-raised)',
              color: active ? '#fff' : 'var(--text-dim)',
              border: active ? '1px solid transparent' : '1px solid var(--border)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
