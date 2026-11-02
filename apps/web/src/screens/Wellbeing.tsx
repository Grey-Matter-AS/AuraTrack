import {
  MOODS,
  SCALE_STEPS,
  cleanFactors,
  effectiveFactors,
  factorStats,
  localDateKey,
  moodCounts,
  type FactorDef,
  type WellbeingEntry,
} from '@auratrack/model';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  ChoiceList,
  DateTimeField,
  DecimalField,
  Dialog,
  Screen,
  Section,
  Select,
  Stack,
  TextArea,
  TextField,
  useToast,
} from '@auratrack/ui';
import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useRecordList, useRecords } from '../app/records';
import { localInputValue } from '../editor/draft';
import { useNav } from '../editor/nav';
import './screens.css';

type View = 'entries' | 'overview' | 'factors';
const INTENSITIES = [1, 2, 3] as const;

/** The name of a factor: the person's own words, a household's own factor, or the catalogue's label. */
export function useFactorName() {
  const { label, customCodes } = useApp();
  return (def: FactorDef): string =>
    def.label ?? customCodes.find((c) => c.code === def.code)?.label ?? label(def.code);
}

/** Wellbeing (F-406, F-551 to F-554): the check-ins, how they line up with seizures, and the factors asked. */
export function Wellbeing() {
  const app = useApp();
  const { t, settings } = app;
  const nav = useNav();
  const [view, setView] = useState<View>('entries');
  const [sheet, setSheet] = useState<WellbeingEntry | 'new' | null>(null);
  if (!settings.wellbeingEnabled)
    return (
      <Screen>
        <Stack>
          <AppHeader title={t('more.wellbeing')} onBack={() => nav.pop()} />
          <p className="app-note">{t('wb.off')}</p>
        </Stack>
      </Screen>
    );
  return (
    <Screen>
      <Stack>
        <AppHeader title={t('more.wellbeing')} onBack={() => nav.pop()} />
        <Button variant="primary" fullWidth onClick={() => setSheet('new')}>
          {t('wb.checkIn')}
        </Button>
        <ChipGroup
          label={t('hist.view')}
          value={view}
          onChange={setView}
          options={[
            { value: 'entries', label: t('wb.entries') },
            { value: 'overview', label: t('wb.overview') },
            { value: 'factors', label: t('wb.factors') },
          ]}
        />
        {view === 'entries' ? <Entries onEdit={setSheet} /> : null}
        {view === 'overview' ? <Overview /> : null}
        {view === 'factors' ? <Factors /> : null}
      </Stack>
      {sheet ? <CheckIn entry={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

function Entries({ onEdit }: { onEdit: (e: WellbeingEntry) => void }) {
  const { t, label, fmt, settings, actions } = useApp();
  const name = useFactorName();
  const entries = useRecords<WellbeingEntry>('wellbeingEntry');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deleting, setDeleting] = useState<WellbeingEntry | null>(null);
  const defs = effectiveFactors(settings.wellbeingFactors);
  const shown = (entries ?? [])
    .filter((e) => (from === '' || e.dayKey >= from) && (to === '' || e.dayKey <= to))
    .sort((a, b) => b.recordedAt - a.recordedAt);
  return (
    <Stack>
      <DateTimeField label={t('hist.from')} type="date" value={from} onChange={setFrom} />
      <DateTimeField label={t('hist.to')} type="date" value={to} onChange={setTo} />
      {entries !== null && shown.length === 0 ? <p className="app-note">{t('wb.none')}</p> : null}
      {shown.map((e) => {
        const present = Object.entries(e.factors)
          .map(([code, value]) => {
            const def =
              defs.find((d) => d.code === code) ??
              ({ code, type: typeof value === 'boolean' ? 'boolean' : 'number', unit: '' } as FactorDef);
            return value === true ? name(def) : `${name(def)} ${value}${def.unit ? ` ${def.unit}` : ''}`;
          })
          .join(', ');
        return (
          <Card compact key={e.id}>
            <Stack gap="0.25rem">
              <p className="app-banner">
                {fmt.when(e.recordedAt)} · {label(e.moodCode)} · {t(`wb.intensity${e.intensity}` as never)}
              </p>
              {present ? <p className="app-note">{present}</p> : null}
              {e.notes ? <p className="app-note">{e.notes}</p> : null}
              <div className="ui-cluster">
                <Button size="md" onClick={() => onEdit(e)}>
                  {t('common.edit')}
                </Button>
                <Button size="md" variant="danger" onClick={() => setDeleting(e)}>
                  {t('home.delete')}
                </Button>
              </div>
            </Stack>
          </Card>
        );
      })}
      {deleting ? (
        <Dialog
          title={t('wb.deleteTitle')}
          message={t('wb.deleteText')}
          tone="danger"
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void actions.removeRecord('wellbeingEntry', deleting.id).then(() => setDeleting(null));
                }}
              >
                {t('home.delete')}
              </Button>
            </>
          }
        />
      ) : null}
    </Stack>
  );
}

