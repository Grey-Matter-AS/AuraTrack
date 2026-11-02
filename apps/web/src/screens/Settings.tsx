import {
  EMERGENCY_PLAN_DEFAULTS,
  EMERGENCY_PLAN_LIMITS,
  localDateKey,
  type SettingKey,
  type SettingValue,
} from '@auratrack/model';
import {
  AppHeader,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  DateTimeField,
  Dialog,
  NumberField,
  Screen,
  Section,
  Select,
  Stack,
  TextArea,
  TextField,
} from '@auratrack/ui';
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { LockSettings } from './LockSettings';
import { LANGUAGE_NAMES, RecordingSettings } from './RecordingSettings';
import './screens.css';

export const SETTING_GROUPS = [
  'identity',
  'appearance',
  'display',
  'recording',
  'medications',
  'clinician',
  'data',
  'lock',
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

/** The list of setting groups (F-601 to F-606, F-1002). Each opens its own screen, so a long screen never hides a setting. */
export function Settings() {
  const { t } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.settings')} onBack={() => nav.pop()} />
        {SETTING_GROUPS.map((group) => (
          <Button key={group} fullWidth onClick={() => nav.push('settingsGroup', { group })}>
            {t(`settings.group.${group}` as never)}
          </Button>
        ))}
      </Stack>
    </Screen>
  );
}

export function SettingsGroup({ group }: { group: SettingGroup }) {
  const { t } = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Stack>
        <AppHeader title={t(`settings.group.${group}` as never)} onBack={() => nav.pop()} />
        {group === 'identity' ? <Identity /> : null}
        {group === 'appearance' ? <Appearance /> : null}
        {group === 'display' ? <Display /> : null}
        {group === 'recording' ? <Recording /> : null}
        {group === 'medications' ? <MedicationSettings /> : null}
        {group === 'clinician' ? <Clinician /> : null}
        {group === 'data' ? <DataSettings /> : null}
        {group === 'lock' ? <LockSettings /> : null}
      </Stack>
    </Screen>
  );
}

/** A text setting: typed freely, kept when Save is pressed. */
function TextSetting({
  settingKey,
  label,
  multiline = false,
}: {
  settingKey: Extract<
    SettingKey,
    'neurologistName' | 'neurologistInstitution' | 'neurologistContact' | 'reportNotes' | 'carerName'
  >;
  label: string;
  multiline?: boolean;
}) {
  const { t, settings, actions } = useApp();
  const saved = settings[settingKey];
  // What is typed shows until it is saved; then the saved value shows again
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const setValue = (text: string) => setDraft(text);
  return (
    <Stack gap="0.5rem">
      {multiline ? (
        <TextArea label={label} value={value} onChange={setValue} rows={4} />
      ) : (
        <TextField label={label} value={value} onChange={setValue} autoComplete="off" />
      )}
      <Button
        size="md"
        disabled={value === saved}
        onClick={() => void actions.setSetting(settingKey, value).then(() => setDraft(null))}
      >
        {t('common.save')}
      </Button>
    </Stack>
  );
}

function Identity() {
  const { t, patient, actions } = useApp();
  const [name, setName] = useState(patient?.name ?? '');
  const [dob, setDob] = useState(patient?.dateOfBirth ?? '');
  const [contact, setContact] = useState(patient?.emergencyContact ?? '');
  const changed =
    !!patient &&
    (name.trim() !== patient.name ||
      (dob || null) !== patient.dateOfBirth ||
      contact.trim() !== patient.emergencyContact);
  if (!patient) return null;
  return (
    <Section title={t('settings.group.identity')}>
      <Stack>
        <TextField label={t('people.name')} value={name} onChange={setName} autoComplete="off" />
        <DateTimeField label={t('people.dob')} type="date" value={dob} onChange={setDob} />
        <TextField label={t('people.contact')} help={t('people.contactHelp')} value={contact} onChange={setContact} />
        <Button
          disabled={!changed || name.trim() === ''}
          onClick={() =>
            void actions.updateRecord('patient', patient.id, {
              name: name.trim().slice(0, 120),
              dateOfBirth: dob === '' ? null : dob,
              emergencyContact: contact.trim().slice(0, 120),
            })
          }
        >
          {t('common.save')}
        </Button>
        <TextSetting settingKey="carerName" label={t('settings.carerName')} />
      </Stack>
    </Section>
  );
}

