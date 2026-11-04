import type { ReactNode } from 'react';
import { IconButton } from './Buttons';
import { cx } from './cx';
import { BackIcon } from './icons';
import { useUiStrings } from './strings';

export interface AppHeaderProps {
  title: string;
  /** Keeps the title for screen readers only, when the app's own bar already says it. */
  titleHidden?: boolean;
  /** The person being tracked. Shown as a chip; with `onPatientClick` it is a button that switches person. */
  patient?: { name: string; /** A colour that tells people apart (white letters must read on it). */ color?: string };
  onPatientClick?: () => void;
  /** Shows a back button. */
  onBack?: () => void;
  /** Buttons on the right (kit buttons only). They wrap onto a second line on a small screen. */
  actions?: ReactNode;
}

const initial = (name: string): string => [...name.trim()][0]?.toUpperCase() ?? '?';

function PatientChip({ patient, onPatientClick }: Pick<AppHeaderProps, 'patient' | 'onPatientClick'>) {
  const strings = useUiStrings();
  if (!patient) return null;
  const chip = (
    <>
      <span
        className="ui-patient__dot"
        aria-hidden="true"
        {...(patient.color ? { style: { background: patient.color } } : {})}
      >
        {initial(patient.name)}
      </span>
      <span className="ui-patient__name">{patient.name}</span>
    </>
  );
  return onPatientClick ? (
    <button
      type="button"
      className="ui-patient"
      aria-label={`${strings.switchPatient}: ${patient.name}`}
      onClick={onPatientClick}
    >
      {chip}
    </button>
  ) : (
    <span className="ui-patient" role="img" aria-label={patient.name}>
      {chip}
    </span>
  );
}

export function AppHeader({ title, titleHidden, patient, onPatientClick, onBack, actions }: AppHeaderProps) {
  const strings = useUiStrings();
  return (
    <header className={cx('ui-header', titleHidden && 'ui-header--hidden')}>
      {onBack ? (
        <IconButton label={strings.back} onClick={onBack}>
          <BackIcon />
        </IconButton>
      ) : null}
      <h1 className="ui-header__title">{title}</h1>
      <PatientChip {...(patient ? { patient } : {})} {...(onPatientClick ? { onPatientClick } : {})} />
      {actions ? <div className="ui-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface AppTopBarProps extends Pick<AppHeaderProps, 'patient' | 'onPatientClick'> {
  /** The buttons before and after the person's name (kit buttons only). */
  before?: ReactNode;
  after?: ReactNode;
}

/** The bar above every screen: the name in the middle with the accent line under it, the person and the quick buttons. */
export function AppTopBar({ patient, onPatientClick, before, after }: AppTopBarProps) {
  return (
    <div className="ui-topbar">
      <div className="ui-topbar__row">
        <p className="ui-topbar__brand" aria-label="AuraTrack">
          Aur<span className="ui-topbar__mark">aTr</span>ack
        </p>
        <div className="ui-topbar__end">
          {before}
          <PatientChip {...(patient ? { patient } : {})} {...(onPatientClick ? { onPatientClick } : {})} />
          {after}
        </div>
      </div>
    </div>
  );
}
