import { AppHeader, Button, Card, Screen, Stack } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import './screens.css';

const SECTIONS = [
  'new',
  'recording',
  'tagging',
  'past',
  'meds',
  'wellbeing',
  'eeg',
  'history',
  'reports',
  'backup',
  'settings',
] as const;

/** Help (F-901): short sections that open and close. */
export function Help() {
  const { t } = useApp();
  const nav = useNav();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.help')} onBack={() => nav.pop()} />
        {SECTIONS.map((id) => (
          <Card key={id} compact>
            <Stack gap="0.5rem">
              <Button fullWidth aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
                {t(`help.${id}` as never)}
              </Button>
              {open === id ? <p className="app-help">{t(`help.${id}Text` as never)}</p> : null}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
