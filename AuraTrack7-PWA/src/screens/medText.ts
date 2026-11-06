import { MEDICATION_FORMS, type Regimen } from '@auratrack/model';

// The common anti-seizure and rescue medicines, by their international names (not translated), as suggestions in the form.
// Anything else can be typed.
export const INGREDIENTS = [
  'Acetazolamide',
  'Brivaracetam',
  'Cannabidiol',
  'Carbamazepine',
  'Cenobamate',
  'Clobazam',
  'Clonazepam',
  'Diazepam',
  'Eslicarbazepine',
  'Ethosuximide',
  'Fenfluramine',
  'Gabapentin',
  'Lacosamide',
  'Lamotrigine',
  'Levetiracetam',
  'Lorazepam',
  'Midazolam',
  'Oxcarbazepine',
  'Perampanel',
  'Phenobarbital',
  'Phenytoin',
  'Pregabalin',
  'Primidone',
  'Rufinamide',
  'Stiripentol',
  'Tiagabine',
  'Topiramate',
  'Valproate',
  'Vigabatrin',
  'Zonisamide',
] as const;

export const UNITS = ['mg', 'mcg', 'g', 'ml', 'IU'] as const;

/** The forms a medicine can have: stored as catalogue codes (`form.tablet`); the label comes from the catalogue. */
export const FORMS = MEDICATION_FORMS.map((f) => f.code);

/** "500 mg", or "" when no dose is set. */
export const doseText = (dose: number | null | undefined, unit: string): string =>
  dose === null || dose === undefined ? '' : `${dose} ${unit}`.trim();

/** "500 mg · BD 08:00, 20:00" */
export function regimenSummary(r: Pick<Regimen, 'dose' | 'unit' | 'frequency' | 'scheduledTimes'>): string {
  const when = r.frequency === 'PRN' ? 'PRN' : `${r.frequency} ${r.scheduledTimes.join(', ')}`;
  return [doseText(r.dose, r.unit), when].filter((x) => x !== '').join(' · ');
}

/** The input for a date field, 'YYYY-MM-DD', of an instant on the local clock. */
export function dayInput(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** An instant from a date input and a time input, both on the local clock. */
export function instantFrom(day: string, time: string): number {
  const [y = 0, mo = 1, d = 1] = day.split('-').map(Number);
  const [h = 0, mi = 0] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}
