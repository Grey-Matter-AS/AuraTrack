import type { MessageKey } from '@auratrack/i18n';
import { ilae2025Questions, ilae2025Type, type Ilae2025, type Ilae2025Generalized } from '@auratrack/model';
import { ChipGroup, Stack } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { ilae2025TypeName } from '../app/seizureName';

// The ILAE 2025 questions (basic version, D-17), in plain words, used by the seizure editor and by the profile screen.
// Which questions show follows the answers (model rule ilae2025Questions); the resulting seizure type shows as they are given.

const KINDS: { group: MessageKey; kinds: readonly Ilae2025Generalized[] }[] = [
  {
    group: 'classify.kind.absences',
    kinds: ['typical_absence', 'atypical_absence', 'myoclonic_absence', 'eyelid_myoclonia', 'absence'],
  },
  { group: 'classify.kind.tonicClonic', kinds: ['myoclonic_tonic_clonic', 'absence_to_tonic_clonic', 'tonic_clonic'] },
  {
    group: 'classify.kind.other',
    kinds: ['myoclonic', 'clonic', 'tonic', 'atonic', 'myoclonic_atonic', 'epileptic_spasms', 'negative_myoclonus'],
  },
];

type Answer = 'yes' | 'no' | 'unknown';

export function Ilae2025Questions({ value, onChange }: { value: Ilae2025; onChange: (next: Ilae2025) => void }) {
  const { t } = useApp();
  const shown = ilae2025Questions(value);
  const set = (patch: Partial<Ilae2025>) => onChange({ ...value, ...patch });
  const yesNo = [
    { value: 'yes', label: t('common.yes') },
    { value: 'no', label: t('common.no') },
    { value: 'unknown', label: t('common.notSure') },
  ] as const;
  const question = (
    key: 'recall' | 'responsive' | 'bilateralTonicClonic' | 'observable',
    label: MessageKey,
    help?: MessageKey,
  ) =>
    shown[key] ? (
      <Stack>
        <ChipGroup<Answer>
          label={t(label)}
          showLabel
          value={value[key]}
          onChange={(answer) => set({ [key]: answer })}
          options={yesNo}
        />
        {help ? <p className="app-note">{t(help)}</p> : null}
      </Stack>
    ) : null;
  const focalOrUnknown = shown.recall;
  return (
    <Stack>
      <ChipGroup<'focal' | 'generalized' | 'unknown'>
        label={t('classify.start')}
        showLabel
        value={value.class}
        onChange={(c) => set({ class: c })}
        options={[
          { value: 'focal', label: t('classify.start.focal') },
          { value: 'generalized', label: t('classify.start.generalized') },
          { value: 'unknown', label: t('classify.start.unknown') },
        ]}
      />
      <p className="app-note">{t('classify.startHelp')}</p>
      {question('recall', 'classify.recall')}
      {question('responsive', 'classify.respond', 'classify.respondHelp')}
      {question('bilateralTonicClonic', 'classify.btc', 'classify.btcHelp')}
      {question('observable', 'classify.observable', 'classify.observableHelp')}
      {focalOrUnknown && !shown.observable ? <p className="app-note">{t('classify.observableFollows')}</p> : null}
      {shown.generalized ? (
        <Stack>
          <p className="app-help">{t('classify.kind')}</p>
          {KINDS.map(({ group, kinds }) => (
            <ChipGroup<Ilae2025Generalized>
              key={group}
              label={t(group)}
              showLabel
              value={value.generalized !== null && kinds.includes(value.generalized) ? value.generalized : null}
              onChange={(kind) => set({ generalized: kind })}
              options={kinds.map((kind) => ({ value: kind, label: t(`classify.k.${kind}` as MessageKey) }))}
            />
          ))}
        </Stack>
      ) : null}
      <p className="app-banner">{t('classify.result', { type: ilae2025TypeName(ilae2025Type(value), t) })}</p>
    </Stack>
  );
}
