import { describe, expect, it } from 'vitest';
import { LANGUAGES, MESSAGE_KEYS, message, messageTemplate, type Language, type MessageKey } from './index';

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
const others = LANGUAGES.filter((l): l is Exclude<Language, 'en'> => l !== 'en');

describe('screen messages', () => {
  it('promises nothing for a later version, in any language', () => {
    const later =
      /later version|senere versjon|seinare versjon|senere version|senare version|myöhempi versio|myöhemmässä versiossa|späteren? Version|version ultérieure|versión posterior/i;
    for (const language of ['en', 'nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es'] as const)
      for (const key of MESSAGE_KEYS) expect(messageTemplate(language, key)).not.toMatch(later);
  });

  it('has 1,317 messages, each with a key that says which screen it belongs to', () => {
    expect(MESSAGE_KEYS).toHaveLength(1317);
    expect(new Set(MESSAGE_KEYS).size).toBe(MESSAGE_KEYS.length);
    for (const key of MESSAGE_KEYS) expect(key, key).toMatch(/^[a-z]+(\.[A-Za-z0-9_]+)+$/);
  });

  it.each(others)('%s: every message is written, trimmed and not empty', (language) => {
    for (const key of MESSAGE_KEYS) {
      const text = messageTemplate(language, key);
      expect(text.length, key).toBeGreaterThan(0);
      expect(text, key).toBe(text.trim());
    }
  });

  it.each(others)('%s: uses exactly the same {placeholders} as English in every message', (language) => {
    for (const key of MESSAGE_KEYS) {
      expect(placeholders(messageTemplate(language, key)), `${language} ${key}`).toEqual(
        placeholders(messageTemplate('en', key)),
      );
    }
  });

  it.each(others)('%s: nearly every message differs from English (a few short words are the same)', (language) => {
    const same = MESSAGE_KEYS.filter((key) => messageTemplate(language, key) === messageTemplate('en', key));
    expect(same.length).toBeLessThan(MESSAGE_KEYS.length * 0.04);
  });

  it('fills in placeholders, leaves an unknown one as written, and works with numbers', () => {
    expect(message('en', 'tab.added', { n: 3 })).toBe('3 added');
    expect(message('nb', 'tab.added', { n: 3 })).toBe('3 lagt til');
    expect(message('en', 'alert.carerTitle', { minutes: 5 })).toBe('5 minutes: follow the emergency plan');
    expect(message('en', 'tab.added', { other: 1 })).toBe('{n} added');
    expect(message('en', 'tab.added')).toBe('{n} added');
  });

  it('the left and right letters of the body map are single letters in every language', () => {
    for (const language of LANGUAGES) {
      expect(messageTemplate(language, 'map.left')).toHaveLength(1);
      expect(messageTemplate(language, 'map.right')).toHaveLength(1);
      expect(messageTemplate(language, 'map.left')).not.toBe(messageTemplate(language, 'map.right'));
    }
  });

  it('keeps the settled clinical wording: 12 minutes, and the medical term for a seizure that does not stop', () => {
    const term = /status epilepticu|état de mal épileptique|estado epiléptico/; // inflected in Finnish; French and Spanish use their own
    for (const language of LANGUAGES) {
      expect(messageTemplate(language, 'stop.title'), language).toContain('12');
      expect(messageTemplate(language, 'rec.stoppedNote'), language).toContain('12');
      expect(messageTemplate(language, 'stop.message').toLowerCase(), language).toMatch(term);
      expect(messageTemplate(language, 'rec.stoppedNote').toLowerCase(), language).toMatch(term);
    }
  });

  it('every key has English text, so a language can never show a blank', () => {
    for (const key of MESSAGE_KEYS as MessageKey[]) expect(messageTemplate('en', key).length).toBeGreaterThan(0);
  });
});
