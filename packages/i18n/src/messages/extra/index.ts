import type { Language } from '../../index';
import type { m4en } from '../m4/en';
import type { m5en } from '../m5/en';
import type { m6en } from '../m6/en';
import { m6tr } from '../m6/tr';
import { da } from './da';
import { de } from './de';
import { es } from './es';
import { fi } from './fi';
import { fr } from './fr';
import { nb } from './nb';
import { nn } from './nn';
import { sv } from './sv';

// The messages of the M4 and M5 screens and the reports in the other eight languages. Drafted by Claude; not yet checked by a
// native speaker. A key that is missing in a language shows English (see ../index.ts), so no screen is ever blank.
export type ExtraKey = keyof typeof m4en | keyof typeof m5en | keyof typeof m6en;
export type Extra = Partial<Record<ExtraKey, string>>;
const base: Record<Exclude<Language, 'en'>, Extra> = { nb, nn, da, sv, fi, de, fr, es };
export const extraTr: Record<Exclude<Language, 'en'>, Extra> = {
  nb: { ...base.nb, ...m6tr.nb },
  nn: { ...base.nn, ...m6tr.nn },
  da: { ...base.da, ...m6tr.da },
  sv: { ...base.sv, ...m6tr.sv },
  fi: { ...base.fi, ...m6tr.fi },
  de: { ...base.de, ...m6tr.de },
  fr: { ...base.fr, ...m6tr.fr },
  es: { ...base.es, ...m6tr.es },
};
