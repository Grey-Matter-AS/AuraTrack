import { activeDevices, effectiveFollows, type DeviceInfo } from '@auratrack/sync';
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
} from '@auratrack/ui';
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { agoText } from '../household/ago';
import { useHousehold } from '../household/HouseholdContext';
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
