import { seizureLengthSeconds, type buildDangerMap, type Seizure } from '@auratrack/model';
import { Button, Card } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { seizureName } from '../app/seizureName';
import './screens.css';

/** One seizure as a card: type, when, how long, the badges, and one button (Edit or Add details on Home, Open in History). */
export function SeizureCard({
  seizure,
  flags,
  action,
}: {
  seizure: Seizure;
  flags: ReturnType<typeof buildDangerMap>[string] | undefined;
  action: { label: string; onClick: () => void } | null;
}) {
  const { t, fmt } = useApp();
  const length = seizureLengthSeconds(seizure.phases);
  const badges = [
    seizure.isManualEntry ? t('home.badgeManual') : null,
    seizure.recordedWhileLocked ? t('home.badgeLocked') : null,
    seizure.isEmergencyStop ? t('home.badgeStopped') : null,
    seizure.cancelled ? t('home.badgeCancelled') : null,
    flags?.flags.includes('long_duration') ? t('home.longSeizure') : null,
    flags?.flags.includes('cluster') ? t('home.badgeCluster', { count: flags.clusterCount }) : null,
    seizure.status === 'in_progress' ? t('rec.title') : null,
  ].filter((b): b is string => b !== null);
  return (
    <Card compact>
      <div className="app-row">
        <div>
          <p className="app-banner">{seizureName(seizure, t)}</p>
          <p className="app-note">
            {fmt.whenSec(seizure.phases.start.at)}
            {length !== null ? ` · ${fmt.duration(length)}` : ''}
          </p>
          {badges.length > 0 ? <p className="app-note">{badges.join(' · ')}</p> : null}
          {seizure.status === 'recorded' ? <p className="app-note">{t('home.detailsDue')}</p> : null}
        </div>
        {action && seizure.status !== 'in_progress' ? (
          <Button size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
