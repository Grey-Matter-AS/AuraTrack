import type { MessageKey, MessageParams } from '@auratrack/i18n';
import {
  ilae2025Type,
  seizureKindKey,
  type Ilae2025,
  type Ilae2025Type,
  type Seizure,
  type SeizureProfile,
} from '@auratrack/model';

type T = (key: MessageKey, params?: MessageParams) => string;

/** The ILAE 2025 type's name, or "Not classified yet". */
export const ilae2025TypeName = (type: Ilae2025Type | null, t: T): string =>
  type ? t(`classify.type.${type}` as MessageKey) : t('classify.notClassified');

/** The ILAE 2025 type of these answers, named. */
export const ilae2025Name = (answers: Ilae2025 | null | undefined, t: T): string | null => {
  const type = answers ? ilae2025Type(answers) : null;
  return type ? ilae2025TypeName(type, t) : null;
};

/**
 * What a seizure is called on lists and headers (D-17): its profile's name as it was saved; else its ILAE 2025 type; else,
 * for one recorded before 7.2, its plain-language type; else "Type not set".
 */
export function seizureName(s: Seizure, t: T, label: (code: string) => string): string {
  if (s.profile) return s.profile.name;
  const named = ilae2025Name(s.ilae2025, t);
  if (named) return named;
  return s.typeCode ? label(s.typeCode) : t('home.untyped');
}

/** Has the seizure been classified in any way (a profile, ILAE 2025 answers, or an older type)? */
export const isClassified = (s: Seizure): boolean => seizureKindKey(s) !== null;

/**
 * The kinds of seizure there are in this list, for the History filter and the chart colours: the person's profiles first
 * (in their order, named as they are now), then ILAE 2025 types, then the types of older seizures.
 */
export function seizureKinds(
  seizures: readonly Seizure[],
  profiles: readonly SeizureProfile[],
  t: T,
  label: (code: string) => string,
): { value: string; label: string }[] {
  const named = new Map<string, string>();
  for (const s of seizures) {
    const key = seizureKindKey(s);
    if (key && !named.has(key)) named.set(key, seizureName(s, t, label));
  }
  for (const p of profiles) if (named.has(`profile:${p.id}`)) named.set(`profile:${p.id}`, p.name);
  const rank = (key: string) => {
    if (key.startsWith('profile:')) {
      const at = profiles.findIndex((p) => `profile:${p.id}` === key);
      return at < 0 ? profiles.length : at;
    }
    return key.startsWith('ilae2025:') ? 1000 : 2000;
  };
  return [...named]
    .sort(([a, x], [b, y]) => rank(a) - rank(b) || x.localeCompare(y))
    .map(([value, text]) => ({ value, label: text }));
}

/** The series colour (1 to 7) of a kind, by its place among the kinds; 8 for seizures not classified. */
/**
 * The colour slot of a seizure kind on the timeline: a seizure with no type is slot 1, which follows the accent colour;
 * each named kind takes the next slot (2 to 8), so kinds stay apart from each other and from the untyped ones.
 */
export const seriesOf = (key: string | null, kinds: readonly { value: string }[]): number => {
  const index = key === null ? -1 : kinds.findIndex((k) => k.value === key);
  return index < 0 ? 1 : (index % 7) + 2;
};
