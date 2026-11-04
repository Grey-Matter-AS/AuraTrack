import da from './labels/da.json';
import de from './labels/de.json';
import drafted from './labels/drafted.json';
import en from './labels/en.json';
import es from './labels/es.json';
import fi from './labels/fi.json';
import fr from './labels/fr.json';
import nb from './labels/nb.json';
import nn from './labels/nn.json';
import sv from './labels/sv.json';

// @auratrack/i18n — labels for every code, in 9 languages. Codes are stored; labels are only ever looked up here.
// English has every label. Every other language has every label too: the ones ported from 6.1 where the meaning maps
// exactly, and the rest drafted by Claude (2026-11-01, M3). Drafted labels are listed in labels/drafted.json until a
// native speaker has checked them. labels/review.json lists codes with no label at all in a language; they show the
// English label until one is added.
export const LANGUAGES = ['en', 'nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);

const LABELS: Record<Language, Readonly<Record<string, string>>> = { en, nb, nn, da, sv, fi, de, fr, es };

export interface Label {
  text: string;
  /** True when the label shown is the English one because the chosen language has no reviewed label yet. */
  fallback: boolean;
}

/** Labels of a household's own codes, from its custom catalogue. */
export type CustomLabels = ReadonlyMap<string, string>;

export function labelFor(language: Language, code: string, custom?: CustomLabels): Label {
  const own = custom?.get(code);
  if (own !== undefined) return { text: own, fallback: false };
  const translated = LABELS[language][code];
  if (translated !== undefined) return { text: translated, fallback: false };
  const english = LABELS.en[code];
  // An unknown code is shown as it is, never hidden: stored data must stay visible
  return { text: english ?? code, fallback: true };
}

export const labelText = (language: Language, code: string, custom?: CustomLabels): string =>
  labelFor(language, code, custom).text;

/** Has a native speaker not yet checked this label? True for the ones drafted by Claude and still on the list. */
export const isDrafted = (language: Language, code: string): boolean =>
  (drafted as Record<string, string[]>)[language]?.includes(code) ?? false;

/** Codes that have a label in the given language (used by tests and the review list). */
export const labelledCodes = (language: Language): string[] => Object.keys(LABELS[language]);

export { MESSAGE_KEYS, message, messageTemplate, type MessageKey, type MessageParams } from './messages';

const foldLabel = (text: string): string => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
let byLabel: Map<string, Set<string>> | null = null;

/**
 * The codes whose label is this text, in any of the nine languages (case and spacing do not matter). For reading a file a
 * person filled in by hand: more than one code means the name is not enough to tell which is meant.
 */
export function codesForLabel(text: string): string[] {
  if (!byLabel) {
    byLabel = new Map();
    for (const language of LANGUAGES)
      for (const [code, label] of Object.entries(LABELS[language])) {
        const key = foldLabel(label);
        const codes = byLabel.get(key) ?? new Set<string>();
        codes.add(code);
        byLabel.set(key, codes);
      }
  }
  return [...(byLabel.get(foldLabel(text)) ?? [])];
}