function Appearance() {
  const { t, settings, actions, language } = useApp();
  const set = actions.setSetting;
  return (
    <Stack>
      <ChipGroup
        label={t('settings.theme')}
        value={settings.theme}
        onChange={(v) => void set('theme', v)}
        options={[
          { value: 'dark', label: t('settings.themeDark') },
          { value: 'light', label: t('settings.themeLight') },
          { value: 'system', label: t('settings.themeSystem') },
        ]}
      />
      <ChipGroup
        label={t('settings.accent')}
        value={settings.accentColor}
        onChange={(v) => void set('accentColor', v)}
        options={(['blue', 'red', 'green', 'purple', 'amber'] as const).map((value) => ({
          value,
          label: t(`color.${value}` as never),
        }))}
      />
      <ChipGroup
        label={t('settings.textSize')}
        value={settings.fontSize}
        onChange={(v) => void set('fontSize', v)}
        options={[
          { value: 'small', label: t('settings.sizeSmall') },
          { value: 'normal', label: t('settings.sizeNormal') },
          { value: 'large', label: t('settings.sizeLarge') },
          { value: 'xlarge', label: t('settings.sizeXlarge') },
        ]}
      />
      <Select
        label={t('settings.language')}
        value={language}
        onChange={(value) => {
          const next = Object.keys(LANGUAGE_NAMES).find((l) => l === value);
          if (next) void set('language', next as SettingValue<'language'>);
        }}
        options={Object.entries(LANGUAGE_NAMES).map(([value, label]) => ({ value, label }))}
      />
    </Stack>
  );
}

function Display() {
  const { t, settings, actions } = useApp();
  const set = actions.setSetting;
  return (
    <Stack>
      <ChipGroup
        label={t('settings.pageSize')}
        value={String(settings.historyPageSize)}
        onChange={(v) => void set('historyPageSize', Number(v))}
        options={['10', '20', '50'].map((value) => ({ value, label: value }))}
      />
      <ChipGroup
        label={t('settings.dateFormat')}
        value={settings.dateFormat}
        onChange={(v) => void set('dateFormat', v)}
        options={[
          { value: 'dmy', label: t('settings.dateDmy') },
          { value: 'mdy', label: t('settings.dateMdy') },
          { value: 'ymd', label: t('settings.dateYmd') },
        ]}
      />
      <ChipGroup
        label={t('settings.timeFormat')}
        value={settings.timeFormat}
        onChange={(v) => void set('timeFormat', v)}
        options={[
          { value: '24h', label: t('settings.time24') },
          { value: '12h', label: t('settings.time12') },
        ]}
      />
      <ChipGroup
        label={t('settings.durationFormat')}
        value={settings.durationFormat}
        onChange={(v) => void set('durationFormat', v)}
        options={[
          { value: 'clock', label: t('settings.durClock') },
          { value: 'words', label: t('settings.durWords') },
        ]}
      />
    </Stack>
  );
}

/** The emergency plan (F-604): the alert time and the cluster rule. The defaults are the settled clinical rules. */
function EmergencyPlanSettings() {
  const { t, settings, actions } = useApp();
  const plan = settings.plan;
  const [alert, cluster, window] = [
    EMERGENCY_PLAN_LIMITS.emergencyAlertMinutes,
    EMERGENCY_PLAN_LIMITS.clusterMinCount,
    EMERGENCY_PLAN_LIMITS.clusterWindowMinutes,
  ];
  const isDefault =
    plan.alertMinutes === EMERGENCY_PLAN_DEFAULTS.emergencyAlertMinutes &&
    plan.clusterMinCount === EMERGENCY_PLAN_DEFAULTS.clusterMinCount &&
    plan.clusterWindowMinutes === EMERGENCY_PLAN_DEFAULTS.clusterWindowMinutes;
  return (
    <Section title={t('settings.plan')}>
      <Stack>
        <p className="app-note">{t('settings.planHelp')}</p>
        <NumberField
          label={t('settings.planAlert', { min: alert[0], max: alert[1] })}
          value={plan.alertMinutes}
          max={alert[1]}
          maxLength={2}
          onChange={(v) => void actions.setPlan('emergencyAlertMinutes', Math.max(alert[0], v))}
        />
        <NumberField
          label={t('settings.planCount', { min: cluster[0], max: cluster[1] })}
          value={plan.clusterMinCount}
          max={cluster[1]}
          maxLength={2}
          onChange={(v) => void actions.setPlan('clusterMinCount', Math.max(cluster[0], v))}
        />
        <NumberField
          label={t('settings.planWindow', { min: window[0], max: window[1] })}
          value={plan.clusterWindowMinutes}
          max={window[1]}
          maxLength={5}
          onChange={(v) => void actions.setPlan('clusterWindowMinutes', Math.max(window[0], v))}
        />
        <Button
          disabled={isDefault}
          onClick={() => {
            void actions
              .setPlan('emergencyAlertMinutes', EMERGENCY_PLAN_DEFAULTS.emergencyAlertMinutes)
              .then(() => actions.setPlan('clusterMinCount', EMERGENCY_PLAN_DEFAULTS.clusterMinCount))
              .then(() => actions.setPlan('clusterWindowMinutes', EMERGENCY_PLAN_DEFAULTS.clusterWindowMinutes));
          }}
        >
          {t('settings.planReset')}
        </Button>
      </Stack>
    </Section>
  );
}

