import type { MessageKey } from '@auratrack/i18n';
import { ilae2025Type, type Seizure } from '@auratrack/model';
import type { ReportText } from './context';

// How the reports name a seizure (D-17). Seizures saved before 7.2 keep their plain-language type; newer ones have their
// ILAE 2025 answers and, often, the profile they came from.

/** The ILAE 2025 type of a seizure, named, or null when it has none. */
export function ilae2025Text(s: Pick<Seizure, 'ilae2025'>, t: ReportText): string | null {
  const type = s.ilae2025 ? ilae2025Type(s.ilae2025) : null;
  return type ? t(`classify.type.${type}` as MessageKey) : null;
}

type Named = Pick<Seizure, 'ilae2025' | 'profile' | 'typeCode'>;

/** The person's own name for it (the profile), else the ILAE 2025 type, else the older type. For the diary and charts. */
export const seizureTitle = (s: Named, t: ReportText, label: (code: string) => string): string =>
  s.profile?.name ?? ilae2025Text(s, t) ?? (s.typeCode ? label(s.typeCode) : t('rep.untyped'));

/** The clinical class first (ILAE 2025, else the older type), then the profile, for clinicians: "Focal … (Usual seizure)". */
export function clinicalName(s: Named, t: ReportText, label: (code: string) => string): string {
  const base = ilae2025Text(s, t) ?? (s.typeCode ? label(s.typeCode) : null);
  if (s.profile) return base ? `${base} (${s.profile.name})` : s.profile.name;
  return base ?? t('rep.untyped');
}

/** The clinical class alone, for counting by type: profiles with the same ILAE 2025 type count together. */
export const clinicalClass = (s: Named, t: ReportText, label: (code: string) => string): string =>
  ilae2025Text(s, t) ?? (s.typeCode ? label(s.typeCode) : null) ?? s.profile?.name ?? t('rep.untyped');
