import {
  RENAME_REASONS,
  dailyTotals,
  defaultScheduledTimes,
  planMedicationChange,
  regimenSnapshot,
  renameType,
  startOfLocalDay,
  type ChangeProblem,
  type ChangeType,
  type Frequency,
  type Medication,
  type RenameReason,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  ChoiceList,
  DataTable,
  DateTimeField,
  DecimalField,
  FieldRow,
  Screen,
  Section,
  Select,
  Stack,
  TextArea,
  TextField,
} from '@auratrack/ui';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useNav } from '../editor/nav';
import { FORMS, INGREDIENTS, UNITS, dayInput, instantFrom } from './medText';
import './screens.css';

const FREQUENCIES: Frequency[] = ['OD', 'BD', 'TDS', 'QDS', 'PRN'];
const OWN = '__own__';
const number = (text: string): number | null => {
  if (text.trim() === '') return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
};
const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** Add a medicine, or change one (F-501 to F-504, F-506). A change is confirmed on a sheet with its date, and added to the history. */
export function MedEdit({ id }: { id?: string }) {
  const app = useApp();
  const { t, patient, medications, actions } = app;
  const nav = useNav();
  const before = id ? (medications.find((m) => m.id === id) ?? null) : null;
  const start = before ? regimenSnapshot(before) : null;
  const known = (INGREDIENTS as readonly string[]).includes(start?.activeIngredient ?? '');

  const [name, setName] = useState(start?.name ?? '');
  const [renaming, setRenaming] = useState(before === null);
  const [reason, setReason] = useState<RenameReason | null>(null);
  const [asking, setAsking] = useState(false);
  const [ingredient, setIngredient] = useState(
    start ? (known ? start.activeIngredient : start.activeIngredient === '' ? '' : OWN) : '',
  );
  const [ownIngredient, setOwnIngredient] = useState(start && !known ? start.activeIngredient : '');
  const [form, setForm] = useState(start?.form ?? 'tablet');
  const [dose, setDose] = useState(text(start?.dose ?? null));
  const [unit, setUnit] = useState(start?.unit ?? 'mg');
  const [frequency, setFrequency] = useState<Frequency>(start?.frequency ?? 'BD');
  const [times, setTimes] = useState<string[]>(start?.scheduledTimes ?? defaultScheduledTimes('BD'));
  // One dose and one unit per scheduled time; a time saved before 7.2 with no dose of its own shows the medicine's dose
  const [slots, setSlots] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (start?.scheduledTimes ?? defaultScheduledTimes('BD')).map((time) => [
        time,
        text(start?.slotDoses[time] ?? start?.dose),
      ]),
    ),
  );
  const [slotUnits, setSlotUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (start?.scheduledTimes ?? defaultScheduledTimes('BD')).map((time) => [
        time,
        start?.slotUnits?.[time] ?? start?.unit ?? 'mg',
      ]),
    ),
  );
  const [days, setDays] = useState<string[]>((start?.scheduledDays ?? [0, 1, 2, 3, 4, 5, 6]).map(String));
  const [rescue, setRescue] = useState(before?.isRescue ?? false);
  const [emergency, setEmergency] = useState(before?.showInEmergency ?? false);
  const [reminder, setReminder] = useState(before?.reminderEnabled ?? false);
  const [startDay, setStartDay] = useState(dayInput(app.controller.now()));
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<ChangeProblem | null>(null);

  const ingredientName = (ingredient === OWN ? ownIngredient : ingredient).trim();
  const scheduled = frequency !== 'PRN';
  const slotNumbers = times.map((time) => [time, number(slots[time] ?? '')] as const);
  const unitAt = (time: string) => slotUnits[time] ?? unit;
  // Scheduled: the medicine's own dose and unit are those of its first time (what older screens and reports read)
  const firstTime = [...times].sort()[0];
  const doseNumber = scheduled ? (firstTime ? number(slots[firstTime] ?? '') : null) : number(dose);
  const mainUnit = scheduled && firstTime ? unitAt(firstTime) : unit;
  // The daily total, per unit (doses in different units are never added together)
  const totals = scheduled
    ? dailyTotals({
        dose: null,
        unit,
        slotDoses: Object.fromEntries(
          slotNumbers.filter(([, v]) => v !== null && !Number.isNaN(v)).map(([time, v]) => [time, v as number]),
        ),
        slotUnits: Object.fromEntries(times.map((time) => [time, unitAt(time)])),
        scheduledTimes: times,
        frequency,
      })
    : [];
  const invalid =
    name.trim() === '' || Number.isNaN(doseNumber) || slotNumbers.some(([, v]) => v !== null && Number.isNaN(v));

  const regimen = () => ({
    name: name.trim(),
    activeIngredient: ingredientName,
    form,
    dose: doseNumber,
    unit: mainUnit,
    slotDoses: scheduled
      ? Object.fromEntries(slotNumbers.filter(([, v]) => v !== null).map(([time, v]) => [time, v as number]))
      : {},
    ...(scheduled ? { slotUnits: Object.fromEntries(times.map((time) => [time, unitAt(time)])) } : {}),
    frequency,
    scheduledTimes: frequency === 'PRN' ? [] : [...times].sort(),
    scheduledDays: days.map(Number).sort(),
    isRescue: rescue,
    showInEmergency: emergency,
    reminderEnabled: reminder,
  });

  const weekday = (day: number) =>
    new Intl.DateTimeFormat(app.language, { weekday: 'short' }).format(new Date(2024, 0, 7 + day)); // 7 Jan 2024 was a Sunday

  const save = async (type: ChangeType, effectiveAt: number, note: string) => {
    if (!patient) return;
    const result = planMedicationChange({
      patientId: patient.id,
      before,
      next: regimen(),
      type,
      effectiveAt,
      recordedAt: app.controller.now(),
      note,
    });
    if ('problem' in result) return setProblem(result.problem);
    await actions.changeMedication(result);
    setConfirming(false);
    nav.pop();
  };

  const onSave = () => {
    if (!before) {
      const now = app.controller.now();
      const effective = startDay === dayInput(now) ? now : startOfLocalDay(instantFrom(startDay, '00:00'));
      void save('started', effective, '');
    } else if (name.trim() !== before.name && reason === null) setAsking(true);
    else setConfirming(true);
  };

  return (
    <Screen>
      <Stack>
        <AppHeader title={before ? t('med.edit') : t('med.add')} onBack={() => nav.pop()} />
        <Section title={t('med.about')}>
          <Stack>
            <TextField label={t('med.name')} value={name} onChange={setName} disabled={!renaming} autoComplete="off" />
            {before && !renaming ? (
              <Button size="md" onClick={() => setRenaming(true)}>
                {t('med.rename')}
              </Button>
            ) : null}
            <Select
              label={t('med.ingredient')}
              value={ingredient}
              onChange={setIngredient}
              placeholder={t('med.chooseIngredient')}
              options={[
                ...INGREDIENTS.map((i) => ({ value: i, label: i })),
                { value: OWN, label: t('med.ownIngredient') },
              ]}
            />
            {ingredient === OWN ? (
              <TextField label={t('med.ownIngredientName')} value={ownIngredient} onChange={setOwnIngredient} />
            ) : null}
            <Select
              label={t('med.form')}
              value={form}
              onChange={setForm}
              options={FORMS.map((f) => ({ value: f.stored, label: app.label(f.code) }))}
            />
          </Stack>
        </Section>
        <Section title={t('med.schedule')}>
          <Stack>
            <ChipGroup
              label={t('med.frequency')}
              value={frequency}
              onChange={(f) => {
                setFrequency(f);
                setTimes(defaultScheduledTimes(f));
              }}
              options={FREQUENCIES.map((f) => ({ value: f, label: t(`med.freq.${f}` as never) }))}
            />
            {/* Taken when needed: one dose. On a schedule: each time has its own dose and unit, and nothing else */}
            {!scheduled ? (
              <FieldRow min="7rem">
                <DecimalField label={t('med.dose')} value={dose} onChange={setDose} />
                <Select
                  label={t('med.unit')}
                  value={unit}
                  onChange={setUnit}
                  options={[...new Set([...UNITS, unit])].map((u) => ({ value: u, label: u }))}
                />
              </FieldRow>
            ) : (
              times.map((time, i) => (
                <Card compact key={i}>
                  <Stack gap="0.5rem">
                    <DateTimeField
                      label={t('med.timeN', { n: i + 1 })}
                      type="time"
                      withSeconds={false}
                      value={time}
                      onChange={(v) => {
                        if (v === '') return;
                        setTimes((list) => list.map((x, j) => (j === i ? v : x)));
                        // The dose and unit go with their time
                        const carry = (r: Record<string, string>) => {
                          const { [time]: moved, ...rest } = r;
                          return moved === undefined ? rest : { ...rest, [v]: moved };
                        };
                        setSlots(carry);
                        setSlotUnits(carry);
                      }}
                    />
                    <FieldRow min="7rem">
                      <DecimalField
                        label={t('med.slotDose', { time })}
                        value={slots[time] ?? ''}
                        onChange={(v) => setSlots((r) => ({ ...r, [time]: v }))}
                      />
                      <Select
                        label={t('med.unit')}
                        value={unitAt(time)}
                        onChange={(u) => setSlotUnits((r) => ({ ...r, [time]: u }))}
                        options={[...new Set([...UNITS, unitAt(time)])].map((u) => ({ value: u, label: u }))}
                      />
                    </FieldRow>
                  </Stack>
                </Card>
              ))
            )}
            {frequency !== 'PRN' ? (
              <ChipGroup
                multiple
                label={t('med.days')}
                value={days}
                onChange={setDays}
                options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: weekday(d) }))}
              />
            ) : null}
            {scheduled && totals.length > 0 ? (
              <DataTable
                caption={t('med.dailyTitle')}
                columns={[{ title: t('med.dailyTime') }, { title: t('med.dailyDose'), numeric: true }]}
                rows={[...times]
                  .sort()
                  .map((time) => [time, slots[time]?.trim() ? `${slots[time]} ${unitAt(time)}` : '–'])}
                footer={[
                  t('med.dailyTotal'),
                  totals.map(([u, n]) => `${n.toLocaleString(app.language)} ${u}`).join(' + '),
                ]}
              />
            ) : null}
          </Stack>
        </Section>
        <Section title={t('med.options')}>
          <Stack>
            <Checkbox checked={rescue} onChange={setRescue} label={t('med.rescue')} help={t('med.rescueHelp')} />
            <Checkbox
              checked={emergency}
              onChange={setEmergency}
              label={t('med.emergency')}
              help={t('med.emergencyHelp')}
            />
            <Checkbox
              checked={reminder}
              onChange={setReminder}
              label={t('med.reminder')}
              help={t('med.reminderHelp')}
            />
          </Stack>
        </Section>
        {before ? (
          <p className="app-note">
            {t('med.startedOn', { day: before.startedAt === null ? '–' : app.fmt.day(before.startedAt) })}
          </p>
        ) : (
          <DateTimeField
            label={t('med.startDate')}
            help={t('med.startDateHelp')}
            type="date"
            value={startDay}
            onChange={setStartDay}
            max={dayInput(app.controller.now())}
          />
        )}
        {problem ? (
          <p role="alert" className="app-banner">
            {t(`med.problem.${problem}` as never)}
          </p>
        ) : null}
        <Button variant="primary" size="lg" disabled={invalid || app.busy} onClick={onSave}>
          {before ? t('med.review') : t('common.save')}
        </Button>
      </Stack>
      {asking ? (
        <BottomSheet
          title={t('med.renameWhy')}
          onClose={() => setAsking(false)}
          footer={
            <Button
              variant="primary"
              fullWidth
              disabled={reason === null}
              onClick={() => {
                setAsking(false);
                if (reason === 'different') return void replaceWithNew();
                setConfirming(true);
              }}
            >
              {t('common.done')}
            </Button>
          }
        >
          <ChoiceList
            label={t('med.renameWhy')}
            value={reason}
            onChange={setReason}
            options={RENAME_REASONS.map((r) => ({
              value: r,
              label: t(`med.rename.${r}` as never),
              detail: t(`med.rename.${r}Help` as never),
            }))}
          />
        </BottomSheet>
      ) : null}
      {confirming && before ? (
        <ConfirmChange
          kindDefault={reason !== null && reason !== 'different' ? renameType(reason) : 'changed'}
          onClose={() => setConfirming(false)}
          onConfirm={(type, at, note) => void save(type, at, note)}
        />
      ) : null}
    </Screen>
  );

  /** A different medicine: the old one is stopped, and the new one is started, each in its own history. */
  async function replaceWithNew() {
    if (!before || !patient) return;
    const now = app.controller.now();
    const stop = planMedicationChange({
      patientId: patient.id,
      before,
      next: {
        ...regimenSnapshot(before),
        isRescue: before.isRescue,
        showInEmergency: before.showInEmergency,
        reminderEnabled: before.reminderEnabled,
      },
      type: 'stopped',
      effectiveAt: now,
      recordedAt: now,
      note: '',
    });
    const created = planMedicationChange({
      patientId: patient.id,
      before: null,
      next: regimen(),
      type: 'started',
      effectiveAt: now,
      recordedAt: now,
      note: '',
    });
    if ('problem' in stop || 'problem' in created)
      return setProblem('problem' in created ? created.problem : (stop as { problem: ChangeProblem }).problem);
    await actions.changeMedication(stop);
    await actions.changeMedication(created);
    nav.pop();
  }
}