function Recording() {
  const { t, settings, actions } = useApp();
  const nav = useNav();
  return (
    <Stack>
      <RecordingSettings />
      <EmergencyPlanSettings />
      <Section title={t('settings.modules')}>
        <Stack>
          <Checkbox
            checked={settings.eegEnabled}
            onChange={(on) => void actions.setSetting('eegEnabled', on)}
            label={t('settings.eeg')}
            help={t('settings.eegHelp')}
          />
          <Checkbox
            checked={settings.wellbeingEnabled}
            onChange={(on) => void actions.setSetting('wellbeingEnabled', on)}
            label={t('settings.wellbeing')}
            help={t('settings.wellbeingHelp')}
          />
          {settings.wellbeingEnabled ? (
            <>
              <Checkbox
                checked={settings.wellbeingDailyReminderEnabled}
                onChange={(on) => void actions.setSetting('wellbeingDailyReminderEnabled', on)}
                label={t('wb.reminderSetting')}
                help={t('wb.reminderHelp')}
              />
              {settings.wellbeingDailyReminderEnabled ? (
                <DateTimeField
                  label={t('wb.reminderTime')}
                  type="time"
                  value={settings.wellbeingReminderTime}
                  onChange={(v) => {
                    if (v !== '') void actions.setSetting('wellbeingReminderTime', v);
                  }}
                />
              ) : null}
            </>
          ) : null}
          <Checkbox
            checked={settings.videoEnabled}
            onChange={(on) => void actions.setSetting('videoEnabled', on)}
            label={t('settings.video')}
            help={t('settings.videoHelp')}
          />
          {settings.videoEnabled ? (
            <ChipGroup
              label={t('settings.camera')}
              value={settings.videoCamera}
              onChange={(v) => void actions.setSetting('videoCamera', v)}
              options={[
                { value: 'back', label: t('settings.cameraBack') },
                { value: 'front', label: t('settings.cameraFront') },
              ]}
            />
          ) : null}
        </Stack>
      </Section>
      <Button fullWidth onClick={() => nav.push('sets')}>
        {t('more.sets')}
      </Button>
    </Stack>
  );
}

function MedicationSettings() {
  const { t, settings, actions } = useApp();
  const nav = useNav();
  return (
    <Stack>
      <Checkbox
        checked={settings.assumeDosesTaken}
        onChange={(on) => {
          void actions.setSetting('assumeDosesTaken', on).then(() => {
            if (on && settings.assumeDosesTakenSince === '')
              void actions.setSetting('assumeDosesTakenSince', localDateKey(Date.now()));
          });
        }}
        label={t('settings.assume')}
        help={t('settings.assumeHelp')}
      />
      <Checkbox
        checked={settings.doseReminders}
        onChange={(on) => void actions.setSetting('doseReminders', on)}
        label={t('settings.doseReminders')}
        help={t('settings.doseRemindersHelp')}
      />
      <NotificationState />
      <Button fullWidth onClick={() => nav.push('meds')}>
        {t('nav.meds')}
      </Button>
    </Stack>
  );
}

