import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { lazy, Suspense, useEffect, useState } from 'react';
// The developer page (M1) is loaded only when opened, so it adds nothing to the first load.
const DevPage = lazy(() => import('./dev/DevPage'));
const isDevRoute = () => window.location.hash === '#/dev';
// M0 shell: proves the build, the PWA and the tokens work. Real screens arrive from M2 on.
export function App() {
  const [dev, setDev] = useState(isDevRoute);
  useEffect(() => {
    const onChange = () => setDev(isDevRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  if (dev) {
    return _jsx(Suspense, {
      fallback: _jsx('p', { className: 'p-4 text-sm', children: 'Loading\u2026' }),
      children: _jsx(DevPage, {}),
    });
  }
  return _jsx('main', {
    className: 'min-h-dvh grid place-items-center p-4',
    children: _jsxs('div', {
      className: 'text-center',
      children: [
        _jsx('h1', { className: 'text-xs font-black tracking-[0.4em] uppercase', children: 'AuraTrack' }),
        _jsx('p', {
          className: 'mt-2 text-sm',
          style: { color: 'var(--text-dim)' },
          children: 'Version 7 \u2014 foundation',
        }),
      ],
    }),
  });
}
//# sourceMappingURL=App.js.map
