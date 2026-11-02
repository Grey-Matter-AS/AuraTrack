import { Button, Stack } from '@auratrack/ui';
import { lazy, Suspense, useEffect, useState } from 'react';

// The developer page (M1) is loaded only when opened, so it adds nothing to the first load.
const DevPage = lazy(() => import('./dev/DevPage'));

const KitchenSink = lazy(() => import('./kitchen/KitchenSink'));
const Prototype = lazy(() => import('./prototype/Prototype'));
const AppRoot = lazy(() => import('./screens/AppRoot'));

const isDevRoute = () => window.location.hash === '#/dev';
const isKitchenRoute = () => window.location.hash.startsWith('#/kitchen');
const isPrototypeRoute = () => window.location.hash.startsWith('#/prototype');
const isAppRoute = () => window.location.hash.startsWith('#/app');
const routeOf = () =>
  isDevRoute()
    ? 'dev'
    : isKitchenRoute()
      ? 'kitchen'
      : isPrototypeRoute()
        ? 'prototype'
        : isAppRoute()
          ? 'app'
          : 'home';

// M0 shell: proves the build, the PWA and the tokens work. Real screens arrive from M2 on.
export function App() {
  const [route, setRoute] = useState(routeOf);
  useEffect(() => {
    const onChange = () => setRoute(routeOf());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  if (route === 'kitchen') {
    return (
      <Suspense fallback={<p className="p-4 text-sm">Loading…</p>}>
        <KitchenSink />
      </Suspense>
    );
  }
  if (route === 'app') {
    return (
      <Suspense fallback={<p className="p-4 text-sm">Loading…</p>}>
        <AppRoot />
      </Suspense>
    );
  }
  if (route === 'prototype') {
    return (
      <Suspense fallback={<p className="p-4 text-sm">Loading…</p>}>
        <Prototype />
      </Suspense>
    );
  }
  if (route === 'dev') {
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
          Version 7.0.2
        </p>
        <div className="mt-6">
          <Stack>
            <Button variant="primary" onClick={() => (window.location.hash = '#/app')}>
              Open the app (work in progress)
            </Button>
            <Button onClick={() => (window.location.hash = '#/prototype')}>Try the prototype</Button>
            <Button onClick={() => (window.location.hash = '#/kitchen')}>Component kitchen sink</Button>
            <Button onClick={() => (window.location.hash = '#/dev')}>Developer page</Button>
          </Stack>
        </div>
      </div>
    </main>
  );
}
