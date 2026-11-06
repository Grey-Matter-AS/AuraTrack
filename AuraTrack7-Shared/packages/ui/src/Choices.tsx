import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface Option<V extends string = string> {
  value: V;
  label: ReactNode;
  /** A second, smaller line (ChoiceList only). */
  detail?: ReactNode;
}

interface SingleChips<V extends string> {
  multiple?: false;
  value: V | null;
  onChange: (value: V) => void;
}
interface MultiChips<V extends string> {
  multiple: true;
  value: readonly V[];
  onChange: (value: V[]) => void;
}

export type ChipGroupProps<V extends string> = (SingleChips<V> | MultiChips<V>) & {
  options: readonly Option<V>[];
  /** Names the group for a screen reader. */
  label: string;
  /**
   * The label shows above the chips (the default): no row of chips is left unnamed. Set false only where a heading right
   * above already says the same words; screen readers still get the label.
   */
  showLabel?: boolean;
  /** The chips share the row width. */
  fill?: boolean;
};

/** Single or multiple choice as chips. The chosen ones are filled with the accent colour. */
export function ChipGroup<V extends string>(props: ChipGroupProps<V>) {
  const isOn = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v);
  const choose = (v: V) => {
    if (!props.multiple) return props.onChange(v);
    props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
  };
  const labelId = useId();
  const chips = (
    <div
      role="group"
      {...(props.showLabel !== false ? { 'aria-labelledby': labelId } : { 'aria-label': props.label })}
      className={cx('ui-chip-group', props.fill && 'ui-chip-group--fill')}
    >
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={isOn(option.value)}
          onClick={() => choose(option.value)}
          className="ui-chip"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
  if (props.showLabel === false) return chips;
  return (
    <div className="ui-field-wrap">
      <span className="ui-label" id={labelId}>
        {props.label}
      </span>
      {chips}
    </div>
  );
}

export interface ChoiceListProps<V extends string> {
  options: readonly Option<V>[];
  value: V | null;
  onChange: (value: V) => void;
  label: string;
}

/** Full-width rows, one chosen. */
export function ChoiceList<V extends string>({ options, value, onChange, label }: ChoiceListProps<V>) {
  return (
    <div role="group" aria-label={label} className="ui-choice-list">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="ui-choice"
        >
          {option.label}
          {option.detail ? <span className="ui-choice__detail">{option.detail}</span> : null}
        </button>
      ))}
    </div>
  );
}

export interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  /** The accessible name. */
  label: string;
}

export function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="ui-toggle"
    >
      <span className="ui-toggle__track">
        <span className="ui-toggle__thumb" />
      </span>
    </button>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  help?: ReactNode;
}

/** The whole row is the tap target. */
export function Checkbox({ checked, onChange, label, help }: CheckboxProps) {
  return (
    <label className="ui-check ui-inset">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="ui-check__label">{label}</span>
        {help ? <span className="ui-check__help">{help}</span> : null}
      </span>
    </label>
  );
}
