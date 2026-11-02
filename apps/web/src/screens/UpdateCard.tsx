import { Button, Card } from '@auratrack/ui';
import { useSyncExternalStore } from 'react';
import { useApp } from '../app/AppContext';
import { updates } from '../app/updates';
import './screens.css';

/** "A new version is ready." Only on Home, so it never appears during a recording or an edit (F-109). */
export function UpdateCard() {
  const { t } = useApp();
  const waiting = useSyncExternalStore(updates.subscribe, updates.getSnapshot);
  if (!waiting) return null;
  return (
    <Card tone="accent" compact>
      <p className="app-banner" role="status">
        {t('update.ready')}
      </p>
      <div className="ui-cluster">
        <Button variant="primary" size="md" onClick={() => void updates.apply()}>
          {t('update.apply')}
        </Button>
        <Button size="md" onClick={updates.dismiss}>
          {t('update.later')}
        </Button>
      </div>
    </Card>
  );
}
