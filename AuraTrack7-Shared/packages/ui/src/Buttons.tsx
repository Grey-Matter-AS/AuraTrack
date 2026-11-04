import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { CloseIcon } from './icons';
import { useUiStrings } from './strings';

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'>;

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
export type ButtonSize = 'md' | 'lg'; // 48px and 56px; every size is at least the 44px touch target

export interface ButtonProps extends NativeButton {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  icon,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, fullWidth && 'ui-btn--full')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends NativeButton {
  /** The accessible name: required, because the button has no text. */
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'blue';
  /** A circle, to sit beside the patient chip. */
  round?: boolean;
}

export function IconButton({ label, tone = 'neutral', round, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx('ui-icon-btn', tone !== 'neutral' && `ui-icon-btn--${tone}`, round && 'ui-icon-btn--round')}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CloseButton({ label, ...rest }: Omit<IconButtonProps, 'label' | 'children'> & { label?: string }) {
  const strings = useUiStrings();
  return (
    <IconButton label={label ?? strings.close} {...rest}>
      <CloseIcon />
    </IconButton>
  );
}

/** A row of buttons that wraps, and stacks on small phones, instead of squeezing. */
export interface RoundButtonProps extends NativeButton {
  /** Red for starting a recording, amber for logging a past seizure. */
  tone: 'danger' | 'warning';
  icon?: ReactNode;
}

/** The big round action on Home (Start Timer, Log Past Seizure). A real button; the circle keeps its shape at every text size. */
export function RoundButton({ tone, icon, type = 'button', children, ...rest }: RoundButtonProps) {
  return (
    <button type={type} className={cx('ui-round', `ui-round--${tone}`)} {...rest}>
      {icon}
      <span className="ui-round__label">{children}</span>
    </button>
  );
}

export function ButtonRow({ stack = false, children }: { stack?: boolean; children: ReactNode }) {
  return <div className={cx('ui-button-row', stack && 'ui-button-row--stack')}>{children}</div>;
}
