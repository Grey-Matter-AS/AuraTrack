import { entriesOn, localDateKey, reminderDue, type WellbeingEntry } from '@auratrack/model';
import { Button, Card } from '@auratrack/ui';
import { useState } from 'react';
import { useSyncExternalStore } from 'react';
import { useApp } from '../app/AppContext';
import { useRecords } from '../app/records';
import { backupReminder, SNOOZE_MS } from '../app/backupReminder';
import { install, isInstalled, isIos } from '../app/install';
import { useNav } from '../editor/nav';
import { useHouseholdOptional } from '../household/HouseholdContext';
import { APP_VERSION } from '../version';
import './screens.css';

/** Install tip (F-108): the browser's install prompt where there is one, the Share-menu steps on an iPhone. */
export function InstallCard() {
  const { t, settings, actions } = useApp();
  const canPrompt = useSyncExternalStore(install.subscribe, install.getSnapshot);
  if (isInstalled() || settings.installBannerDismissed) return null;
  return (
    <Card tone="accent" compact>
      <p className="app-banner">{t('install.title')}</p>
      <p className="app-note">{isIos() ? t('install.ios') : canPrompt ? t('install.prompt') : t('install.menu')}</p>
      <div className="ui-cluster">
        {canPrompt ? (
          <Button variant="primary" size="md" onClick={() => void install.prompt()}>
            {t('install.button')}
          </Button>
        ) : null}
        <Button size="md" onClick={() => void actions.setSetting('installBannerDismissed', true)}>
          {t('install.later')}
        </Button>
      </div>
    </Card>
  );
}

/** Backup reminder (F-110): back up now, snooze, or turn it off. */
export function BackupCard() {
  const app = useApp();
  const { t, settings, actions, patients } = app;
  const nav = useNav();
  const state = backupReminder({
    now: app.controller.now(),
    enabled: settings.backupReminderEnabled,
    intervalDays: settings.backupReminderIntervalDays,
    lastBackupAt: settings.lastBackupAt,
    snoozedUntil: settings.backupSnoozedUntil,
    firstUseAt: patients.reduce((oldest, p) => (oldest === 0 ? p.createdAt : Math.min(oldest, p.createdAt)), 0),
  });
  if (!state.due) return null;
  return (
    <Card tone="accent" compact>
      <p className="app-banner" role="status">
        {state.days === null ? t('backup.reminderNever') : t('backup.reminderDays', { days: state.days })}
      </p>
      <div className="ui-cluster">
        <Button variant="primary" size="md" onClick={() => nav.push('backup')}>
          {t('backup.now')}
        </Button>
        <Button
          size="md"
          onClick={() => void actions.setSetting('backupSnoozedUntil', app.controller.now() + SNOOZE_MS)}
        >
          {t('backup.snooze')}
        </Button>
        <Button size="md" onClick={() => void actions.setSetting('backupReminderEnabled', false)}>
          {t('backup.turnOff')}
        </Button>
      </div>
    </Card>
  );
}

/** What's new (F-901): shown once after an update (a new store starts at the current version, so not on the first run). */
export function WhatsNewCard() {
  const { t, settings, actions } = useApp();
  if (settings.whatsNewSeen === APP_VERSION) return null;
  return (
    <Card compact>
      <p className="app-banner">{t('whatsnew.title', { version: APP_VERSION })}</p>
      <p className="app-note">{t('whatsnew.text')}</p>
      <Button size="md" onClick={() => void actions.setSetting('whatsNewSeen', APP_VERSION)}>
        {t('common.dismiss')}
      </Button>
    </Card>
  );
}

/** The wellbeing card (F-106): today's check-in, or the question. Only while the module is on. */
export function WellbeingCard({ onCheckIn }: { onCheckIn: () => void }) {
  const app = useApp();
  const { t, label, settings } = app;
  const entries = useRecords<WellbeingEntry>('wellbeingEntry');
  const [dismissed, setDismissed] = useState(false);
  if (!settings.wellbeingEnabled || entries === null) return null;
  const now = app.controller.now();
  const today = entriesOn(entries, localDateKey(now))[0];
  const reminding =
    !dismissed &&
    settings.wellbeingDailyReminderEnabled &&
    reminderDue({ now, time: settings.wellbeingReminderTime, entries });
  return (
    <Card {...(reminding ? { tone: 'accent' as const } : {})} compact>
      <p className="app-banner">
        {today ? t('wb.todayDone', { mood: label(today.moodCode) }) : reminding ? t('wb.reminder') : t('wb.todayNone')}
      </p>
      <div className="ui-cluster">
        <Button size="md" onClick={onCheckIn}>
          {today ? t('wb.another') : t('wb.checkIn')}
        </Button>
        {reminding ? (
          <Button size="md" onClick={() => setDismissed(true)}>
            {t('common.dismiss')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** Household (M6): a quiet note when another device's changes came in, and the wait for the first meeting on a phone that just joined. */
export function HouseholdCard() {
  const { t, patients } = useApp();
  const hh = useHouseholdOptional();
  const nav = useNav();
  if (!hh) return null;
  const waiting = patients.length === 0 && hh.snapshot.household !== null;
  if (!waiting && !hh.note) return null;
  return (
    <Card tone="accent" compact>
      {waiting ? <p className="app-banner">{t('hh.joinWaitingFirst')}</p> : null}
      {hh.note ? (
        <>
          <p className="app-banner" role="status">
            {hh.note.name
              ? t('hh.note', { name: hh.note.name, count: hh.note.count })
              : t('hub.note', { count: hh.note.count })}
          </p>
          <div className="ui-cluster">
            <Button size="md" onClick={() => nav.push('history')}>
              {t('hh.noteOpen')}
            </Button>
            <Button size="md" onClick={hh.dismissNote}>
              {t('hh.noteDismiss')}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
