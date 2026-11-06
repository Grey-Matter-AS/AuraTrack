import {
  EMPTY_ILAE_2025,
  MAX_SEIZURE_PROFILES,
  PROFILES_IN_ROW,
  ilae2025ForSaving,
  type Ilae2025,
  type SymptomSetItem,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Dialog,
  Screen,
  Section,
  Select,
  Stack,
  TextField,
  useToast,
} from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { ilae2025Name, seizureName } from '../app/seizureName';
import { Ilae2025Questions } from '../editor/Ilae2025Questions';
import { useNav } from '../editor/nav';
import './screens.css';

// The active person's seizure profiles (D-17): one of their own kinds of seizure, with its ILAE 2025 answers and usual signs.
// Changing or removing one here never changes a seizure saved with it: each seizure keeps its own copy.

interface Editing {
  id: string | null;
  name: string;
  ilae: Ilae2025;
  signs: SymptomSetItem[];
}

export function Profiles() {
  const nav = useNav();
  const toast = useToast();
  const { t, label, fmt, patient, profiles, seizures, actions, busy } = useApp();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const withSigns = seizures.filter((s) => s.symptoms.length > 0).slice(0, 50);

  const save = async (e: Editing) => {
    if (!patient) return;
    const values = {
      name: e.name.trim().slice(0, 60),
      ilae: ilae2025ForSaving(e.ilae) ?? EMPTY_ILAE_2025,
      signs: e.signs.slice(0, 40),
    };
    if (e.id) await actions.updateRecord('seizureProfile', e.id, values);
    else
      await actions.createRecord('seizureProfile', {
        patientId: patient.id,
        ...values,
        position: Math.max(-1, ...profiles.map((p) => p.position)) + 1,
      });
    toast(t('prof.saved'), 'success');
    setEditing(null);
  };
  // Swapping two neighbours; every position is written again in order, so they stay tidy after any merge
  const move = async (index: number, by: -1 | 1) => {
    const order = [...profiles];
    const [moved] = order.splice(index, 1);
    if (!moved) return;
    order.splice(index + by, 0, moved);
    for (const [position, p] of order.entries())
      if (p.position !== position) await actions.updateRecord('seizureProfile', p.id, { position });
  };

  return (
    <Screen>
      <Stack>
        <AppHeader title={t('prof.title')} onBack={() => nav.pop()} />
        <p className="app-note">{t('prof.help', { name: patient?.name ?? '' })}</p>
        <p className="app-note">{t('prof.inRow', { n: PROFILES_IN_ROW })}</p>
        <Section title={t('prof.title')}>
          {profiles.length === 0 ? (
            <p className="app-note">{t('prof.none')}</p>
          ) : (
            <Stack>
              {profiles.map((p, i) => (
                <Card compact key={p.id}>
                  <Stack>
                    <p className="app-banner">{p.name}</p>
                    <p className="app-note">{ilae2025Name(p.ilae, t) ?? t('classify.notClassified')}</p>
                    <p className="app-note">
                      {p.signs.length > 0 ? p.signs.map((x) => label(x.code)).join(', ') : t('prof.signsNone')}
                    </p>
                    <div className="ui-cluster">
                      <Button
                        size="md"
                        onClick={() => setEditing({ id: p.id, name: p.name, ilae: p.ilae, signs: [...p.signs] })}
                      >
                        {t('prof.edit')}
                      </Button>
                      <Button size="md" disabled={i === 0 || busy} onClick={() => void move(i, -1)}>
                        {t('prof.up')}
                      </Button>
                      <Button size="md" disabled={i === profiles.length - 1 || busy} onClick={() => void move(i, 1)}>
                        {t('prof.down')}
                      </Button>
                      <Button size="md" variant="danger" onClick={() => setRemoving({ id: p.id, name: p.name })}>
                        {t('prof.remove')}
                      </Button>
                    </div>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Section>
        {profiles.length < MAX_SEIZURE_PROFILES ? (
          <Button
            variant="primary"
            fullWidth
            onClick={() => setEditing({ id: null, name: '', ilae: EMPTY_ILAE_2025, signs: [] })}
          >
            {t('prof.add')}
          </Button>
        ) : (
          <p className="app-note">{t('prof.full', { max: MAX_SEIZURE_PROFILES })}</p>
        )}
      </Stack>
      {editing ? (
        <BottomSheet
          title={editing.id ? t('prof.edit') : t('prof.add')}
          onClose={() => setEditing(null)}
          footer={
            <Button
              variant="primary"
              fullWidth
              disabled={editing.name.trim() === '' || busy}
              onClick={() => void save(editing)}
            >
              {t('common.save')}
            </Button>
          }
        >
          <Stack>
            <TextField
              label={t('prof.name')}
              help={t('prof.nameHelp')}
              value={editing.name}
              maxLength={60}
              onChange={(name) => setEditing({ ...editing, name })}
            />
            <Ilae2025Questions value={editing.ilae} onChange={(ilae) => setEditing({ ...editing, ilae })} />
            <Section title={t('prof.signs')}>
              <Stack>
                {editing.signs.length === 0 ? <p className="app-note">{t('prof.signsNone')}</p> : null}
                {editing.signs.map((x, i) => (
                  <div className="app-row" key={`${x.phase}-${x.code}`}>
                    <p className="app-note">
                      {label(x.code)} · {t(`tab.${x.phase}`)}
                    </p>
                    <Button
                      size="md"
                      aria-label={t('prof.signRemove', { name: label(x.code) })}
                      onClick={() => setEditing({ ...editing, signs: editing.signs.filter((_, j) => j !== i) })}
                    >
                      {t('home.delete')}
                    </Button>
                  </div>
                ))}
                {withSigns.length > 0 ? (
                  <Select
                    label={t('prof.copySigns')}
                    value=""
                    placeholder={t('prof.copySigns')}
                    onChange={(id) => {
                      const from = seizures.find((s) => s.id === id);
                      if (!from) return;
                      const signs = [...from.symptoms]
                        .sort((a, b) => a.order - b.order)
                        .map((x) => ({ code: x.code, phase: x.phase ?? 'seizure' }));
                      setEditing({ ...editing, signs: signs.slice(0, 40) });
                    }}
                    options={withSigns.map((s) => ({
                      value: s.id,
                      label: `${fmt.whenSec(s.phases.start.at)} · ${seizureName(s, t, label)}`,
                    }))}
                  />
                ) : (
                  <p className="app-note">{t('prof.copyNone')}</p>
                )}
              </Stack>
            </Section>
          </Stack>
        </BottomSheet>
      ) : null}
      {removing ? (
        <Dialog
          title={t('prof.remove')}
          message={t('prof.removeAsk', { name: removing.name })}
          tone="danger"
          onClose={() => setRemoving(null)}
          actions={
            <>
              <Button onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void actions.removeRecord('seizureProfile', removing.id).then(() => {
                    toast(t('prof.removed'), 'success');
                    setRemoving(null);
                  });
                }}
              >
                {t('prof.remove')}
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}
