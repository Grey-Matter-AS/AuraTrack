// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoundButton, RoundButtonRow } from './Buttons';
import { EventChart, TimeSeriesChart } from './Charts';
import { Disclosure, NavList } from './Containers';
import { DurationField, formatHms } from './Fields';
import { DataTable } from './Table';

// The kit parts added in M8: the HH:MM:SS field, the row that opens, the grouped list, the round-button row, the
// time-series chart and the plain table.

afterEach(cleanup);

function Duration({ start = null, onValue }: { start?: number | null; onValue?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(start);
  return (
    <DurationField
      label="Seizure"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe('DurationField', () => {
  it('is one box, HH:MM:SS, filled from the right like a microwave', async () => {
    const onValue = vi.fn();
    render(<Duration onValue={onValue} />);
    const box = screen.getByLabelText('Seizure') as HTMLInputElement;
    expect(box.placeholder).toBe('00:00:00');
    await userEvent.type(box, '125');
    expect(box.value).toBe('00:01:25');
    expect(onValue).toHaveBeenLastCalledWith(85);
    await userEvent.type(box, '00');
    expect(box.value).toBe('01:25:00');
    expect(onValue).toHaveBeenLastCalledWith(5100);
  });

  it('takes the last digit off with Backspace, and an empty box is nothing entered, not zero', async () => {
    const onValue = vi.fn();
    render(<Duration onValue={onValue} />);
    const box = screen.getByLabelText('Seizure') as HTMLInputElement;
    await userEvent.type(box, '45');
    await userEvent.type(box, '{Backspace}');
    expect(box.value).toBe('00:00:04');
    await userEvent.type(box, '{Backspace}');
    expect(onValue).toHaveBeenLastCalledWith(null);
    await userEvent.type(box, '0');
    expect(onValue).toHaveBeenLastCalledWith(0);
  });

  it('tidies the time on leaving (90 seconds is 00:01:30) and shows a value it was given', async () => {
    render(<Duration />);
    const box = screen.getByLabelText('Seizure') as HTMLInputElement;
    await userEvent.type(box, '90');
    fireEvent.blur(box);
    expect(box.value).toBe('00:01:30');
    cleanup();
    render(<Duration start={3725} />);
    expect((screen.getByLabelText('Seizure') as HTMLInputElement).value).toBe('01:02:05');
  });

  it('formats any length as HH:MM:SS', () => {
    expect(formatHms(0)).toBe('00:00:00');
    expect(formatHms(59.6)).toBe('00:01:00');
    expect(formatHms(7 * 3600 + 5)).toBe('07:00:05');
  });
});

describe('Disclosure', () => {
  it('reads as a control: says whether it is open, shows its summary, and opens on a tap', async () => {
    render(
      <Disclosure title="Possible triggers" summary="2 chosen">
        <p>Stress</p>
      </Disclosure>,
    );
    const head = screen.getByRole('button', { name: /Possible triggers/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.textContent).toContain('2 chosen');
    expect(head.textContent).toContain('Show');
    expect(screen.queryByText('Stress')).toBeNull();
    await userEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(head.textContent).toContain('Hide');
    expect(screen.getByText('Stress')).toBeTruthy();
  });
});

describe('NavList', () => {
  it('is a list under its heading; each row is named by its label and described by its line', async () => {
    const onClick = vi.fn();
    render(
      <NavList
        title="Records"
        items={[
          { id: 'reports', label: 'Reports', description: 'For your neurologist', onClick },
          { id: 'backup', label: 'Backup', onClick: vi.fn() },
        ]}
      />,
    );
    expect(screen.getByRole('region', { name: 'Records' })).toBeTruthy();
    const row = screen.getByRole('button', { name: 'Reports' });
    expect(row.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('For your neurologist').id).toBe(row.getAttribute('aria-describedby'));
    await userEvent.click(row);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows nothing when there are no rows', () => {
    const { container } = render(<NavList title="Empty" items={[]} />);
    expect(container.textContent).toBe('');
  });
});

describe('RoundButtonRow', () => {
  it('keeps its buttons in one row, and a label written over lines is announced as one phrase', () => {
    render(
      <RoundButtonRow>
        <RoundButton tone="danger">{'Start\ntimer'}</RoundButton>
        <RoundButton tone="warning">{'Log past\nseizure'}</RoundButton>
        <RoundButton tone="neutral">{'Log\nsymptoms\nbetween\nseizures'}</RoundButton>
      </RoundButtonRow>,
    );
    expect(screen.getByRole('button', { name: 'Start timer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log symptoms between seizures' }).className).toContain(
      'ui-round--neutral',
    );
    expect(document.querySelector('.ui-round-row')?.children).toHaveLength(3);
  });
});

describe('TimeSeriesChart', () => {
  const points = [
    { sub: 'Mon', label: '3 Nov', value: 2, marked: 1 },
    { sub: 'Tue', label: '4 Nov', value: 0, marked: 0 },
    { sub: 'Wed', label: '5 Nov', value: 1, marked: 0 },
  ];

  it('is one picture named in words, with whole-number ticks, the count on the bars and day-and-date labels', () => {
    render(<TimeSeriesChart label="Seizures per day: 3 in all" points={points} />);
    const chart = screen.getByRole('img', { name: 'Seizures per day: 3 in all' });
    const text = chart.textContent ?? '';
    expect(text).toContain('Mon');
    expect(text).toContain('3 Nov');
    // ticks 0, 1, 2 and the counts 2 and 1 (no count on the empty day)
    expect(chart.querySelectorAll('.ui-series__count')).toHaveLength(2);
    expect(chart.querySelectorAll('.ui-series__marked')).toHaveLength(1);
  });

  it('draws the reference lines it is given, and tells which bar was tapped', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TimeSeriesChart label="x" points={points} average={1} limit={4} onSelect={onSelect} selected={2} />,
    );
    expect(container.querySelector('.ui-series__average')).toBeTruthy();
    expect(container.querySelector('.ui-series__limit')).toBeTruthy();
    expect(container.querySelector('.ui-series__selected')).toBeTruthy();
    fireEvent.click(container.querySelectorAll('.ui-series__hit')[1]!);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('DataTable', () => {
  it('has a caption, column headings, a heading for each row, and a total row', () => {
    render(
      <DataTable
        caption="Daily total"
        columns={[{ title: 'Time' }, { title: 'Dose', numeric: true }]}
        rows={[
          ['08:00', '500 mg'],
          ['20:00', '500 mg'],
        ]}
        footer={['Per day', '1,000 mg']}
      />,
    );
    expect(screen.getByRole('table', { name: 'Daily total' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Time', 'Dose']);
    expect(screen.getByRole('rowheader', { name: '08:00' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Per day' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Daily total' })).toBeTruthy();
  });
});

describe('EventChart (the History timeline)', () => {
  it('writes how many seizures a circle holds: the same day shares a circle, different days never do', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <EventChart
        label="x"
        ticks={[]}
        onOpen={onOpen}
        events={[
          { id: 'a', at: 0.1, kind: 'seizure', size: 0.2, day: '2026-11-01' },
          { id: 'b', at: 0.5, kind: 'seizure', size: 0.1, day: '2026-11-04' },
          { id: 'c', at: 0.52, kind: 'seizure', size: 0.6, long: true, day: '2026-11-04' },
          // close to the others, but the next day: its own circle
          { id: 'd', at: 0.53, kind: 'seizure', size: 0.1, day: '2026-11-05' },
          { id: 'e', at: 0.5, kind: 'between' },
        ]}
      />,
    );
    const counts = [...container.querySelectorAll('.ui-chart__count')].map((t) => t.textContent);
    expect(counts).toEqual(['1', '2', '1']);
    // The shared circle keeps the alert ring of its long seizure
    expect(container.querySelectorAll('.ui-chart__long')).toHaveLength(1);
    expect(container.querySelectorAll('.ui-chart__between')).toHaveLength(1);
    const circles = container.querySelectorAll('.ui-chart__seizure');
    const second = circles.item(1);
    if (second) fireEvent.click(second);
    expect(onOpen).toHaveBeenCalledWith('b');
  });
});
