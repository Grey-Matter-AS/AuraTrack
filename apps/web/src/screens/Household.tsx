import {
  activeDevices,
  effectiveFollows,
  hubLocalOf,
  hubOf,
  type DeviceInfo,
  type HubLinkResult,
} from '@auratrack/sync';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  Dialog,
  Screen,
  Section,
  Stack,
  TextField,
  Toggle,
} from '@auratrack/ui';
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { agoText } from '../household/ago';
import { useHousehold } from '../household/HouseholdContext';
import { disablePush, enablePush, pushSupport, updatePush, type PushPrefs } from '../household/push';
import './screens.css';

/** The household: its devices, adding one, who keeps whom, removing one, and the way to the other household screens. */
export function Household() {
  const { t, fmt, patients } = useApp();
  const hh = useHousehold();
  const nav = useNav();
  const { snapshot } = hh;
  const household = snapshot.household;
  const [starting, setStarting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [following, setFollowing] = useState(false);
  const [removing, setRemoving] = useState<DeviceInfo | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [canJoin, setCanJoin] = useState(false);
  const [now] = useState(() => Date.now());
  const askCanJoin = hh.canJoin;
  useEffect(() => {
    let alive = true;
    void askCanJoin().then((ok) => alive && setCanJoin(ok));
    return () => {
      alive = false;
    };
  }, [askCanJoin, household]);
  const me = household && hh.deviceId ? household.membership.devices[hh.deviceId] : undefined;

  if (!household) {
    return (
      <Screen>
        <Stack>
          <AppHeader title={t('hh.title')} onBack={() => nav.pop()} />
          <Card>
            <Stack gap="0.5rem">
              <p className="app-help">{t('hh.none')}</p>
              <p className="app-help">{t('hh.noneLimit')}</p>
            </Stack>
          </Card>
          <Button variant="primary" fullWidth onClick={() => setStarting(true)}>
            {t('hh.start')}
          </Button>
          {canJoin ? (
            <Button fullWidth onClick={() => nav.push('joinHousehold')}>
              {t('hh.joinInstead')}
            </Button>
          ) : null}
          {starting ? <StartSheet onClose={() => setStarting(false)} /> : null}
        </Stack>
      </Screen>
    );
  }

  const devices = activeDevices(household.membership);
  const nameOf = (id: string) => patients.find((p) => p.id === id)?.name ?? '…';
  const follows = (d: DeviceInfo) =>
    d.followAll
      ? t('hh.follows')
      : t('hh.followsSome', {
          names: effectiveFollows(household.membership, d.id).map(nameOf).join(', ') || t('common.none'),
        });

  return (
    <Screen>
      <Stack>
        <AppHeader title={t('hh.title')} onBack={() => nav.pop()} />
        <p className="app-note">{household.membership.name}</p>
        {snapshot.removed ? (
          <Card tone="danger">
            <Stack>
              <p role="alert" className="app-banner">
                {t('hh.thisRemoved')}
              </p>
              <Button onClick={() => setLeaving(true)}>{t('hh.leave')}</Button>
            </Stack>
          </Card>
        ) : (
          <p className="app-note">
            {snapshot.status === 'off'
              ? t('hh.status.off')
              : !snapshot.listening
                ? t('hh.status.offline')
                : t(`hh.status.${snapshot.status}` as never)}
          </p>
        )}

        <Section title={t('hh.devices')}>
          <Stack>
            {devices.map((d) => {
              const met = household.lastMet[d.id];
              const mine = d.id === hh.deviceId;
              return (
                <Card key={d.id} compact>
                  <Stack gap="0.5rem">
                    <p className="app-banner">
                      {d.name}
                      {mine ? ` · ${t('hh.thisDevice')}` : ''}
                    </p>
                    <p className="app-note">
                      {t('hh.addedOn', { date: fmt.date(d.addedAt) })} · {follows(d)}
                    </p>
                    {!mine ? (
                      <p className="app-note">
                        {met ? t('hh.lastMet', { when: agoText(t, now, met) }) : t('hh.neverMet')}
                      </p>
                    ) : null}
                    <div className="ui-cluster">
                      {mine ? (
                        <>
                          <Button size="md" onClick={() => setRenaming(true)}>
                            {t('hh.rename')}
                          </Button>
                          <Button size="md" onClick={() => setFollowing(true)}>
                            {t('hh.follow')}
                          </Button>
                        </>
                      ) : (
                        <Button size="md" variant="danger" onClick={() => setRemoving(d)}>
                          {t('hh.removeConfirm')}
                        </Button>
                      )}
                    </div>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Section>

        {!snapshot.removed ? <HubSection /> : null}

        {!snapshot.removed ? (
          <>
            <Button variant="primary" fullWidth onClick={() => nav.push('addDevice')}>
              {t('hh.addDevice')}
            </Button>
            <Button fullWidth onClick={() => nav.push('upToDate')}>
              {t('hh.upToDate')}
            </Button>
            <Button fullWidth onClick={() => nav.push('updateFile')}>
              {t('hh.fileTitle')}
            </Button>
          </>
        ) : null}
        <Section title={t('hh.limitTitle')}>
          <Card>
            <Stack gap="0.5rem">
              <p className="app-help">{t('hh.limit')}</p>
              <p className="app-help">{t('hh.sealedNote')}</p>
            </Stack>
          </Card>
        </Section>
        {!snapshot.removed ? (
          <Button fullWidth onClick={() => setLeaving(true)}>
            {t('hh.leave')}
          </Button>
        ) : null}

        {renaming && me ? <RenameSheet current={me.name} onClose={() => setRenaming(false)} /> : null}
        {following && me ? <FollowSheet device={me} onClose={() => setFollowing(false)} /> : null}
        {removing ? (
          <Dialog
            title={t('hh.removeTitle', { name: removing.name })}
            message={t('hh.removeText')}
            tone="danger"
            onClose={() => setRemoving(null)}
            actions={
              <>
                <Button onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    void hh.removeDevice(removing.id).then(() => setRemoving(null));
                  }}
                >
                  {t('hh.removeConfirm')}
                </Button>
              </>
            }
          />
        ) : null}
        {leaving ? (
          <Dialog
            title={t('hh.leaveTitle')}
            message={t('hh.leaveText')}
            tone="danger"
            onClose={() => setLeaving(false)}
            actions={
              <>
                <Button onClick={() => setLeaving(false)}>{t('common.cancel')}</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    void hh.leave().then(() => setLeaving(false));
                  }}
                >
                  {t('hh.leave')}
                </Button>
              </>
            }
          />
        ) : null}
      </Stack>
    </Screen>
  );
}

function StartSheet({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const hh = useHousehold();
  const [name, setName] = useState('');
  const [device, setDevice] = useState('');
  return (
    <BottomSheet
      title={t('hh.startTitle')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={name.trim() === '' || device.trim() === ''}
          onClick={() => {
            void hh.start({ name, deviceName: device }).then(onClose);
          }}
        >
          {t('hh.startConfirm')}
        </Button>
      }
    >
      <Stack>
        <TextField
          label={t('hh.householdName')}
          help={t('hh.householdNameHelp')}
          value={name}
          onChange={setName}
          autoComplete="off"
        />
        <TextField
          label={t('hh.deviceName')}
          help={t('hh.deviceNameHelp')}
          value={device}
          onChange={setDevice}
          autoComplete="off"
        />
      </Stack>
    </BottomSheet>
  );
}

function RenameSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const { t } = useApp();
  const hh = useHousehold();
  const [name, setName] = useState(current);
  return (
    <BottomSheet
      title={t('hh.rename')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={name.trim() === ''}
          onClick={() => {
            void hh.rename(name).then(onClose);
          }}
        >
          {t('common.save')}
        </Button>
      }
    >
      <TextField label={t('hh.deviceName')} value={name} onChange={setName} autoComplete="off" />
    </BottomSheet>
  );
}

/** Which people a device keeps: everyone (also later ones), or only some. */
export function FollowChoice({
  all,
  ids,
  onChange,
}: {
  all: boolean;
  ids: string[];
  onChange: (value: { all: boolean; ids: string[] }) => void;
}) {
  const { t, patients } = useApp();
  return (
    <Stack>
      <ChoiceList
        label={t('hh.follow')}
        value={all ? 'all' : 'only'}
        onChange={(v) => onChange({ all: v === 'all', ids })}
        options={[
          { value: 'all', label: t('hh.followAll') },
          { value: 'only', label: t('hh.followOnly') },
        ]}
      />
      {!all
        ? patients.map((p) => (
            <Checkbox
              key={p.id}
              label={p.name}
              checked={ids.includes(p.id)}
              onChange={(on) => onChange({ all, ids: on ? [...ids, p.id] : ids.filter((x) => x !== p.id) })}
            />
          ))
        : null}
      <p className="app-help">{t('hh.followHelp')}</p>
    </Stack>
  );
}

function FollowSheet({ device, onClose }: { device: DeviceInfo; onClose: () => void }) {
  const { t } = useApp();
  const hh = useHousehold();
  const [choice, setChoice] = useState({ all: device.followAll, ids: [...device.follows] });
  return (
    <BottomSheet
      title={t('hh.follow')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            void hh.setFollows(choice).then(onClose);
          }}
        >
          {t('common.save')}
        </Button>
      }
    >
      <FollowChoice {...choice} onChange={setChoice} />
    </BottomSheet>
  );
}

