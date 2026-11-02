import { LANGUAGES } from '@auratrack/i18n';
import { ENGLISH } from '@auratrack/ui';
import { describe, expect, it } from 'vitest';
import { uiStringsFor } from './uiStrings';

describe('the kit strings in each language', () => {
  it('English matches the kit default, so nothing changes for English', () => {
    const en = uiStringsFor('en');
    for (const key of Object.keys(ENGLISH) as (keyof typeof ENGLISH)[]) {
      if (key === 'position') expect(en.position(2, 4)).toBe(ENGLISH.position(2, 4));
      else expect(en[key], key).toBe(ENGLISH[key]);
    }
  });

  it.each(LANGUAGES)('%s: every kit string is there and "2 of 4" keeps both numbers', (language) => {
    const strings = uiStringsFor(language);
    for (const [key, value] of Object.entries(strings)) {
      if (typeof value === 'string') expect(value.length, key).toBeGreaterThan(0);
    }
    const position = strings.position(2, 4);
    expect(position).toContain('2');
    expect(position).toContain('4');
  });
});
