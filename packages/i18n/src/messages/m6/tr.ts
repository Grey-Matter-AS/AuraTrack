import type { Language } from '../../index';
import type { m6en } from './en';
import { da } from './da';
import { de } from './de';
import { es } from './es';
import { fi } from './fi';
import { fr } from './fr';
import { nb } from './nb';
import { nn } from './nn';
import { sv } from './sv';

// The messages of the household screens (M6) in the other eight languages. Drafted by Claude; not yet checked by a native
// speaker. A key that is missing in a language shows English (see ../index.ts), so no screen is ever blank.
type Tr = Partial<Record<keyof typeof m6en, string>>;
export const m6tr: Record<Exclude<Language, 'en'>, Tr> = { nb, nn, da, sv, fi, de, fr, es };