const HUB_ERRORS: Record<Exclude<HubLinkResult, 'ok'>, string> = {
  unreachable: 'hub.err.unreachable',
  wrong_code: 'hub.err.wrong_code',
  not_a_hub: 'hub.err.not_a_hub',
  not_allowed: 'hub.err.not_allowed',
  no_household: 'hub.err.no_household',
};

/** The household's hub: connect one with its address and code, see whether it is in step, sync now, switch it off. */
function HubSection() {
  const { t, fmt } = useApp();
  const hh = useHousehold();
  const [connecting, setConnecting] = useState(false);
  const [off, setOff] = useState(false);
  const [now] = useState(() => Date.now());
  const config = hh.snapshot.household ? hubOf(hh.snapshot.household.membership) : null;
  const hub = hh.snapshot.hub;
  return (
    <Section title={t('hub.title')}>
      <Card>
        <Stack gap="0.5rem">
          {config ? (
            <>
              <p className="app-banner">{t('hub.connected', { address: config.url })}</p>
              <p role="status" className="app-note">
                {t(`hub.state.${hub.state}` as never)}
              </p>
              <p className="app-help">
                {hub.lastAt
                  ? t('hub.last', { when: `${agoText(t, now, hub.lastAt)} · ${fmt.when(hub.lastAt)}` })
                  : t('hub.never')}
              </p>
              {hub.unreadable > 0 ? (
                <p role="status" className="app-banner">
                  {t('hub.unreadable', { count: hub.unreadable })}
                </p>
              ) : null}
              <div className="ui-cluster">
                <Button size="md" onClick={hh.searchNow}>
                  {t('hub.syncNow')}
                </Button>
                <Button size="md" onClick={() => setOff(true)}>
                  {t('hub.off')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="app-help">{t('hub.none')}</p>
              <p className="app-help">{t('hub.noneLimit')}</p>
              <Button onClick={() => setConnecting(true)}>{t('hub.connect')}</Button>
            </>
          )}
          <p className="app-help">{t('hub.sealed')}</p>
        </Stack>
      </Card>
      {config ? <AlertsSection /> : null}
      {connecting ? <ConnectSheet onClose={() => setConnecting(false)} /> : null}
      {off ? (
        <Dialog
          title={t('hub.offTitle')}
          message={t('hub.offText')}
          onClose={() => setOff(false)}
          actions={
            <>
              <Button onClick={() => setOff(false)}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  void hh.disconnectHub().then(() => setOff(false));
                }}
              >
                {t('hub.offConfirm')}
              </Button>
            </>
          }
        />
      ) : null}
    </Section>
  );
}

