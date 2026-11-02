import {
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cx } from './cx';
import { CalendarIcon, ClockIcon } from './icons';
import { useUiStrings } from './strings';

// Every field goes through <Field>: one label, help and error style, and the label is tied to the control.

interface FieldFrame {
  label?: string | undefined;
  help?: string | undefined;
  error?: string | undefined;
}

function Frame({ label, help, error, id, children }: FieldFrame & { id: string; children: ReactNode }) {
  if (!label && !help && !error) return <>{children}</>;
  return (
    <div className="ui-field-wrap">
      {label ? (
        <label className="ui-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
      {help ? (
        <p className="ui-help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="ui-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, { help, error }: FieldFrame) =>
  [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

type NativeInput = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'style' | 'onChange' | 'value' | 'id' | 'type'
>;

export interface TextFieldProps extends FieldFrame, NativeInput {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  multiline?: false;
  /** 'password' hides what is typed (a PIN); the default is plain text. */
  type?: 'text' | 'password';
}
export interface TextAreaProps extends FieldFrame {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

/** Never blank when empty: without a placeholder, the label is shown as the hint. */
export function TextField({
  label,
  help,
  error,
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  ...rest
}: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Frame label={label} help={help} error={error} id={fieldId}>
      <input
        id={fieldId}
        type={type}
        className="ui-field"
        value={value}
        placeholder={placeholder ?? label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, { help, error })}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </Frame>
  );
}

export function TextArea({ label, help, error, id, value, onChange, rows = 3, placeholder, disabled }: TextAreaProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Frame label={label} help={help} error={error} id={fieldId}>
      <textarea
        id={fieldId}
        rows={rows}
        className="ui-field"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, { help, error })}
        onChange={(e) => onChange(e.target.value)}
      />
    </Frame>
  );
}

export type DateTimeType = 'date' | 'time' | 'datetime-local' | 'month';

export interface DateTimeFieldProps extends FieldFrame {
  type?: DateTimeType;
  /** The value in the native format: "2026-10-31", "08:30", "2026-10-31T08:30" or "2026-10". Local time, never UTC. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  min?: string;
  max?: string;
}

/**
 * iOS Safari shows an empty date or time field as a blank box (no hint, no icon), so the kit draws its own hint and icon,
 * the same on every platform. The hint shows only while the field is empty and not focused; taps reach the native picker.
 */
export function DateTimeField({
  type = 'date',
  label,
  help,
  error,
  id,
  value,
  onChange,
  placeholder,
  min,
  max,
}: DateTimeFieldProps) {
  const strings = useUiStrings();
  const generated = useId();
  const fieldId = id ?? generated;
  const [focused, setFocused] = useState(false);
  const hint =
    placeholder ??
    {
      date: strings.selectDate,
      time: strings.selectTime,
      'datetime-local': strings.selectDateTime,
      month: strings.selectMonth,
    }[type];
  const empty = value === '';
  const Icon = type === 'time' ? ClockIcon : CalendarIcon;
  return (
    <Frame label={label} help={help} error={error} id={fieldId}>
      <div className={cx('ui-date', empty && !focused && 'ui-date--empty')}>
        <input
          id={fieldId}
          type={type}
          className="ui-field"
          value={value}
          min={min}
          max={max}
          aria-label={label ? undefined : hint}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, { help, error })}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {empty && !focused ? (
          <span className="ui-date__hint" aria-hidden="true">
            {hint}
          </span>
        ) : null}
        <span className="ui-date__icon" aria-hidden="true">
          <Icon width="1.125rem" height="1.125rem" />
        </span>
      </div>
    </Frame>
  );
}

/**
 * Numbers are entered from the right: the caret always starts at the end, and a number field reads right to left
 * from there. A phone puts the caret where it likes after the focus event, so it is placed again on the next frame
 * and just after the tap.
 */
function caretAtEnd(input: HTMLInputElement) {
  const place = () => {
    if (document.activeElement !== input) return;
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };
  place();
  requestAnimationFrame(place);
  setTimeout(place, 0);
  setTimeout(place, 60); // iPhone places its caret after the tap finishes
}
const numericCaret = {
  onFocus: (e: { currentTarget: HTMLInputElement }) => caretAtEnd(e.currentTarget),
};

export interface NumberFieldProps extends FieldFrame {
  value: number;
  onChange: (value: number) => void;
  id?: string;
  max?: number;
  maxLength?: number;
  /** A small centred box, for timers. */
  compact?: boolean;
  readOnly?: boolean;
}

/**
 * Whole numbers typed on the number pad. Focusing starts a fresh entry (the old value shows as the hint), so the first
 * digit typed always lands in the ones place; leaving without typing keeps the old value.
 */
export function NumberField({
  label,
  help,
  error,
  id,
  value,
  onChange,
  max = Infinity,
  maxLength = 4,
  compact = false,
  readOnly = false,
}: NumberFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value ? String(value) : '';
  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLength);
    const n = digits === '' ? 0 : Math.min(max, parseInt(digits, 10));
    setDraft(digits === '' ? '' : String(n));
    onChange(n);
  };
  return (
    <Frame label={label} help={help} error={error} id={fieldId}>
      <input
        id={fieldId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={maxLength}
        readOnly={readOnly}
        placeholder={shown || '0'}
        value={draft ?? shown}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, { help, error })}
        className={cx('ui-field', 'ui-field--number', compact && 'ui-field--compact')}
        onFocus={(e) => {
          if (!readOnly) setDraft('');
          numericCaret.onFocus(e);
        }}
        onBlur={() => setDraft(null)}
        onChange={(e) => handle(e.target.value)}
      />
    </Frame>
  );
}

