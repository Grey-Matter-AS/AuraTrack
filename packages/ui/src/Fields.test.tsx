// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateTimeField, DecimalField, FieldRow, NumberField, Select, TextArea, TextField } from './Fields';
import { UiStringsProvider } from './strings';

afterEach(cleanup);

describe('TextField and TextArea', () => {
  it('ties the label to the input, and reports typing', async () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'A');
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('is never blank: the label is the hint, unless a placeholder is given', () => {
    const { rerender } = render(<TextField label="Name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Name').getAttribute('placeholder')).toBe('Name');
    rerender(<TextField label="Name" placeholder="Full name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Name').getAttribute('placeholder')).toBe('Full name');
  });

  it('shows help and an error, linked to the field, and marks it invalid', () => {
    render(<TextField label="Name" help="As on the card" error="Required" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = input.getAttribute('aria-describedby')!.split(' ');
    expect(described).toHaveLength(2);
    expect(document.getElementById(described[0]!)?.textContent).toBe('As on the card');
    expect(screen.getByRole('alert').textContent).toBe('Required');
  });

  it('with no label, help or error it is the bare input', () => {
    const { container } = render(<TextField value="x" onChange={() => {}} aria-label="bare" />);
    expect(container.querySelector('.ui-field-wrap')).toBeNull();
    expect(screen.getByLabelText('bare').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('bare').getAttribute('aria-describedby')).toBeNull();
  });

  it('TextArea has rows, a label, and can be disabled', async () => {
    const onChange = vi.fn();
    render(<TextArea label="Notes" rows={5} value="" onChange={onChange} />);
    const area = screen.getByLabelText('Notes') as HTMLTextAreaElement;
    expect(area.rows).toBe(5);
    await userEvent.type(area, 'z');
    expect(onChange).toHaveBeenCalledWith('z');
  });

  it('TextArea defaults to 3 rows and shows an error', () => {
    render(<TextArea label="Notes" error="Too long" value="" onChange={() => {}} disabled />);
    const area = screen.getByLabelText('Notes') as HTMLTextAreaElement;
    expect(area.rows).toBe(3);
    expect(area.disabled).toBe(true);
    expect(area.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('DateTimeField', () => {
  it('shows its own hint and icon while empty, and the hint goes when it has a value', () => {
    const { container, rerender } = render(<DateTimeField label="Day" value="" onChange={() => {}} />);
    expect(container.querySelector('.ui-date__hint')?.textContent).toBe('Select date');
    expect(container.querySelector('.ui-date__icon svg')).toBeTruthy();
    expect(container.querySelector('.ui-date--empty')).toBeTruthy();
    rerender(<DateTimeField label="Day" value="2026-10-31" onChange={() => {}} />);
    expect(container.querySelector('.ui-date__hint')).toBeNull();
  });

  it('hides the hint while focused, and brings it back when left empty', async () => {
    const { container } = render(<DateTimeField label="Day" value="" onChange={() => {}} />);
    await userEvent.click(screen.getByLabelText('Day'));
    expect(container.querySelector('.ui-date__hint')).toBeNull();
    await userEvent.tab();
    expect(container.querySelector('.ui-date__hint')).toBeTruthy();
  });

  it.each([
    ['time', 'Select time'],
    ['datetime-local', 'Select date & time'],
    ['month', 'Select month'],
    ['date', 'Select date'],
  ] as const)('the %s field says "%s", in the language of the app', (type, hint) => {
    const { container, unmount } = render(<DateTimeField type={type} value="" onChange={() => {}} />);
    expect(container.querySelector('.ui-date__hint')?.textContent).toBe(hint);
    expect(screen.getByLabelText(hint)).toBeTruthy(); // no label: the hint is its name
    unmount();
    const { container: translated } = render(
      <UiStringsProvider
        strings={{ selectDate: 'Velg dato', selectTime: 'Velg tid', selectDateTime: 'x', selectMonth: 'y' }}
      >
        <DateTimeField type={type} value="" onChange={() => {}} />
      </UiStringsProvider>,
    );
    expect(translated.querySelector('.ui-date__hint')?.textContent).toBe(
      { time: 'Velg tid', 'datetime-local': 'x', month: 'y', date: 'Velg dato' }[type],
    );
  });

  it('passes the typed value and limits on, and an own placeholder wins', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateTimeField
        label="Day"
        placeholder="Pick a day"
        min="2026-01-01"
        max="2026-12-31"
        value=""
        onChange={onChange}
        error="Bad"
      />,
    );
    const input = screen.getByLabelText('Day') as HTMLInputElement;
    expect(input.min).toBe('2026-01-01');
    expect(input.max).toBe('2026-12-31');
    expect(container.querySelector('.ui-date__hint')?.textContent).toBe('Pick a day');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('reports a change, using the clock icon for time', () => {
    const onChange = vi.fn();
    const { container } = render(<DateTimeField type="time" label="At" value="" onChange={onChange} />);
    const input = screen.getByLabelText('At') as HTMLInputElement;
    // The clock has a hand, the calendar has none
    expect(container.querySelector('.ui-date__icon circle')).toBeTruthy();
    fireEvent.change(input, { target: { value: '08:30' } });
    expect(onChange).toHaveBeenCalledWith('08:30');
  });
});

describe('NumberField', () => {
  function Harness({
    initial = 5,
    ...props
  }: {
    initial?: number;
    max?: number;
    maxLength?: number;
    readOnly?: boolean;
  }) {
    const [value, setValue] = useState(initial);
    return <NumberField label="Minutes" value={value} onChange={setValue} {...props} />;
  }

  it('starts a fresh entry on focus: the old value is the hint, and the first digit lands in the ones place', async () => {
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('Minutes') as HTMLInputElement;
    expect(input.value).toBe('5');
    await userEvent.click(input);
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('5');
    await userEvent.type(input, '7');
    expect(input.value).toBe('7');
  });

  it('leaving without typing keeps the old value', async () => {
    render(<Harness initial={12} />);
    const input = screen.getByLabelText('Minutes') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.tab();
    expect(input.value).toBe('12');
  });

  it('keeps digits only, limits the length and the maximum', async () => {
    render(<Harness initial={0} max={90} maxLength={3} />);
    const input = screen.getByLabelText('Minutes') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.type(input, 'a1b2c3d4');
    expect(input.value).toBe('90'); // 123 is cut to three digits, then capped at 90
  });

  it('typing then deleting everything is zero', async () => {
    const onChange = vi.fn();
    render(<NumberField label="N" value={4} onChange={onChange} />);
    const input = screen.getByLabelText('N');
    await userEvent.click(input);
    await userEvent.type(input, '9{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('a read-only field does not start a fresh entry; zero shows as the hint "0"; compact is small', async () => {
    const { container } = render(<Harness initial={0} readOnly />);
    const input = screen.getByLabelText('Minutes') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('0');
    await userEvent.click(input);
    expect(input.readOnly).toBe(true);
    cleanup();
    const compact = render(<NumberField label="N" compact value={3} onChange={() => {}} />);
    expect(compact.container.querySelector('.ui-field--compact')).toBeTruthy();
    expect(container).toBeTruthy();
  });

  it('can be shown invalid with its help', () => {
    render(<NumberField label="N" value={1} onChange={() => {}} help="Whole minutes" error="Too long" />);
    expect(screen.getByLabelText('N').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Whole minutes')).toBeTruthy();
  });
});

describe('DecimalField', () => {
  function Harness() {
    const [value, setValue] = useState('');
    return <DecimalField label="Dose" value={value} onChange={setValue} />;
  }
  it('keeps what is typed so 0.5 can be entered, turns a comma into a point and drops letters', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Dose') as HTMLInputElement;
    await userEvent.type(input, '0,5x');
    expect(input.value).toBe('0.5');
  });

  it('has the number-pad hint, a placeholder, and an error', () => {
    render(<DecimalField label="Dose" placeholder="mg" error="Bad" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Dose') as HTMLInputElement;
    expect(input.inputMode).toBe('decimal');
    expect(input.placeholder).toBe('mg');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('numeric fields start at the right-hand end', () => {
  it('puts the caret after the last character when a dose is focused, even if the phone moves it first', async () => {
    render(<DecimalField label="Dose" value="12.5" onChange={() => {}} />);
    const input = screen.getByLabelText('Dose') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 0); // what a phone may do right after focus
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect([input.selectionStart, input.selectionEnd]).toEqual([4, 4]);
  });

  it('right-aligns every number field, so an empty one also starts at the right', () => {
    render(
      <>
        <NumberField label="Minutes" value={5} onChange={() => {}} />
        <NumberField label="Timer" compact value={12} onChange={() => {}} />
        <DecimalField label="Dose" value="" onChange={() => {}} />
      </>,
    );
    for (const label of ['Minutes', 'Timer', 'Dose']) {
      expect(screen.getByLabelText(label).className).toContain('ui-field--number');
    }
  });
});

describe('Select', () => {
  const options = [
    { value: 'mg', label: 'mg' },
    { value: 'ml', label: 'ml' },
  ];

  it('is never blank: an empty select offers the label, or "Choose…", as its first option', () => {
    const { rerender } = render(<Select label="Unit" options={options} value="" onChange={() => {}} />);
    expect((screen.getByLabelText('Unit') as HTMLSelectElement).options[0]?.text).toBe('Unit');
    rerender(<Select options={options} value="" onChange={() => {}} aria-label="u" />);
    expect((screen.getByLabelText('u') as HTMLSelectElement).options[0]?.text).toBe('Choose…');
    rerender(<Select placeholder="Pick one" options={options} value="" onChange={() => {}} aria-label="u" />);
    expect((screen.getByLabelText('u') as HTMLSelectElement).options[0]?.text).toBe('Pick one');
  });

  it('with a value and no placeholder there is no empty option; an option with an empty value counts as the hint', () => {
    const { rerender } = render(<Select options={options} value="mg" onChange={() => {}} aria-label="u" />);
    expect((screen.getByLabelText('u') as HTMLSelectElement).options).toHaveLength(2);
    rerender(
      <Select options={[{ value: '', label: 'None' }, ...options]} value="" onChange={() => {}} aria-label="u" />,
    );
    expect((screen.getByLabelText('u') as HTMLSelectElement).options).toHaveLength(3);
  });

  it('shows a value that is not in the list instead of blanking it', () => {
    render(<Select options={options} value="drops" onChange={() => {}} aria-label="u" />);
    const select = screen.getByLabelText('u') as HTMLSelectElement;
    expect(select.value).toBe('drops');
    expect(select.options[0]?.text).toBe('drops');
  });

  it('reports a choice and can show an error', async () => {
    const onChange = vi.fn();
    render(<Select label="Unit" error="Required" options={options} value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Unit'), 'ml');
    expect(onChange).toHaveBeenCalledWith('ml');
    expect(screen.getByLabelText('Unit').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('FieldRow', () => {
  it('lays fields side by side, with an optional minimum width and a split', () => {
    const { container, rerender } = render(
      <FieldRow min="12rem">
        <span>a</span>
      </FieldRow>,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toBe('ui-row');
    expect(row.style.getPropertyValue('--ui-row-min')).toBe('12rem');
    rerender(
      <FieldRow split>
        <span>a</span>
      </FieldRow>,
    );
    expect((container.firstElementChild as HTMLElement).className).toBe('ui-row ui-row--split');
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--ui-row-min')).toBe('');
  });
});
