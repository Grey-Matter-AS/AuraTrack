import {
  AppHeader,
  Card,
  EventChart,
  NavBar,
  PhaseStrip,
  PhaseTimeline,
  Screen,
  Section,
  Stack,
  TrendChart,
  type ChartEvent,
  type TimelineEntry,
} from '@auratrack/ui';
import { useState } from 'react';

// The kit parts added in M4, on their own page (#/kitchen/m4) so the baseline pictures of the main kitchen sink stay as they
// are. The layout audit walks this page too.

const LONG = 'A very long label that has to wrap instead of running off the screen or covering its neighbour';

const entries: TimelineEntry[] = [
  { kind: 'marker', id: 'a', text: 'Start · 14:05:00', phase: 'aura' },
  { kind: 'gap', id: 'g0', text: 'Warning signs began 30 seconds before' },
  { kind: 'moment', id: 'b', name: 'Deja vu', meta: 'Before', phase: 'before', first: true },
  { kind: 'gap', id: 'g1', text: 'About 10 s later' },
  { kind: 'moment', id: 'c', name: LONG, meta: `During · ${LONG}`, phase: 'during' },
  { kind: 'marker', id: 'd', text: 'Seizure ends · 14:07:10', phase: 'seizure' },
  { kind: 'moment', id: 'e', name: 'Confusion', meta: '', phase: 'after' },
  { kind: 'marker', id: 'f', text: 'Back to normal · 14:20:00', phase: 'recovery' },
];

const bars = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1} Oct`,
  value: [0, 1, 3, 2, 0, 0, 4, 1, 2, 5, 0, 1][i] ?? 0,
  marked: i === 9 ? 2 : 0,
}));

const events: ChartEvent[] = [
  { id: '1', at: 0.05, kind: 'seizure', size: 0.2, series: 1 },
  { id: '2', at: 0.3, kind: 'seizure', size: 1, series: 2, long: true },
  { id: '3', at: 0.31, kind: 'seizure', size: 0.4, series: 3, open: true },
  { id: '4', at: 0.5, kind: 'between' },
  { id: '5', at: 0.62, kind: 'medication' },
  { id: '6', at: 0.8, kind: 'missed' },
  { id: '7', at: 0.97, kind: 'seizure', size: 0.6, series: 8 },
];

export default function KitchenM4() {
  const [place, setPlace] = useState('home');
  return (
    <Screen>
      <Stack>
        <AppHeader
          title="Kitchen sink, M4"
          patient={{ name: 'Ola Nordmann-Hansen with a very long name', color: '#7e22ce' }}
        />
        <Section title="Main menu">
          <NavBar
            label="Main menu"
            current={place}
            onSelect={setPlace}
            items={[
              { id: 'home', label: 'Home' },
              { id: 'history', label: 'History' },
              { id: 'meds', label: 'Medicines' },
              { id: 'more', label: 'More' },
            ]}
          />
          <NavBar
            label="Long names"
            current="a"
            onSelect={() => undefined}
            items={[
              { id: 'a', label: 'Sykdomshistorie' },
              { id: 'b', label: 'Legemidler' },
              { id: 'c', label: 'Innstillinger' },
              { id: 'd', label: 'Lääkitys ja annokset' },
            ]}
          />
        </Section>
        <Section title="Seizure timeline">
          <Card>
            <Stack>
              <PhaseStrip
                aura={30_000}
                seizure={130_000}
                recovery={770_000}
                label="Overview"
                legend={{ aura: 'Aura 0:30', seizure: 'Seizure 2:10', recovery: 'Recovery 12:50' }}
              />
              <PhaseTimeline entries={entries} label="Seizure timeline" />
            </Stack>
          </Card>
        </Section>
        <Section title="Charts">
          <Card>
            <TrendChart
              label="Seizures per day"
              bars={bars}
              markers={[
                { index: 3, label: 'Dose changed' },
                { index: 8, label: 'Stopped' },
              ]}
            />
          </Card>
          <Card>
            <EventChart
              label="Timeline of seven events"
              events={events}
              ticks={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ at: i / 7, label }))}
            />
          </Card>
        </Section>
      </Stack>
    </Screen>
  );
}
