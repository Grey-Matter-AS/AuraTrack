import { AppHeader, BottomSheet, Button, Card, Screen, Section, Stack, TextField } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import './screens.css';

/** Saved symptom sets and the person's own symptoms (F-303, F-304), managed from Home. */
export function Sets() {
  const nav = useNav();
  const { t, label, sets, customCodes, actions } = useApp();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const own = customCodes.filter((c) => c.kind === 'symptom');
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('settings.sets')} onBack={() => nav.pop()} />
        <Section title={t('sets.title')}>
          {sets.length === 0 ? (
            <p className="app-note">{t('sets.empty')}</p>
          ) : (
            <Stack>
              {sets.map((s) => (
                <Card compact key={s.id}>
                  <Stack>
                    <p className="app-banner">
                      {s.name ||
                        s.items
                          .map((x) => label(x.code))
                          .slice(0, 2)
                          .join(', ')}
                    </p>
                    <p className="app-note">{s.items.map((x) => label(x.code)).join(', ')}</p>
                    <div className="ui-cluster">
                      <Button size="md" onClick={() => setRenaming({ id: s.id, name: s.name })}>
                        {t('sets.rename')}
                      </Button>
                      <Button size="md" variant="danger" onClick={() => void actions.deleteSet(s.id)}>
                        {t('home.delete')}
                      </Button>
                    </div>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Section>
        <Section title={t('own.title')}>
          {own.length === 0 ? (
            <p className="app-note">{t('own.empty')}</p>
          ) : (
            <ul className="app-list">
              {own.map((c) => (
                <li key={c.id}>{c.label}</li>
              ))}
            </ul>
          )}
        </Section>
      </Stack>
      {renaming ? (
        <BottomSheet
          title={t('sets.rename')}
          onClose={() => setRenaming(null)}
          footer={
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                void actions.renameSet(renaming.id, renaming.name).then(() => setRenaming(null));
              }}
            >
              {t('common.save')}
            </Button>
          }
        >
          <TextField
            label={t('set.name')}
            value={renaming.name}
            maxLength={120}
            onChange={(name) => setRenaming({ ...renaming, name })}
          />
        </BottomSheet>
      ) : null}
    </Screen>
  );
}
