import type { Language } from '../../index';
import type { m4en } from '../m4/en';
import type { m5en } from '../m5/en';
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
export type ExtraKey = keyof typeof m4en | keyof typeof m5en;
export type Extra = Partial<Record<ExtraKey, string>>;
export const extraTr: Record<Exclude<Language, 'en'>, Extra> = { nb, nn, da, sv, fi, de, fr, es };