/** The confirm sheet (F-502): when the change takes effect, what kind of change it is, and an optional note. */
export function ConfirmChange({
  kindDefault,
  onClose,
  onConfirm,
}: {
  kindDefault: ChangeType;
  onClose: () => void;
  onConfirm: (type: ChangeType, effectiveAt: number, note: string) => void;
}) {
  const app = useApp();
  const { t } = app;
  const now = app.controller.now();
  const [type, setType] = useState<ChangeType>(kindDefault);
  const [day, setDay] = useState(dayInput(now));
  const [time, setTime] = useState(() => {
    const d = new Date(now);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [note, setNote] = useState('');
  return (
    <BottomSheet
      title={t('med.confirmTitle')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={day === '' || time === ''}
          onClick={() => onConfirm(type, instantFrom(day, time), note.trim())}
        >
          {t('med.confirm')}
        </Button>
      }
    >
      <Stack>
        <ChipGroup
          label={t('med.kind')}
          value={type}
          onChange={setType}
          options={[
            { value: 'changed', label: t('med.kindChanged') },
            { value: 'correction', label: t('med.kindCorrection') },
          ]}
        />
        <p className="app-note">{type === 'correction' ? t('med.kindCorrectionHelp') : t('med.kindChangedHelp')}</p>
        <DateTimeField label={t('med.effectiveDay')} type="date" value={day} onChange={setDay} max={dayInput(now)} />
        <DateTimeField label={t('med.effectiveTime')} type="time" withSeconds={false} value={time} onChange={setTime} />
        <TextArea label={t('med.note')} value={note} onChange={setNote} rows={3} />
      </Stack>
    </BottomSheet>
  );
}

export type { Medication };
