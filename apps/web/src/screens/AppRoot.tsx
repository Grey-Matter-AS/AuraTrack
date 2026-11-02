import type { PasskeyEnv } from '@auratrack/store';
import { ToastProvider, UiStringsProvider } from '@auratrack/ui';
import { useMemo } from 'react';
import { createWorkerClient, AppProvider, useApp, type AppApi } from '../app/AppContext';
import type { RecordingEnv } from '../recording/controller';
import { uiStringsFor } from '../uiStrings';
import { Gate } from './Gate';
import { EditorHost } from '../editor/EditorContext';
import { Recording } from './Recording';
import { stack } from './stack';
import './screens.css';

// The app (route #/app). Which screen shows follows the state: set-up, the PIN screen, the recording that is running, or Home.
// The recording takes over the whole screen while it runs, so there is nothing to navigate away to (and nothing to lose).

function Shell() {
  const { phase, recording, t, error } = useApp();
  if (phase === 'loading') return <p className="app-note">{t('app.loading')}</p>;
  if (phase === 'error') return <p role="alert">{t('app.error', { error: error ?? '' })}</p>;
  if (phase === 'setup' || phase === 'locked') return <Gate />;
  return recording.session ? <Recording /> : <stack.ScreenStack initial="home" />;
}

function Strings({ children }: { children: React.ReactNode }) {
  const { language } = useApp();
  const strings = useMemo(() => uiStringsFor(language), [language]);
  return <UiStringsProvider strings={strings}>{children}</UiStringsProvider>;
}

export default function AppRoot({
  client,
  env,
  passkeyEnv,
}: {
  client?: AppApi;
  env?: RecordingEnv;
  passkeyEnv?: PasskeyEnv | null;
}) {
  const api = useMemo(() => client ?? createWorkerClient(), [client]);
  return (
    <AppProvider client={api} {...(env ? { env } : {})} {...(passkeyEnv !== undefined ? { passkeyEnv } : {})}>
      <Strings>
        <ToastProvider>
          <EditorHost>
            <Shell />
          </EditorHost>
        </ToastProvider>
      </Strings>
    </AppProvider>
  );
}
