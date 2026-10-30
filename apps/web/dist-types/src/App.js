import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
// M0 shell: proves the build, the PWA and the tokens work. Real screens arrive from M2 on.
export function App() {
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
