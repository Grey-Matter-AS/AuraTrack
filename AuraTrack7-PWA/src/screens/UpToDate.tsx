import { activeDevices, hubOf } from '@auratrack/sync';
import { AppHeader, Button, Card, Screen, Section, Stack } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { agoText } from '../household/ago';
import { useHousehold } from '../household/HouseholdContext';
import './screens.css';

/** "Household up to date?": each device, when it was last met, what is still to come, and a way to look right now. */
export function UpToDate() {
  const { t, fmt } = useApp();
  const hh = useHousehold();
  const nav = useNav();
  const [now] = useState(() => Date.now());
  const { snapshot } = hh;
  const household = snapshot.household;
  const last = snapshot.last;
  const devices = household ? activeDevices(household.membership).filter((d) => d.id !== hh.deviceId) : [];
  const meetingText = last
    ? t(`hh.meeting.${last.outcome}` as never, { name: last.peerName, applied: last.applied, sent: last.sent })
    : t('hh.never');
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('hh.upToDate')} onBack={() => nav.pop()} />
        <p className="app-note">
          {snapshot.status === 'off'
            ? t('hh.status.off')
            : !snapshot.listening
              ? t('hh.status.offline')
              : t(`hh.status.${snapshot.status}` as never)}
        </p>
        <Button
          variant="primary"
          fullWidth
          disabled={snapshot.status === 'off' || snapshot.removed}
          onClick={hh.searchNow}
        >
          {t('hh.lookNow')}
        </Button>
        {household && hubOf(household.membership) ? (
          <Section title={t('hub.row')}>
            <Card compact>
              <Stack gap="0.25rem">
                <p className="app-banner">{t(`hub.state.${snapshot.hub.state}` as never)}</p>
                {snapshot.hub.unreadable > 0 ? (
                  <p role="status" className="app-note">
                    {t('hub.unreadable', { count: snapshot.hub.unreadable })}
                  </p>
                ) : null}
                <p className="app-note">
                  {snapshot.hub.lastAt
                    ? t('hub.last', {
                        when: `${agoText(t, now, snapshot.hub.lastAt)} · ${fmt.when(snapshot.hub.lastAt)}`,
                      })
                    : t('hub.never')}
                </p>
              </Stack>
            </Card>
          </Section>
        ) : null}
        <Section title={t('hh.devices')}>
          <Stack>
            {devices.map((d) => {
              const met = household?.lastMet[d.id];
              return (
                <Card key={d.id} compact>
                  <Stack gap="0.25rem">
                    <p className="app-banner">{d.name}</p>
                    <p className="app-note">
                      {met
                        ? `${t('hh.lastMet', { when: agoText(t, now, met) })} · ${fmt.when(met)}`
                        : t('hh.waitingFor', { name: d.name })}
                    </p>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Section>
        <Section title={t('hh.lastMeeting')}>
          <Card compact>
            <p className="app-note">{meetingText}</p>
            {last ? <p className="app-help">{agoText(t, now, last.at)}</p> : null}
          </Card>
        </Section>
        <p className="app-help">{t('hh.limit')}</p>
      </Stack>
    </Screen>
  );
}
