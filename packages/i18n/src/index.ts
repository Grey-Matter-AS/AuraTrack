import da from './labels/da.json';
import de from './labels/de.json';
import en from './labels/en.json';
import es from './labels/es.json';
import fi from './labels/fi.json';
import fr from './labels/fr.json';
import nb from './labels/nb.json';
import nn from './labels/nn.json';
import sv from './labels/sv.json';

// @auratrack/i18n — labels for every code, in 9 languages. Codes are stored; labels are only ever looked up here.
// English has every label. Another language has the ones ported from 6.1 where the meaning maps exactly; the rest are
// listed in labels/review.json and show the English label until they are reviewed.
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

/** Codes that have a label in the given language (used by tests and the review list). */
export const labelledCodes = (language: Language): string[] => Object.keys(LABELS[language]);
