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
    return (
      <Suspense fallback={<p className="p-4 text-sm">Loading…</p>}>
        <DevPage />
      </Suspense>
    );
  }
  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="text-center">
        <h1 className="text-xs font-black tracking-[0.4em] uppercase">AuraTrack</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-dim)' }}>
          Version 7 — foundation
        </p>
      </div>
    </main>
  );
}
