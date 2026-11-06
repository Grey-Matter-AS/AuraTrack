import type { Language } from '../../index';
import type { m4en } from '../m4/en';
import type { m5en } from '../m5/en';
import type { m6en } from '../m6/en';
import type { m7en } from '../m7/en';
import type { m8en } from '../m8/en';
import { m7tr } from '../m7/tr';
import { m8tr } from '../m8/tr';
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
export type ExtraKey =
  keyof typeof m4en | keyof typeof m5en | keyof typeof m6en | keyof typeof m7en | keyof typeof m8en;
export type Extra = Partial<Record<ExtraKey, string>>;
const base: Record<Exclude<Language, 'en'>, Extra> = { nb, nn, da, sv, fi, de, fr, es };
export const extraTr: Record<Exclude<Language, 'en'>, Extra> = {
  nb: { ...base.nb, ...m6tr.nb, ...m7tr.nb, ...m8tr.nb },
  nn: { ...base.nn, ...m6tr.nn, ...m7tr.nn, ...m8tr.nn },
  da: { ...base.da, ...m6tr.da, ...m7tr.da, ...m8tr.da },
  sv: { ...base.sv, ...m6tr.sv, ...m7tr.sv, ...m8tr.sv },
  fi: { ...base.fi, ...m6tr.fi, ...m7tr.fi, ...m8tr.fi },
  de: { ...base.de, ...m6tr.de, ...m7tr.de, ...m8tr.de },
  fr: { ...base.fr, ...m6tr.fr, ...m7tr.fr, ...m8tr.fr },
  es: { ...base.es, ...m6tr.es, ...m7tr.es, ...m8tr.es },
};
