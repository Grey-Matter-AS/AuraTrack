// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox, ChipGroup, ChoiceList, Toggle } from './Choices';

afterEach(cleanup);

const options = [
  { value: 'a', label: 'Alpha', detail: 'first' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('ChipGroup', () => {
  it('single choice: marks the chosen chip and reports a new choice', async () => {
    const onChange = vi.fn();
    render(<ChipGroup label="Letters" options={options} value="b" onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Letters' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('shows its label when asked, and it still names the group', () => {
    render(<ChipGroup label="Letters" showLabel options={options} value="b" onChange={vi.fn()} />);
    expect(screen.getByText('Letters')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Letters' })).toBeTruthy();
  });

  it('keeps its label for screen readers only by default', () => {
    render(<ChipGroup label="Letters" options={options} value="b" onChange={vi.fn()} />);
    expect(screen.queryByText('Letters')).toBeNull();
  });

  it('multiple choice: adds and removes, keeping the order it was given', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ChipGroup multiple label="Letters" options={options} value={['a']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    rerender(<ChipGroup multiple label="Letters" options={options} value={['a', 'b']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });

  it('nothing chosen yet is allowed, and fill makes the chips share the row', () => {
    const { container } = render(<ChipGroup fill label="Letters" options={options} value={null} onChange={() => {}} />);
    expect(screen.getAllByRole('button').every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(container.firstElementChild?.className).toBe('ui-chip-group ui-chip-group--fill');
  });
});

describe('ChoiceList', () => {
  it('shows each choice with its detail, marks the chosen, and reports a choice', async () => {
    const onChange = vi.fn();
    render(<ChoiceList label="Pick" options={options} value="a" onChange={onChange} />);
    const first = screen.getByRole('button', { name: /Alpha/ });
    expect(first.textContent).toBe('Alphafirst');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Beta' }).querySelector('.ui-choice__detail')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });
});

describe('Toggle', () => {
  it('is a switch with a name, and flips the value it was given', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Toggle label="Reminders" value={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Reminders' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Toggle label="Reminders" value onChange={onChange} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe('Checkbox', () => {
  it('the label is the tap target, with optional help', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Assume taken" help="Fills in doses" />);
    await userEvent.click(screen.getByText('Assume taken'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox', { name: /Assume taken/ })).toBeTruthy();
    expect(screen.getByText('Fills in doses')).toBeTruthy();
  });

  it('shows no help line without help, and shows a checked box', () => {
    const { container } = render(<Checkbox checked onChange={() => {}} label="x" />);
    expect(container.querySelector('.ui-check__help')).toBeNull();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
});