export interface DecimalFieldProps extends FieldFrame {
  /** The typed text, so "0." and "0.5" can be entered. Parse it with Number() when saving. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
}

/** A free decimal number (doses). A comma is turned into a point. */
export function DecimalField({ label, help, error, id, value, onChange, placeholder }: DecimalFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Frame label={label} help={help} error={error} id={fieldId}>
      <input
        id={fieldId}
        type="text"
        inputMode="decimal"
        className="ui-field ui-field--number"
        placeholder={placeholder ?? label}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, { help, error })}
        onFocus={numericCaret.onFocus}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
      />
    </Frame>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}
type NativeSelect = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'style' | 'onChange' | 'value' | 'id'>;

export interface SelectProps extends FieldFrame, NativeSelect {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Shown as the empty first option. With no value and no placeholder, the label, or "Choose…", is shown. */
  placeholder?: string;
}

/** Never blank: an empty select always shows a hint. */
export function Select({ options, value, onChange, placeholder, label, help, error, id, ...rest }: SelectProps) {
  const strings = useUiStrings();
  const generated = useId();
  const fieldId = id ?? generated;
  const hint =
    placeholder ?? (value === '' && !options.some((o) => o.value === '') ? (label ?? strings.choose) : undefined);
  // A stored value that is not in the list (for example a household's own code) is still shown, never blanked
  const known = value === '' || options.some((o) => o.value === value);
  return (
    <Frame label={label} help={help} error={error} id={fieldId}>
      <div className="ui-select">
        <select
          id={fieldId}
          className="ui-field"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, { help, error })}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        >
          {hint !== undefined ? <option value="">{hint}</option> : null}
          {!known ? <option value={value}>{value}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </Frame>
  );
}

/** Fields side by side when they fit (a minimum width each), stacked when they do not. `split`: one main field and a short companion. */
export function FieldRow({ split = false, min, children }: { split?: boolean; min?: string; children: ReactNode }) {
  return (
    <div
      className={cx('ui-row', split && 'ui-row--split')}
      style={min ? ({ '--ui-row-min': min } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
