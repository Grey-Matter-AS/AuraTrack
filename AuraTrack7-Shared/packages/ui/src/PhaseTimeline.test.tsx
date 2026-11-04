// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhaseStrip, PhaseTimeline, type TimelineEntry } from './PhaseTimeline';

afterEach(cleanup);

const entries: TimelineEntry[] = [
  { kind: 'marker', id: 'a', text: 'Start · 14:05:00', phase: 'aura' },
  { kind: 'moment', id: 'b', name: 'Strange smell', meta: 'Before', phase: 'before', first: true },
  { kind: 'gap', id: 'c', text: '12 s later' },
  { kind: 'moment', id: 'd', name: 'Shaking', meta: 'During · Left arm', phase: 'during' },
  { kind: 'marker', id: 'e', text: 'Seizure ends · 14:07:00', phase: 'seizure' },
];

describe('PhaseTimeline', () => {
  it('lists markers, gaps and moments in the order given, as one named list', () => {
    render(<PhaseTimeline entries={entries} label="Timeline of the seizure" />);
    const list = screen.getByRole('list', { name: 'Timeline of the seizure' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Start · 14:05:00',
      '★ Strange smellBefore',
      '12 s later',
      'ShakingDuring · Left arm',
      'Seizure ends · 14:07:00',
    ]);
  });

  it('marks the first symptom with a star and no other', () => {
    render(<PhaseTimeline entries={entries} label="t" />);
    expect(screen.getAllByText(/★/)).toHaveLength(1);
  });

  it('leaves out the second line of a symptom that has nothing more to say', () => {
    render(
      <PhaseTimeline entries={[{ kind: 'moment', id: 'x', name: 'Confusion', meta: '', phase: 'after' }]} label="t" />,
    );
    expect(document.querySelector('.ui-timeline__meta')).toBeNull();
  });
});

describe('PhaseStrip', () => {
  it('sizes the three parts by their share of the whole, and names them in the legend', () => {
    render(
      <PhaseStrip
        aura={30_000}
        seizure={90_000}
        recovery={180_000}
        label="Overview"
        legend={{ aura: 'Aura 0:30', seizure: 'Seizure 1:30', recovery: 'Recovery 3:00' }}
      />,
    );
    const bar = screen.getByRole('img', { name: 'Overview' });
    const widths = [...bar.querySelectorAll('span')].map((s) => s.style.width);
    expect(widths).toEqual(['10%', '30%', '60%']);
    expect(screen.getByText('Recovery 3:00')).toBeTruthy();
  });

  it('does not divide by zero when nothing has a length yet', () => {
    render(
      <PhaseStrip aura={0} seizure={0} recovery={0} label="o" legend={{ aura: 'a', seizure: 's', recovery: 'r' }} />,
    );
    expect([...screen.getByRole('img').querySelectorAll('span')].map((s) => s.style.width)).toEqual(['0%', '0%', '0%']);
  });
});
