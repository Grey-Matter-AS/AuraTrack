import type { Ilae2025, Ilae2025Generalized } from '../schemas';

// The ILAE 2025 seizure classification, basic version (Beniczky et al., Epilepsia 2025; decision D-17). The answers are
// stored; everything here is worked out from them, so the editor, History, reports and the native apps agree.

export const EMPTY_ILAE_2025: Ilae2025 = {
  class: null,
  recall: null,
  responsive: null,
  bilateralTonicClonic: null,
  observable: null,
  generalized: null,
};

/**
 * Consciousness, from awareness (recall) and responsiveness: impaired if either is impaired, preserved only if both are
 * preserved, otherwise undetermined (null), and the seizure is then named by its class alone.
 */
export function consciousness(a: Ilae2025): 'preserved' | 'impaired' | null {
  if (a.recall === 'no' || a.responsive === 'no') return 'impaired';
  if (a.recall === 'yes' && a.responsive === 'yes') return 'preserved';
  return null;
}

/** The seizure types the app names (Table 1 of the paper); `g.<kind>` for the generalized ones. */
export type Ilae2025Type =
  | 'focal'
  | 'focal_preserved_consciousness'
  | 'focal_impaired_consciousness'
  | 'focal_to_bilateral_tonic_clonic'
  | 'unknown'
  | 'unknown_preserved_consciousness'
  | 'unknown_impaired_consciousness'
  | 'unknown_bilateral_tonic_clonic'
  | 'generalized'
  | `g.${Ilae2025Generalized}`;

/** The ILAE 2025 seizure type the answers give, or null when the start is not answered (not classified). */
export function ilae2025Type(a: Ilae2025): Ilae2025Type | null {
  if (a.class === 'generalized') return a.generalized ? `g.${a.generalized}` : 'generalized';
  if (a.class === null) return null;
  const c = a.class;
  if (a.bilateralTonicClonic === 'yes')
    return c === 'focal' ? 'focal_to_bilateral_tonic_clonic' : 'unknown_bilateral_tonic_clonic';
  const level = consciousness(a);
  return level ? `${c}_${level}_consciousness` : c;
}

/**
 * Were there observable manifestations? A seizure with impaired consciousness, or one that became bilateral tonic-clonic,
 * has them by definition; otherwise the answer given.
 */
export function observable(a: Ilae2025): 'yes' | 'no' | 'unknown' | null {
  if (a.class === 'generalized' || a.class === null) return null;
  if (consciousness(a) === 'impaired' || a.bilateralTonicClonic === 'yes') return 'yes';
  return a.observable;
}

/** Which questions apply to these answers. The others are hidden in the editor and not saved. */
export function ilae2025Questions(a: Ilae2025) {
  const focalOrUnknown = a.class === 'focal' || a.class === 'unknown';
  return {
    recall: focalOrUnknown,
    responsive: focalOrUnknown,
    bilateralTonicClonic: focalOrUnknown,
    observable: focalOrUnknown && consciousness(a) !== 'impaired' && a.bilateralTonicClonic !== 'yes',
    generalized: a.class === 'generalized',
  };
}

/** The answers as they are saved: an answer to a question that does not apply is dropped; nothing answered is null. */
export function ilae2025ForSaving(a: Ilae2025): Ilae2025 | null {
  const shown = ilae2025Questions(a);
  const kept: Ilae2025 = {
    class: a.class,
    recall: shown.recall ? a.recall : null,
    responsive: shown.responsive ? a.responsive : null,
    bilateralTonicClonic: shown.bilateralTonicClonic ? a.bilateralTonicClonic : null,
    observable: shown.observable ? a.observable : null,
    generalized: shown.generalized ? a.generalized : null,
  };
  return Object.values(kept).every((v) => v === null) ? null : kept;
}

/**
 * Like the old "aura only": a focal seizure with preserved consciousness and nothing others could see. Its editor has no
 * During tab.
 */
export const isAuraLike = (a: Ilae2025 | null | undefined): boolean =>
  !!a && a.class === 'focal' && consciousness(a) === 'preserved' && observable(a) === 'no';

const KEYS = ['class', 'recall', 'responsive', 'bilateralTonicClonic', 'observable', 'generalized'] as const;

/**
 * The answers after the chosen profile changes from `from` to `to` (either may be none). What the new profile answers is
 * set. An answer the old profile gave, that the new one leaves open and that nobody has changed since, is cleared, so it
 * doesn't stay behind looking like a choice. Answers given by hand are kept.
 */
export function switchProfileAnswers(current: Ilae2025, from: Ilae2025 | null, to: Ilae2025 | null): Ilae2025 {
  const next: Record<string, unknown> = { ...current };
  for (const key of KEYS) {
    const set = to?.[key] ?? null;
    if (set !== null) next[key] = set;
    else if (from && from[key] !== null && current[key] === from[key]) next[key] = null;
  }
  return next as Ilae2025;
}
