// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventChart, TrendChart } from './Charts';

afterEach(cleanup);

describe('TrendChart', () => {
  it('is one picture with a spoken summary, and draws one bar per value', () => {
    render(
      <TrendChart
        label="Seizures per week, 12 in all"
        bars={[
          { label: '5 Oct', value: 2, marked: 1 },
          { label: '12 Oct', value: 0 },
          { label: '19 Oct', value: 4 },
        ]}
        markers={[{ index: 1, label: 'Dose changed' }]}
      />,
    );
    const chart = screen.getByRole('img', { name: 'Seizures per week, 12 in all' });
    expect(chart.querySelectorAll('.ui-chart__bar:not(.ui-chart__bar--marked)')).toHaveLength(3);
    expect(chart.querySelectorAll('.ui-chart__bar--marked')).toHaveLength(1);
    expect(chart.querySelectorAll('.ui-chart__marker')).toHaveLength(1);
    expect(chart.querySelector('g[aria-hidden="true"]')).not.toBeNull();
  });

  it('works with no bars at all', () => {
    render(<TrendChart label="Nothing yet" bars={[]} />);
    expect(screen.getByRole('img', { name: 'Nothing yet' }).querySelectorAll('.ui-chart__bar')).toHaveLength(0);
  });

  it('labels the axis a few times, not under every bar', () => {
    const bars = Array.from({ length: 30 }, (_, i) => ({ label: `d${i}`, value: i % 3 }));
    render(<TrendChart label="x" bars={bars} />);
    const labelled = [...document.querySelectorAll('.ui-chart__tick')].filter((t) =>
      /^d\d+$/.test(t.textContent ?? ''),
    );
    expect(labelled.length).toBeLessThanOrEqual(5);
  });
});

describe('EventChart', () => {
  const events = [
    { id: 's1', at: 0.2, kind: 'seizure' as const, size: 0.5, series: 2, long: true },
    { id: 's2', at: 0.4, kind: 'seizure' as const, open: true },
    { id: 'b1', at: 0.5, kind: 'between' as const },
    { id: 'm1', at: 0.6, kind: 'medication' as const },
    { id: 'x1', at: 0.7, kind: 'missed' as const },
  ];

  it('draws each kind of event in its own shape, a ring for a seizure with no end, and a second ring for a long one', () => {
    render(<EventChart events={events} ticks={[{ at: 0, label: 'Mon' }]} label="Timeline" />);
    expect(document.querySelectorAll('.ui-chart__seizure')).toHaveLength(2);
    expect(document.querySelectorAll('.ui-chart__seizure--open')).toHaveLength(1);
    expect(document.querySelectorAll('.ui-chart__long')).toHaveLength(1);
    expect(document.querySelectorAll('.ui-chart__between')).toHaveLength(1);
    expect(document.querySelectorAll('.ui-chart__marker')).toHaveLength(1);
    expect(document.querySelectorAll('.ui-chart__missed')).toHaveLength(1);
    expect(screen.getByText('Mon')).toBeTruthy();
  });

  it('reports the id of the shape that was tapped', () => {
    const onOpen = vi.fn();
    render(<EventChart events={events} ticks={[]} label="Timeline" onOpen={onOpen} />);
    fireEvent.click(document.querySelector('.ui-chart__between')!);
    fireEvent.click(document.querySelector('.ui-chart__missed')!);
    expect(onOpen.mock.calls).toEqual([['b1'], ['x1']]);
  });

  it('keeps a position outside 0 to 1 on the axis', () => {
    render(<EventChart events={[{ id: 'e', at: 3, kind: 'between' }]} ticks={[]} label="t" />);
    const box = document.querySelector('.ui-chart__between')!;
    expect(Number(box.getAttribute('x'))).toBeLessThanOrEqual(320);
  });
});
