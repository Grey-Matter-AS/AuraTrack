import { AppHeader, Button, Card, Logo, Screen, Section, Stack } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { isInstalled } from '../app/install';
import { useNav } from '../editor/nav';
import { APP_VERSION } from '../version';
import './screens.css';

/** About (F-902): the version, the disclaimer, and where the data lives. */
export function About() {
  const { t, settings, actions } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.about')} onBack={() => nav.pop()} />
        <Card>
          <Stack gap="0.5rem">
            <Logo src="/icons/icon-512.png" size={120} />
            <p className="app-banner">AuraTrack</p>
            <p className="app-note">{t('about.version', { version: APP_VERSION })}</p>
            <p className="app-note">{t('about.tagline')}</p>
          </Stack>
        </Card>
        {!isInstalled() && settings.installBannerDismissed ? (
          <Button onClick={() => void actions.setSetting('installBannerDismissed', false)}>{t('install.again')}</Button>
        ) : null}
        <Section title={t('about.privacy')}>
          <p className="app-help">{t('about.privacyText')}</p>
        </Section>
        <Section title={t('about.disclaimer')}>
          <p className="app-help">{t('about.disclaimerText')}</p>
        </Section>
      </Stack>
    </Screen>
  );
}
