import type { ReactNode } from 'react';
import { IconButton } from './Buttons';
import { BackIcon } from './icons';
import { useUiStrings } from './strings';

export interface AppHeaderProps {
  title: string;
  /** The person being tracked. Shown as a chip; with `onPatientClick` it is a button that switches person. */
  patient?: { name: string };
  onPatientClick?: () => void;
  /** Shows a back button. */
  onBack?: () => void;
  /** Buttons on the right (kit buttons only). They wrap onto a second line on a small screen. */
  actions?: ReactNode;
}

const initial = (name: string): string => [...name.trim()][0]?.toUpperCase() ?? '?';

export function AppHeader({ title, patient, onPatientClick, onBack, actions }: AppHeaderProps) {
  const strings = useUiStrings();
  const chip = patient ? (
    <>
      <span className="ui-patient__dot" aria-hidden="true">
        {initial(patient.name)}
      </span>
      <span className="ui-patient__name">{patient.name}</span>
    </>
  ) : null;
  return (
    <header className="ui-header">
      {onBack ? (
        <IconButton label={strings.back} onClick={onBack}>
          <BackIcon />
        </IconButton>
      ) : null}
      <h1 className="ui-header__title">{title}</h1>
      {patient && onPatientClick ? (
        <button
          type="button"
          className="ui-patient"
          aria-label={`${strings.switchPatient}: ${patient.name}`}
          onClick={onPatientClick}
        >
          {chip}
        </button>
      ) : patient ? (
        <span className="ui-patient" role="img" aria-label={patient.name}>
          {chip}
        </span>
      ) : null}
      {actions ? <div className="ui-header__actions">{actions}</div> : null}
    </header>
  );
}
