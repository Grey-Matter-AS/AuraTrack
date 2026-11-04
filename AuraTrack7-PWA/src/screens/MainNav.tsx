import { NavBar } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { useNav, type ScreenName } from '../editor/nav';

export type MainPlace = 'home' | 'history' | 'meds' | 'more';

/** The main places, at the top of Home, History, Medicines and More. Choosing one replaces the screen, so back still leaves the app. */
export function MainNav({ current }: { current: MainPlace }) {
  const { t } = useApp();
  const nav = useNav();
  return (
    <NavBar
      label={t('nav.label')}
      current={current}
      onSelect={(id) => nav.replace(id as ScreenName)}
      items={[
        { id: 'home', label: t('nav.home') },
        { id: 'history', label: t('nav.history') },
        { id: 'meds', label: t('nav.meds') },
        { id: 'more', label: t('nav.more') },
      ]}
    />
  );
}
