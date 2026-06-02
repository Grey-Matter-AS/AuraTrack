import { useState, useEffect, useRef } from 'react';

export function ScrollFade({ children, className = '', wrapperClassName = 'flex-1', bgVar = '--bg-base' }) {
  const ref = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setShowTop(el.scrollTop > 8);
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
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
    <div className={`relative min-h-0 ${wrapperClassName}`}>
      <div ref={ref} onScroll={check} className={`h-full overflow-y-auto pr-1 custom-scrollbar ${className}`}>
        {children}
      </div>
      {showTop && (
        <div
          className="absolute top-0 left-0 right-0 h-10 pointer-events-none z-10"
          style={{ background: `linear-gradient(to bottom, var(${bgVar}), transparent)` }}
        />
      )}
      {showBottom && (
        <div
          className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-10"
          style={{ background: `linear-gradient(to top, var(${bgVar}), transparent)` }}
        />
      )}
    </div>
  );
}
