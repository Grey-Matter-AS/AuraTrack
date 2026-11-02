import { AppHeader, Button, Screen, Stack } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { MainNav } from './MainNav';

/** Everything that is not one of the three daily places: people, settings, the optional modules, backup, help. */
export function More() {
  const { t, patient, settings } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader
          title={t('more.title')}
          {...(patient ? { patient: { name: patient.name, color: patient.color } } : {})}
        />
        <MainNav current="more" />
        <Button fullWidth onClick={() => nav.push('patients')}>
          {t('more.patients')}
        </Button>
        <Button fullWidth onClick={() => nav.push('settings')}>
          {t('more.settings')}
        </Button>
        {settings.wellbeingEnabled ? (
          <Button fullWidth onClick={() => nav.push('wellbeing')}>
            {t('more.wellbeing')}
          </Button>
        ) : null}
        {settings.eegEnabled ? (
          <Button fullWidth onClick={() => nav.push('eeg')}>
            {t('more.eeg')}
          </Button>
        ) : null}
        <Button fullWidth onClick={() => nav.push('reports')}>
          {t('more.reports')}
        </Button>
        <Button fullWidth onClick={() => nav.push('backup')}>
          {t('more.backup')}
        </Button>
        <Button fullWidth onClick={() => nav.push('sets')}>
          {t('more.sets')}
        </Button>
        <Button fullWidth onClick={() => nav.push('help')}>
          {t('more.help')}
        </Button>
        <Button fullWidth onClick={() => nav.push('about')}>
          {t('more.about')}
        </Button>
      </Stack>
    </Screen>
  );
}
