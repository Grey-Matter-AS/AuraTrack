import { describe, expect, it } from 'vitest';
import { IdSchema, newId } from './ids';

describe('ids', () => {
  it('creates valid, distinct UUIDs', () => {
    const a = newId();
    expect(IdSchema.safeParse(a).success).toBe(true);
    expect(newId()).not.toBe(a);
  });

  it('rejects anything that is not a UUID', () => {
    expect(IdSchema.safeParse('not-an-id').success).toBe(false);
    expect(IdSchema.safeParse(42).success).toBe(false);
  });
});
