import { AppHeader, Button, ButtonRow, Card, Screen, Stack, useToast } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { ilae2025Name } from '../app/seizureName';
import { useEditor } from './EditorContext';
import { goHome, useNav } from './nav';
import { OverviewStrip, Timeline } from './Timeline';
import '../screens/screens.css';
import './editor.css';

/** Everything in order, across the phases, before saving. Nothing is required: Save works from any tab. */
export function Review() {
  const nav = useNav();
  const toast = useToast();
  const app = useApp();
  const { draft, label, t, patch, original } = useEditor();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('review.title')} onBack={() => nav.pop()} />
        <OverviewStrip draft={draft} />
        <Card compact>
          <p className="app-banner">
            {draft.profile?.name ?? ilae2025Name(draft.ilae2025, t) ?? t('review.typeNotSet')}
          </p>
          {draft.profile && ilae2025Name(draft.ilae2025, t) ? (
            <p className="app-note">{t('classify.result', { type: ilae2025Name(draft.ilae2025, t) ?? '' })}</p>
          ) : null}
          {draft.notes ? <p className="app-note">{draft.notes}</p> : null}
          {draft.findings.length + draft.customFindings.length > 0 ? (
            <p className="app-note">
              {t('review.afterwards', { list: [...draft.findings.map(label), ...draft.customFindings].join(', ') })}
            </p>
          ) : null}
          {draft.triggers.length > 0 ? (
            <p className="app-note">{t('review.triggers', { list: draft.triggers.map(label).join(', ') })}</p>
          ) : null}
        </Card>
        <Timeline draft={draft} />
        <ButtonRow stack>
          <Button
            variant="success"
            size="lg"
            disabled={app.busy}
            onClick={() => {
              void app.actions.saveSeizure(original.id, patch('complete')).then(() => {
                toast(t('common.saved'), 'success');
                goHome(nav);
              });
            }}
          >
            {t('common.save')}
          </Button>
          <Button onClick={() => nav.pop()}>{t('review.backToEditing')}</Button>
        </ButtonRow>
      </Stack>
    </Screen>
  );
}
