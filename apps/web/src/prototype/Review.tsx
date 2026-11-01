import { AppHeader, Button, ButtonRow, Card, Screen, Stack, useToast } from '@auratrack/ui';
import { OverviewStrip, Timeline } from './Timeline';
import { goHome, useNav } from './nav';
import { usePrototype } from './state';

/** Everything in order, across the phases, before saving. Nothing is required: Save works from any tab. */
export function Review() {
  const nav = useNav();
  const toast = useToast();
  const { draft, label } = usePrototype();
  return (
    <Screen>
      <Stack>
        <AppHeader title="Review" onBack={() => nav.pop()} />
        <OverviewStrip draft={draft} />
        <Card compact>
          <p className="proto-banner">{draft.typeCode ? label(draft.typeCode) : 'Seizure type not set'}</p>
          {draft.notes ? <p className="proto-note">{draft.notes}</p> : null}
          {draft.findings.length > 0 ? (
            <p className="proto-note">Afterwards: {draft.findings.map(label).join(', ')}</p>
          ) : null}
          {draft.triggers.length > 0 ? (
            <p className="proto-note">Triggers: {draft.triggers.map(label).join(', ')}</p>
          ) : null}
        </Card>
        <Timeline draft={draft} />
        <ButtonRow stack>
          <Button
            variant="success"
            size="lg"
            onClick={() => {
              toast('Saved (prototype: nothing is stored)', 'success');
              goHome(nav);
            }}
          >
            Save
          </Button>
          <Button onClick={() => nav.pop()}>Back to editing</Button>
        </ButtonRow>
      </Stack>
    </Screen>
  );
}