/** A check-in (F-551): mood, how strong, the factors, a note, and the time. */
export function CheckIn({ entry, onClose }: { entry: WellbeingEntry | null; onClose: () => void }) {
  const app = useApp();
  const { t, label, patient, settings, actions } = app;
  const name = useFactorName();
  const toast = useToast();
  const defs = effectiveFactors(settings.wellbeingFactors);
  const [mood, setMood] = useState<string | null>(entry?.moodCode ?? null);
  const [intensity, setIntensity] = useState<number>(entry?.intensity ?? 1);
  const [factors, setFactors] = useState<Record<string, number | boolean>>(entry?.factors ?? {});
  const [numbers, setNumbers] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(entry?.factors ?? {})
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => [k, String(v)]),
    ),
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [when, setWhen] = useState(() => localInputValue(entry?.recordedAt ?? app.controller.now()));
  const recordedAt = new Date(when).getTime();
  const bad = mood === null || Number.isNaN(recordedAt);
  return (
    <BottomSheet
      title={entry ? t('wb.editCheckIn') : t('wb.checkIn')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={bad || !patient}
          onClick={() => {
            if (!patient || mood === null) return;
            const typed: Record<string, number | undefined> = {};
            for (const def of defs) {
              const text = numbers[def.code]?.trim() ?? '';
              if (def.type === 'number' && text !== '') typed[def.code] = Number(text.replace(',', '.'));
            }
            const values = {
              patientId: patient.id,
              recordedAt,
              dayKey: localDateKey(recordedAt),
              moodCode: mood,
              intensity,
              factors: cleanFactors(defs, { ...factors, ...typed }),
              notes: notes.trim(),
            };
            void (
              entry
                ? actions.updateRecord('wellbeingEntry', entry.id, values)
                : actions.createRecord('wellbeingEntry', values)
            ).then(() => {
              toast(t('common.saved'), 'success');
              onClose();
            });
          }}
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <ChoiceList
          label={t('wb.mood')}
          value={mood}
          onChange={setMood}
          options={MOODS.map((m) => ({ value: m.code, label: label(m.code) }))}
        />
        <ChipGroup
          label={t('wb.howStrong')}
          value={String(intensity)}
          onChange={(v) => setIntensity(Number(v))}
          options={INTENSITIES.map((i) => ({ value: String(i), label: t(`wb.intensity${i}` as never) }))}
        />
        {defs.map((def) =>
          def.type === 'boolean' ? (
            <Checkbox
              key={def.code}
              checked={factors[def.code] === true}
              onChange={(on) => setFactors((f) => ({ ...f, [def.code]: on }))}
              label={name(def)}
            />
          ) : def.type === 'scale' ? (
            <ChipGroup
              key={def.code}
              label={name(def)}
              value={String(typeof factors[def.code] === 'number' ? factors[def.code] : 0)}
              onChange={(v) => setFactors((f) => ({ ...f, [def.code]: Number(v) }))}
              options={SCALE_STEPS.map((s) => ({ value: String(s), label: scaleLabel(def.code, s, t) }))}
            />
          ) : (
            <DecimalField
              key={def.code}
              label={`${name(def)}${def.unit ? ` (${def.unit})` : ''}`}
              value={numbers[def.code] ?? ''}
              onChange={(v) => setNumbers((n) => ({ ...n, [def.code]: v }))}
            />
          ),
        )}
        <DateTimeField label={t('dose.when')} type="datetime-local" value={when} onChange={setWhen} />
        <TextArea label={t('eeg.notes')} value={notes} onChange={setNotes} rows={3} />
      </Stack>
    </BottomSheet>
  );
}

const scaleLabel = (code: string, step: number, t: ReturnType<typeof useApp>['t']): string =>
  code === 'factor.sleep_quality' ? t(`wb.sleep${step}` as never) : t(`wb.scale${step}` as never);

