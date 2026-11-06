import {
  SETTING_DEFS,
  SETTING_KEYS,
  emergencyPlan,
  settingValue,
  type EmergencyPlan,
  type Seizure,
  type Setting,
  type SettingKey,
  type SettingValue,
} from '@auratrack/model';

// The settings the screens read, resolved from the stored setting records: the newest valid value wins, otherwise the
// default. A device setting applies everywhere; a patient setting only to its patient.

export type ResolvedSettings = { [K in SettingKey]: SettingValue<K> } & { plan: EmergencyPlan };

const PLAN_KEYS = ['emergencyAlertMinutes', 'clusterMinCount', 'clusterWindowMinutes'] as const;

const newest = (records: readonly Setting[], key: string, patientId: string | null, patientScoped: boolean) =>
  records
    .filter((r) => r.key === key && (!patientScoped || r.patientId === patientId))
    .sort((a, b) => b.createdAt - a.createdAt)[0];

export function resolveSettings(records: readonly Setting[], patientId: string | null): ResolvedSettings {
  const out: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    const found = newest(records, key, patientId, SETTING_DEFS[key].scope === 'patient');
    out[key] = settingValue(key, found?.value);
  }
  const planValues: Record<string, unknown> = {};
  for (const key of PLAN_KEYS) {
    const found = newest(records, key, patientId, false);
    if (found) planValues[key] = found.value;
  }
  return { ...(out as ResolvedSettings), plan: emergencyPlan(planValues) };
}

/** The record that holds a setting now, if there is one: it is changed rather than added to. */
export const settingRecord = (records: readonly Setting[], key: SettingKey, patientId: string | null) =>
  newest(records, key, patientId, SETTING_DEFS[key].scope === 'patient');

/** The symptoms this patient has during seizures most often, most common first: the symptom strip's choices. */
export function usualSymptoms(seizures: readonly Seizure[], count = 4): string[] {
  const tally = new Map<string, number>();
  for (const seizure of seizures)
    for (const symptom of seizure.symptoms)
      if (symptom.phase === 'seizure') tally.set(symptom.code, (tally.get(symptom.code) ?? 0) + 1);
  return [...tally]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([code]) => code);
}
