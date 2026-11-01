// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiStringsProvider } from './strings';
import { Tabs, type TabItem } from './Tabs';

afterEach(cleanup);

const tabs: TabItem[] = [
  { id: 'before', label: 'Before', state: 'not filled in yet' },
  { id: 'during', label: 'During', state: '2 added' },
  { id: 'after', label: 'After' },
];

function Harness({ start = 'before', onChange }: { start?: string; onChange?: (id: string) => void }) {
  const [active, setActive] = useState(start);
  return (
    <Tabs
      tabs={tabs}
      activeTab={active}
      label="Seizure"
      onTabChange={(id) => {
        onChange?.(id);
        setActive(id);
      }}
    >
      <p>content of {active}</p>
    </Tabs>
  );
}

describe('Tabs, wide', () => {
  it('is a tablist with a tab per item, the chosen one selected, and a panel labelled by it', () => {
    render(<Harness start="during" />);
    const list = screen.getByRole('tablist', { name: 'Seizure' });
    const items = within(list).getAllByRole('tab');
    expect(items.map((t) => [t.textContent, t.getAttribute('aria-selected')])).toEqual([
      ['Before', 'false'],
      ['During', 'true'],
      ['After', 'false'],
    ]);
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(items[1]!.id);
    expect(items[1]!.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('content of during');
  });

  it('only the selected tab is in the tab order', () => {
    render(<Harness start="during" />);
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('a click changes the tab and the content below it', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'After' }));
    expect(onChange).toHaveBeenCalledWith('after');
    expect(screen.getByRole('tabpanel').textContent).toBe('content of after');
  });

  it('arrow keys move between tabs and wrap round; Home and End go to the ends; focus follows', async () => {
    render(<Harness />);
    screen.getByRole('tab', { name: 'Before' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'During' }));
    expect(screen.getByRole('tabpanel').textContent).toBe('content of during');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'After' }));
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Before' }));
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'After' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Before' }).getAttribute('aria-selected')).toBe('true');
  });

  it('other keys do nothing', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole('tab', { name: 'Before' }).focus();
    await userEvent.keyboard('{ArrowDown}a');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an unknown active tab shows the first; no tabs shows nothing', () => {
    const { container, rerender } = render(
      <Tabs tabs={tabs} activeTab="nope" label="L" onTabChange={() => {}}>
        x
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Before' }).getAttribute('aria-selected')).toBe('true');
    rerender(
      <Tabs tabs={[]} activeTab="" label="L" onTabChange={() => {}}>
        x
      </Tabs>,
    );
    expect(container.firstElementChild).toBeNull();
  });
});

describe('Tabs, narrow control', () => {
  const picker = () => screen.getByRole('button', { name: /Choose a section/ });

  it('shows the name, "2 of 3", and a dot per tab with the chosen one marked', () => {
    const { container } = render(<Harness start="during" />);
    expect(picker().getAttribute('aria-label')).toBe('Choose a section: During, 2 of 3');
    expect(picker().textContent).toBe('During2 of 3');
    expect(picker().getAttribute('aria-haspopup')).toBe('dialog');
    const dots = [...container.querySelectorAll('.ui-tabs__dot')];
    expect(dots.map((d) => d.getAttribute('data-active'))).toEqual(['false', 'true', 'false']);
    expect(container.querySelector('.ui-tabs__dots')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('opens a list of all tabs with their state, the chosen one marked; choosing closes it and changes the tab', async () => {
    const onChange = vi.fn();
    render(<Harness start="during" onChange={onChange} />);
    await userEvent.click(picker());
    const dialog = screen.getByRole('dialog', { name: 'Seizure' });
    const rows = within(dialog).getAllByRole('button', { name: /Before|During|After/ });
    expect(rows.map((r) => r.textContent)).toEqual(['Beforenot filled in yet', 'During2 added', 'After']);
    expect(rows[1]!.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(rows[2]!);
    expect(onChange).toHaveBeenCalledWith('after');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tabpanel').textContent).toBe('content of after');
  });

  it('the list closes without a change on Escape', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(picker());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the language of the app for the position and the name', () => {
    render(
      <UiStringsProvider strings={{ chooseTab: 'Velg del', position: (n, t) => `${n} av ${t}` }}>
        <Harness />
      </UiStringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'Velg del: Before, 1 av 3' })).toBeTruthy();
  });
});