/** Moods and how the factors line up with the days that had a seizure (F-406). It shows what coincided, not what caused it. */
function Overview() {
  const { t, label, seizures, settings } = useApp();
  const name = useFactorName();
  const entries = useRecordList<WellbeingEntry>('wellbeingEntry');
  const defs = effectiveFactors(settings.wellbeingFactors);
  const stats = useMemo(() => factorStats({ defs, entries, seizures }), [defs, entries, seizures]);
  const moods = moodCounts(entries);
  const days = new Set(entries.map((e) => e.dayKey)).size;
  if (entries.length === 0) return <p className="app-note">{t('wb.none')}</p>;
  return (
    <Stack>
      <p className="app-note">{t('wb.daysCovered', { days })}</p>
      <Section title={t('wb.moods')}>
        <Stack gap="0.25rem">
          {moods.map((m) => (
            <p className="app-note" key={m.code}>
              {label(m.code)}: {m.count}
            </p>
          ))}
        </Stack>
      </Section>
      <Section title={t('wb.alongside')}>
        <Stack>
          <p className="app-note">{t('wb.alongsideHelp')}</p>
          {stats
            .filter((s) => s.seizureDays.days + s.otherDays.days > 0)
            .map((s) => {
              const def = defs.find((d) => d.code === s.code) ?? { code: s.code, type: s.type, unit: '' };
              return (
                <Card compact key={s.code}>
                  <Stack gap="0.25rem">
                    <p className="app-banner">{name(def)}</p>
                    <p className="app-note">{t('wb.onSeizureDays', stat(s.seizureDays, def, t))}</p>
                    <p className="app-note">{t('wb.onOtherDays', stat(s.otherDays, def, t))}</p>
                  </Stack>
                </Card>
              );
            })}
        </Stack>
      </Section>
    </Stack>
  );
}

function stat(
  group: { days: number; present: number; average: number | null },
  def: FactorDef,
  t: ReturnType<typeof useApp>['t'],
) {
  return {
    days: group.days,
    value:
      group.average !== null
        ? `${(Math.round(group.average * 10) / 10).toString()}${def.unit ? ` ${def.unit}` : ''}`
        : `${group.present}/${group.days}`,
    what: group.average !== null ? t('wb.average') : t('wb.present'),
  };
}

/** The factors asked (F-552): add your own, remove one, put the usual ten back. */
function Factors() {
  const { t, settings, actions, patient } = useApp();
  const name = useFactorName();
  const own = settings.wellbeingFactors;
  const defs = effectiveFactors(own);
  const [adding, setAdding] = useState(false);
  const save = (next: FactorDef[]) =>
    actions.setSetting(
      'wellbeingFactors',
      next.map(({ label, ...rest }) => (label ? { ...rest, label } : rest)),
    );
  return (
    <Stack>
      <p className="app-note">{t('wb.factorsHelp')}</p>
      {defs.map((def) => (
        <Card compact key={def.code}>
          <div className="app-row">
            <div>
              <p className="app-banner">{name(def)}</p>
              <p className="app-note">
                {t(`wb.type.${def.type}` as never)}
                {def.unit ? ` · ${def.unit}` : ''}
              </p>
            </div>
            <Button size="md" variant="danger" onClick={() => void save(defs.filter((d) => d.code !== def.code))}>
              {t('common.remove')}
            </Button>
          </div>
        </Card>
      ))}
      <div className="ui-cluster">
        <Button onClick={() => setAdding(true)} disabled={!patient}>
          {t('wb.addFactor')}
        </Button>
        <Button disabled={own.length === 0} onClick={() => void actions.setSetting('wellbeingFactors', [])}>
          {t('wb.resetFactors')}
        </Button>
      </div>
      {adding ? (
        <AddFactor
          onClose={() => setAdding(false)}
          onAdd={async (label, type, unit) => {
            const code = await actions.addCustomFactor(label);
            await save([...defs, { code, type, unit, label }]);
            setAdding(false);
          }}
        />
      ) : null}
    </Stack>
  );
}

function AddFactor({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (label: string, type: FactorDef['type'], unit: string) => Promise<void>;
}) {
  const { t } = useApp();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FactorDef['type']>('boolean');
  const [unit, setUnit] = useState('');
  return (
    <BottomSheet
      title={t('wb.addFactor')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          fullWidth
          disabled={label.trim() === ''}
          onClick={() => void onAdd(label.trim().slice(0, 60), type, type === 'number' ? unit.trim().slice(0, 20) : '')}
        >
          {t('common.save')}
        </Button>
      }
    >
      <Stack>
        <TextField label={t('wb.factorName')} value={label} onChange={setLabel} />
        <Select
          label={t('wb.factorType')}
          value={type}
          onChange={(v) => setType(v as FactorDef['type'])}
          options={(['boolean', 'scale', 'number'] as const).map((x) => ({
            value: x,
            label: t(`wb.type.${x}` as never),
          }))}
        />
        {type === 'number' ? <TextField label={t('wb.factorUnit')} value={unit} onChange={setUnit} /> : null}
      </Stack>
    </BottomSheet>
  );
}
