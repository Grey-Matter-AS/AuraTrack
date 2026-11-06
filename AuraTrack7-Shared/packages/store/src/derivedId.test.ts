import { describe, expect, it } from 'vitest';
import { IdSchema } from '@auratrack/model';
import { derivedId } from './derivedId';

describe('derivedId', () => {
  it('gives the same valid id for the same parts, and another for other parts', async () => {
    const a = await derivedId('h', 'seizure', '2026-10-05');
    expect(await derivedId('h', 'seizure', '2026-10-05')).toBe(a);
    expect(await derivedId('h', 'seizure', '2026-10-06')).not.toBe(a);
    expect(await derivedId('hs', 'eizure')).not.toBe(await derivedId('h', 'seizure'));
    expect(IdSchema.safeParse(a).success).toBe(true);
  });
});
