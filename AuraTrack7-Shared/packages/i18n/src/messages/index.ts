import type { Language } from '../index';
import { da } from './da';
import { de } from './de';
import { en, type MessageKey } from './en';
import { es } from './es';
import { fi } from './fi';
import { fr } from './fr';
import { nb } from './nb';
import { nn } from './nn';
import { sv } from './sv';

// The sentences and button texts of the screens, in the nine languages. Every language has every key (the type says so, and
// the tests check the placeholders match), so no screen is ever blank; a missing translation would still show English.
export type { MessageKey } from './en';
export const MESSAGE_KEYS = Object.keys(en) as MessageKey[];

const MESSAGES: Record<Language, Readonly<Record<MessageKey, string>>> = { en, nb, nn, da, sv, fi, de, fr, es };

export type MessageParams = Readonly<Record<string, string | number>>;

/** `message('nb', 'tab.added', { n: 3 })` → "3 lagt til". Placeholders are written {name}. */
export function message(language: Language, key: MessageKey, params?: MessageParams): string {
  const text = MESSAGES[language][key] ?? en[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** The raw text of a message, with its placeholders, for the tests and for tools that fill them in themselves. */
export const messageTemplate = (language: Language, key: MessageKey): string => MESSAGES[language][key] ?? en[key];