function ConnectSheet({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const hh = useHousehold();
  const [url, setUrl] = useState('https://');
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const elsewhere = (() => {
    try {
      const u = new URL(url.trim());
      return u.origin !== window.location.origin && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : null;
    } catch {
      return null;
    }
  })();
  const insecure =
    url.trim() !== '' &&
    !/^https:\/\//i.test(url.trim()) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(url.trim());
  return (
    <BottomSheet
      title={t('hub.connect')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={busy || insecure || url.trim().length < 9 || code.trim() === ''}
          onClick={() => {
            setBusy(true);
            setProblem(null);
            void hh
              .connectHub({ url, adminCode: code })
              .then((r) => (r === 'ok' ? onClose() : setProblem(t(HUB_ERRORS[r] as never))))
              .finally(() => setBusy(false));
          }}
        >
          {t('hub.go')}
        </Button>
      }
    >
      <Stack>
        <TextField
          label={t('hub.address')}
          help={t('hub.addressHelp')}
          value={url}
          onChange={setUrl}
          autoComplete="off"
          autoCapitalize="none"
          error={insecure ? t('hub.err.insecure') : undefined}
        />
        <TextField
          label={t('hub.code')}
          help={t('hub.codeHelp')}
          value={code}
          onChange={setCode}
          autoComplete="off"
          autoCapitalize="characters"
        />
        {elsewhere ? <p className="app-help">{t('hub.openFromHub', { address: elsewhere })}</p> : null}
        {problem ? (
          <p role="alert" className="app-banner">
            {problem}
          </p>
        ) : null}
      </Stack>
    </BottomSheet>
  );
}

const EVENTS = ['started', 'alert', 'recorded'] as const;

/** Alerts on this device: a notification when another device starts recording, passes the alert time or has recorded, with the app closed. */
function AlertsSection() {
  const { t, api, settings, patients, actions } = useApp();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const support = pushSupport();
  const display = { title: t('push.notificationTitle'), body: t('push.notificationBody') };
  const prefs = (events: readonly string[], ids: readonly string[]): PushPrefs => ({
    events: [...events],
    patients: ids.length === 0 ? null : [...ids],
  });
  const connection = async () => {
    const local = await hubLocalOf(api).load();
    return local ? { url: local.url, token: local.token } : null;
  };

  const turnOn = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const conn = await connection();
      const result = conn
        ? await enablePush(conn, prefs(settings.pushEvents, settings.pushPatientIds), display)
        : 'failed';
      if (result === 'ok') await actions.setSetting('pushEnabled', true);
      else setProblem(t(result === 'denied' ? 'push.err.denied' : 'push.err.failed'));
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush(await connection());
      await actions.setSetting('pushEnabled', false);
    } finally {
      setBusy(false);
    }
  };
  const change = async (events: readonly string[], ids: readonly string[]) => {
    await actions.setSetting('pushEvents', events as never);
    await actions.setSetting('pushPatientIds', [...ids]);
    const conn = await connection();
    if (conn && settings.pushEnabled) await updatePush(conn, prefs(events, ids), display);
  };

  return (
    <Section title={t('push.title')}>
      <Card>
        <Stack gap="0.5rem">
          <p className="app-help">{t('push.help')}</p>
          {support !== 'ready' ? (
            <p role="status" className="app-banner">
              {t(`push.state.${support}` as never)}
            </p>
          ) : (
            <>
              <Toggle
                label={t('push.on')}
                value={settings.pushEnabled}
                onChange={(on) => void (busy ? undefined : on ? turnOn() : turnOff())}
              />
              {settings.pushEnabled ? (
                <>
                  <p className="app-note">{t('push.events')}</p>
                  {EVENTS.map((e) => (
                    <Checkbox
                      key={e}
                      label={t(`push.event.${e}` as never)}
                      checked={settings.pushEvents.includes(e)}
                      onChange={(on) =>
                        void change(
                          on ? [...settings.pushEvents, e] : settings.pushEvents.filter((x) => x !== e),
                          settings.pushPatientIds,
                        )
                      }
                    />
                  ))}
                  {patients.length > 1 ? (
                    <>
                      <p className="app-note">{t('push.people')}</p>
                      <Checkbox
                        label={t('push.everyone')}
                        checked={settings.pushPatientIds.length === 0}
                        onChange={() => void change(settings.pushEvents, [])}
                      />
                      {patients.map((p) => (
                        <Checkbox
                          key={p.id}
                          label={p.name}
                          checked={settings.pushPatientIds.includes(p.id)}
                          onChange={(on) =>
                            void change(
                              settings.pushEvents,
                              on
                                ? [...settings.pushPatientIds, p.id]
                                : settings.pushPatientIds.filter((x) => x !== p.id),
                            )
                          }
                        />
                      ))}
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}
          {problem ? (
            <p role="alert" className="app-banner">
              {problem}
            </p>
          ) : null}
          <p className="app-help">{t('push.requirements')}</p>
          <p className="app-help">{t('push.limit')}</p>
          <p className="app-help">{t('push.locked')}</p>
        </Stack>
      </Card>
    </Section>
  );
}
