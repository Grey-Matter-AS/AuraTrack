import { newId, type Patient } from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  DateTimeField,
  Dialog,
  Screen,
  Stack,
  TextField,
} from '@auratrack/ui';
import { useState } from 'react';
import { PATIENT_COLORS, colorCodeOf, colorHexOf } from '../app/patientColors';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import './screens.css';

/** The people on this device (F-601, F-111): add, rename, colour, remove, and who the app records for. */
export function Patients() {
  const { t, patients, patient, actions, seizures } = useApp();
  const nav = useNav();
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  const [removing, setRemoving] = useState<Patient | null>(null);
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.patients')} onBack={() => nav.pop()} />
        {patients.map((p) => (
          <Card key={p.id} compact>
            <Stack>
              <div className="app-row">
                <div>
                  <p className="app-banner">{p.name}</p>
                  <p className="app-note">{p.id === patient?.id ? t('people.active') : t('people.other')}</p>
                </div>
                <span className="app-dot" style={{ background: p.color }} aria-hidden="true" />
              </div>
              <div className="ui-cluster">
                {p.id === patient?.id ? null : (
                  <Button size="md" onClick={() => void actions.selectPatient(p.id)}>
                    {t('people.use')}
                  </Button>
                )}
                <Button size="md" onClick={() => setEditing(p)}>
                  {t('common.edit')}
                </Button>
                {patients.length > 1 ? (
                  <Button size="md" variant="danger" onClick={() => setRemoving(p)}>
                    {t('people.remove')}
                  </Button>
                ) : null}
              </div>
            </Stack>
          </Card>
        ))}
        <Button fullWidth variant="primary" onClick={() => setEditing('new')}>
          {t('people.add')}
        </Button>
      </Stack>
      {editing ? (
        <PersonSheet
          person={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing === 'new') {
              const id = newId();
              await actions.createRecord('patient', { id, patientId: id, ...values });
              await actions.selectPatient(id);
            } else await actions.updateRecord('patient', editing.id, values);
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <Dialog
          title={t('people.removeTitle', { name: removing.name })}
          message={t('people.removeText', { count: removing.id === patient?.id ? seizures.length : 0 })}
          tone="danger"
          onClose={() => setRemoving(null)}
          actions={
            <>
              <Button onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void actions.removePatient(removing.id).then(() => setRemoving(null));
                }}
              >
                {t('people.removeConfirm')}
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

function PersonSheet({
  person,
  onClose,
  onSave,
}: {
  person: Patient | null;
  onClose: () => void;
  onSave: (
    values: Pick<Patient, 'name' | 'dateOfBirth' | 'emergencyContact' | 'emergencyPhone' | 'color'>,
  ) => Promise<void>;
}) {
  const { t } = useApp();
  const [name, setName] = useState(person?.name ?? '');
  const [dob, setDob] = useState(person?.dateOfBirth ?? '');
  const [contact, setContact] = useState(person?.emergencyContact ?? '');
  const [phone, setPhone] = useState(person?.emergencyPhone ?? '');
  const [color, setColor] = useState(person ? colorCodeOf(person.color) : 'blue');
  return (
    <BottomSheet
      title={person ? t('people.edit') : t('people.add')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={name.trim() === ''}
          onClick={() =>
            void onSave({
              name: name.trim().slice(0, 120),
              dateOfBirth: dob === '' ? null : dob,
              emergencyContact: contact.trim().slice(0, 120),
              emergencyPhone: phone.trim().slice(0, 120),
              color: color === '' && person ? person.color : colorHexOf(color),
            })
          }
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <TextField label={t('people.name')} value={name} onChange={setName} autoComplete="off" />
        <DateTimeField label={t('people.dob')} type="date" value={dob} onChange={setDob} />
        <TextField label={t('people.contact')} help={t('people.contactHelp')} value={contact} onChange={setContact} />
        <TextField label={t('people.contactPhone')} type="tel" value={phone} onChange={setPhone} autoComplete="off" />
        <ChipGroup
          label={t('people.color')}
          showLabel
          value={color}
          onChange={setColor}
          options={PATIENT_COLORS.map((c) => ({ value: c.code, label: t(`color.${c.code}` as never) }))}
        />
      </Stack>
    </BottomSheet>
  );
}
