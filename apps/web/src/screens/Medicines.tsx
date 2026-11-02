import { AppHeader, Button, Card, Screen, Section, Stack } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { DosePanel } from './DosePanel';
import { ExtraDose } from './ExtraDose';
import { MainNav } from './MainNav';
import { regimenSummary } from './medText';
import './screens.css';

/** Medicines (F-501 to F-509): today's doses, the medicines being taken, and those that were stopped. */
export function Medicines() {
  const { t, medications } = useApp();
  const nav = useNav();
  const [extra, setExtra] = useState(false);
  const active = medications.filter((m) => m.active);
  const stopped = medications.filter((m) => !m.active);
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('nav.meds')} />
        <MainNav current="meds" />
        <DosePanel />
        <div className="ui-cluster">
          <Button variant="primary" onClick={() => nav.push('medEdit')}>
            {t('med.add')}
          </Button>
          <Button onClick={() => setExtra(true)} disabled={active.length === 0}>
            {t('dose.extra')}
          </Button>
          <Button onClick={() => nav.push('doseGrid')} disabled={medications.length === 0}>
            {t('dose.history')}
          </Button>
        </div>
        <Section title={t('med.current')}>
          {active.length === 0 ? (
            <p className="app-note">{t('med.none')}</p>
          ) : (
            <Stack>
              {active.map((m) => (
                <MedCard key={m.id} id={m.id} />
              ))}
            </Stack>
          )}
        </Section>
        {stopped.length > 0 ? (
          <Section title={t('med.stoppedList')}>
            <Stack>
              {stopped.map((m) => (
                <MedCard key={m.id} id={m.id} />
              ))}
            </Stack>
          </Section>
        ) : null}
      </Stack>
      {extra ? <ExtraDose onClose={() => setExtra(false)} /> : null}
    </Screen>
  );
}

function MedCard({ id }: { id: string }) {
  const { t, medications } = useApp();
  const nav = useNav();
  const m = medications.find((x) => x.id === id);
  if (!m) return null;
  return (
    <Card compact>
      <div className="app-row">
        <div>
          <p className="app-banner">{m.name}</p>
          <p className="app-note">{regimenSummary(m)}</p>
          {m.isRescue ? <p className="app-note">{t('med.rescue')}</p> : null}
        </div>
        <Button size="md" onClick={() => nav.push('medDetail', { id: m.id })}>
          {t('hist.open')}
        </Button>
      </div>
    </Card>
  );
}