/** Whether the browser lets AuraTrack show a reminder as a notification, and a button to ask (F-509). */
function NotificationState() {
  const { t } = useApp();
  const supported = typeof Notification !== 'undefined';
  const [state, setState] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported',
  );
  return (
    <Section title={t('settings.notif')}>
      <Stack>
        <p className="app-note">{t(`settings.notif.${state}` as never)}</p>
        {state === 'default' ? (
          <Button onClick={() => void Notification.requestPermission().then(setState)}>{t('settings.notifAsk')}</Button>
        ) : null}
        <p className="app-note">{t('settings.notifIos')}</p>
      </Stack>
    </Section>
  );
}

function Clinician() {
  const { t, settings, actions } = useApp();
  return (
    <Stack>
      <p className="app-note">{t('settings.clinicianHelp')}</p>
      <TextSetting settingKey="neurologistName" label={t('settings.neuroName')} />
      <TextSetting settingKey="neurologistInstitution" label={t('settings.neuroInstitution')} />
      <TextSetting settingKey="neurologistContact" label={t('settings.neuroContact')} />
      <Checkbox
        checked={settings.reportIncludeDateOfBirth}
        onChange={(on) => void actions.setSetting('reportIncludeDateOfBirth', on)}
        label={t('settings.reportDob')}
      />
      <TextSetting settingKey="reportNotes" label={t('settings.reportNotes')} multiline />
    </Stack>
  );
}

function DataSettings() {
  const { t, settings, actions } = useApp();
  const [storage, setStorage] = useState<{ used: number; quota: number; persisted: boolean } | null>(null);
  const [erasing, setErasing] = useState(false);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    const manager = globalThis.navigator?.storage;
    if (!manager?.estimate) return;
    void Promise.all([manager.estimate(), manager.persisted?.() ?? Promise.resolve(false)]).then(([e, persisted]) =>
      setStorage({ used: e.usage ?? 0, quota: e.quota ?? 0, persisted }),
    );
  }, []);
  const mb = (n: number) => (n / 1_048_576).toFixed(1);
  return (
    <Stack>
      <Section title={t('settings.backupReminder')}>
        <Stack>
          <Checkbox
            checked={settings.backupReminderEnabled}
            onChange={(on) => void actions.setSetting('backupReminderEnabled', on)}
            label={t('settings.backupReminderOn')}
          />
          {settings.backupReminderEnabled ? (
            <ChipGroup
              label={t('settings.backupEvery')}
              value={String(settings.backupReminderIntervalDays)}
              onChange={(v) => void actions.setSetting('backupReminderIntervalDays', Number(v))}
              options={['7', '14', '30', '90'].map((value) => ({ value, label: t('settings.days', { n: value }) }))}
            />
          ) : null}
        </Stack>
      </Section>
      <Section title={t('settings.storage')}>
        <Card compact>
          {storage ? (
            <Stack gap="0.25rem">
              <p className="app-note">
                {t('settings.storageUsed', { used: mb(storage.used), quota: mb(storage.quota) })}
              </p>
              <p className="app-note">{storage.persisted ? t('settings.storageSafe') : t('settings.storageNotSafe')}</p>
            </Stack>
          ) : (
            <p className="app-note">{t('settings.storageUnknown')}</p>
          )}
        </Card>
      </Section>
      <Section title={t('settings.erase')}>
        <Stack>
          <p className="app-note">{t('settings.eraseHelp')}</p>
          <Button variant="danger" onClick={() => setErasing(true)}>
            {t('settings.eraseButton')}
          </Button>
        </Stack>
      </Section>
      {erasing ? (
        <Dialog
          title={t('settings.eraseTitle')}
          message={t('settings.eraseText')}
          tone="danger"
          onClose={() => setErasing(false)}
        >
          <Stack>
            <TextField
              label={t('settings.erasePin')}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={setPin}
              {...(wrong ? { error: t('lock.wrong') } : {})}
            />
            <div className="ui-cluster">
              <Button onClick={() => setErasing(false)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                disabled={pin.length < 4}
                onClick={() => {
                  void actions.eraseAll(pin).then((result) => {
                    if (result === 'wrong_pin') setWrong(true);
                  });
                }}
              >
                {t('settings.eraseConfirm')}
              </Button>
            </div>
          </Stack>
        </Dialog>
      ) : null}
    </Stack>
  );
}
