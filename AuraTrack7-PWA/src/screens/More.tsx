import { AppHeader, NavList, Screen, Stack, type NavListItem } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { MainNav } from './MainNav';

/**
 * Everything that is not one of the three daily places, as a grouped list: people and the household, seizures (profiles,
 * symptom sets, and the optional modules), records (reports, backup), and the app itself (settings, help, about).
 */
export function More() {
  const { t, settings } = useApp();
  const nav = useNav();
  const row = (id: string, label: string, description: string, go: () => void): NavListItem => ({
    id,
    label,
    description,
    onClick: go,
  });
  const people = [
    row('patients', t('more.patients'), t('more.patientsDesc'), () => nav.push('patients')),
    row('household', t('more.household'), t('more.householdDesc'), () => nav.push('household')),
  ];
  const seizures = [
    row('profiles', t('prof.title'), t('more.profilesDesc'), () => nav.push('profiles')),
    row('sets', t('more.sets'), t('more.setsDesc'), () => nav.push('sets')),
    ...(settings.wellbeingEnabled
      ? [row('wellbeing', t('more.wellbeing'), t('more.wellbeingDesc'), () => nav.push('wellbeing'))]
      : []),
    ...(settings.eegEnabled ? [row('eeg', t('more.eeg'), t('more.eegDesc'), () => nav.push('eeg'))] : []),
  ];
  const records = [
    row('reports', t('more.reports'), t('more.reportsDesc'), () => nav.push('reports')),
    row('backup', t('more.backup'), t('more.backupDesc'), () => nav.push('backup')),
  ];
  const app = [
    row('settings', t('more.settings'), t('more.settingsDesc'), () => nav.push('settings')),
    row('help', t('more.help'), t('more.helpDesc'), () => nav.push('help')),
    row('about', t('more.about'), t('more.aboutDesc'), () => nav.push('about')),
  ];
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.title')} />
        <MainNav current="more" />
        <NavList title={t('more.groupPeople')} items={people} />
        <NavList title={t('more.groupSeizures')} items={seizures} />
        <NavList title={t('more.groupRecords')} items={records} />
        <NavList title={t('more.groupApp')} items={app} />
      </Stack>
    </Screen>
  );
}
