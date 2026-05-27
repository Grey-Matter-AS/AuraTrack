import React, { useRef, useState, useEffect } from 'react';

export function Tabs({ tabs, activeTab, onTabChange }) {
  const ref = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative shrink-0">
      <div
        ref={ref}
        onScroll={check}
        className="flex gap-2 pb-1"
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

      {showLeft && (
        <div
          className="absolute top-0 left-0 bottom-0 w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, var(--bg-base), transparent)' }}
        />
      )}
      {showRight && (
        <div
          className="absolute top-0 right-0 bottom-0 w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, var(--bg-base), transparent)' }}
        />
      )}
    </div>
  );
}
