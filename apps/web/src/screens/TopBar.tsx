import { AppTopBar, Button, Dialog, HomeIcon, IconButton, LockIcon } from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { hasUnsavedEdits, useEditorHost } from '../editor/EditorContext';
import { useNav } from '../editor/nav';

/**
 * The bar above every screen of the stack: the name, a quick way Home, the person and Lock. Set-up, the PIN screen and the
 * recording screen are outside the stack, so they never show it (no extra buttons on the recording screen).
 */
export function TopBar() {
  const { t, patient, patients, actions } = useApp();
  const host = useEditorHost();
  const nav = useNav();
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <AppTopBar
        {...(patient ? { patient: { name: patient.name, color: patient.color } } : {})}
        {...(patients.length > 1 ? { onPatientClick: () => void actions.switchPatient() } : {})}
        before={
          <IconButton
            round
            tone="blue"
            label={t('nav.goHome')}
            onClick={() => (hasUnsavedEdits(host) ? setLeaving(true) : nav.home('home'))}
          >
            <HomeIcon />
          </IconButton>
        }
        after={
          <IconButton round tone="danger" label={t('nav.lockApp')} onClick={() => void actions.lock()}>
            <LockIcon />
          </IconButton>
        }
      />
      {leaving ? (
        <Dialog
          title={t('editor.leaveTitle')}
          message={t('editor.leaveMessage')}
          onClose={() => setLeaving(false)}
          actions={
            <>
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  setLeaving(false);
                  nav.home('home');
                }}
              >
                {t('editor.leave')}
              </Button>
              <Button fullWidth onClick={() => setLeaving(false)}>
                {t('editor.stay')}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
