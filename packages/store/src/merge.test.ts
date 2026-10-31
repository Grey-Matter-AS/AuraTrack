import { encodeHlc } from '@auratrack/model';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MergeMismatchError,
  currentValues,
  isDeleted,
  mergeAppendOnly,
  mergeField,
  mergeRecords,
  stableStringify,
  type FieldEntry,
  type JsonValue,
  type MergeRules,
  type VersionedRecord,
} from './merge';

const stamp = (wall: number, node = 'a', counter = 0) => encodeHlc({ wall, counter, node });
const entry = (value: JsonValue, wall: number, node = 'a'): FieldEntry => ({ value, stamp: stamp(wall, node) });
const record = (fields: Record<string, FieldEntry>, deletedAt: string | null = null): VersionedRecord => ({
  id: 'r1',
  type: 'seizure',
  fields,
  deletedAt,
});

describe('stableStringify', () => {
  it('ignores key order and handles every JSON shape', () => {
    expect(stableStringify({ b: 1, a: [1, { d: null, c: 'x' }] })).toBe(
      stableStringify({ a: [1, { c: 'x', d: null }], b: 1 }),
    );
    expect(stableStringify({ b: 1, a: [true, null, 'x'] })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(stableStringify(5)).toBe('5');
  });
});

describe('mergeField', () => {
  it('newest edit wins, on either side', () => {
    expect(mergeField('newest', entry('old', 1), entry('new', 2)).value).toBe('new');
    expect(mergeField('newest', entry('new', 2), entry('old', 1)).value).toBe('new');
  });

  it('breaks an identical stamp by device, then by value, the same both ways', () => {
    expect(mergeField('newest', entry('x', 5, 'a'), entry('y', 5, 'b')).value).toBe('y');
    const same = { value: 'p', stamp: stamp(5) };
    expect(mergeField('newest', same, { value: 'q', stamp: stamp(5) }).value).toBe('q');
    expect(mergeField('newest', { value: 'q', stamp: stamp(5) }, same).value).toBe('q');
    expect(mergeField('newest', same, { ...same })).toBe(same);
  });

  it('rank beats the clock: taken wins over a newer assumed or missed', () => {
    const rule = { rank: ['taken', 'assumed', 'missed'] } as const;
    expect(mergeField(rule, entry('taken', 1), entry('missed', 9)).value).toBe('taken');
    expect(mergeField(rule, entry('missed', 9), entry('assumed', 1)).value).toBe('assumed');
    expect(mergeField(rule, entry('assumed', 1), entry('taken', 9)).value).toBe('taken');
  });

  it('rank: two unlisted values fall back to the newest (regression: -Infinity minus -Infinity)', () => {
    const rule = { rank: ['taken'] } as const;
    expect(mergeField(rule, entry('x', 1), entry('y', 2)).value).toBe('y');
    expect(mergeField(rule, entry('y', 2), entry('x', 1)).value).toBe('y');
  });

  it('rank: an unlisted value loses to a listed one, and ties fall back to the newest', () => {
    const rule = { rank: ['taken', 'missed'] } as const;
    expect(mergeField(rule, entry('mystery', 9), entry('missed', 1)).value).toBe('missed');
    expect(mergeField(rule, entry(7, 9), entry('missed', 1)).value).toBe('missed');
    expect(mergeField(rule, entry('x', 1), entry('y', 2)).value).toBe('y');
    expect(mergeField(rule, entry('missed', 1), entry('missed', 2)).stamp).toBe(stamp(2));
  });
});

describe('mergeRecords', () => {
  it('keeps edits to different fields from two devices', () => {
    const phone = record({ notes: entry('felt dizzy', 10, 'phone'), trigger: entry('sleep', 1, 'phone') });
    const tablet = record({
      notes: entry('', 1, 'tablet'),
      trigger: entry('sleep', 1, 'phone'),
      mood: entry('calm', 12, 'tablet'),
    });
    const merged = mergeRecords(phone, tablet);
    expect(currentValues(merged)).toEqual({ notes: 'felt dizzy', trigger: 'sleep', mood: 'calm' });
  });

  it('a phone with a clock far in the past cannot overwrite newer data', () => {
    const right = record({ notes: entry('real note', 1_000_000, 'phone') });
    const wrong = record({ notes: entry('stale', 5, 'tablet') });
    expect(currentValues(mergeRecords(right, wrong))?.notes).toBe('real note');
  });

  it('applies the rule given for a field', () => {
    const rules: MergeRules = { status: { rank: ['taken', 'assumed', 'missed'] } };
    const a = record({ status: entry('taken', 1) });
    const b = record({ status: entry('missed', 99) });
    expect(currentValues(mergeRecords(a, b, rules))?.status).toBe('taken');
  });

  it('a deletion is final: later edits cannot bring the record back', () => {
    const live = record({ notes: entry('later edit', 100) });
    const gone = record({ notes: entry('x', 1) }, stamp(50));
    const merged = mergeRecords(live, gone);
    expect(isDeleted(merged)).toBe(true);
    expect(currentValues(merged)).toBeNull();
    expect(isDeleted(mergeRecords(gone, live))).toBe(true);
    expect(mergeRecords(gone, record({}, stamp(60))).deletedAt).toBe(stamp(60));
    expect(mergeRecords(record({}, stamp(60)), gone).deletedAt).toBe(stamp(60));
    expect(isDeleted(live)).toBe(false);
  });

  it('refuses to merge different records or the same id with two types', () => {
    expect(() => mergeRecords(record({}), { ...record({}), id: 'r2' })).toThrow(MergeMismatchError);
    expect(() => mergeRecords(record({}), { ...record({}), type: 'dose' })).toThrow(MergeMismatchError);
  });
});

// Property tests: convergence for any order and any number of repeats.
const nodeArb = fc.constantFrom('a', 'b', 'c');
const valueArb: fc.Arbitrary<JsonValue> = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.constantFrom('taken', 'assumed', 'missed', 'x', 'y'),
);
const entryArb = fc.record({
  value: valueArb,
  stamp: fc
    .tuple(fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 3 }), nodeArb)
    .map(([wall, counter, node]) => encodeHlc({ wall, counter, node })),
});
const fieldNames = ['notes', 'status', 'mood'] as const;
const recordArb: fc.Arbitrary<VersionedRecord> = fc
  .record({
    fields: fc.dictionary(fc.constantFrom(...fieldNames), entryArb),
    deletedAt: fc.option(
      entryArb.map((e) => e.stamp),
      { nil: null },
    ),
  })
  .map(({ fields, deletedAt }) => ({ id: 'r1', type: 'dose', fields, deletedAt }));
const rules: MergeRules = { status: { rank: ['taken', 'assumed', 'missed'] } };

describe('merge convergence (property tests)', () => {
  it('commutative: the order two devices meet in does not matter', () => {
    fc.assert(
      fc.property(recordArb, recordArb, (a, b) => {
        expect(mergeRecords(a, b, rules)).toEqual(mergeRecords(b, a, rules));
      }),
    );
  });

  it('associative: three devices meeting in any grouping agree', () => {
    fc.assert(
      fc.property(recordArb, recordArb, recordArb, (a, b, c) => {
        expect(mergeRecords(mergeRecords(a, b, rules), c, rules)).toEqual(
          mergeRecords(a, mergeRecords(b, c, rules), rules),
        );
      }),
    );
  });

  it('idempotent: receiving the same changes again changes nothing', () => {
    fc.assert(
      fc.property(recordArb, recordArb, (a, b) => {
        const once = mergeRecords(a, b, rules);
        expect(mergeRecords(once, b, rules)).toEqual(once);
        expect(mergeRecords(once, once, rules)).toEqual(once);
      }),
    );
  });

  it('never loses a field and never brings back a deleted record', () => {
    fc.assert(
      fc.property(recordArb, recordArb, (a, b) => {
        const merged = mergeRecords(a, b, rules);
        for (const name of [...Object.keys(a.fields), ...Object.keys(b.fields)])
          expect(merged.fields).toHaveProperty(name);
        if (a.deletedAt !== null || b.deletedAt !== null) expect(isDeleted(merged)).toBe(true);
      }),
    );
  });

  it('any order of applying a list of copies gives the same result', () => {
    fc.assert(
      fc.property(fc.array(recordArb, { minLength: 1, maxLength: 6 }), fc.nat(), (copies, shift) => {
        const fold = (list: VersionedRecord[]) => list.reduce((acc, next) => mergeRecords(acc, next, rules));
        const rotated = [...copies.slice(shift % copies.length), ...copies.slice(0, shift % copies.length)];
        expect(fold(rotated)).toEqual(fold([...copies].reverse()));
      }),
    );
  });
});

describe('mergeAppendOnly', () => {
  type Change = { id: string; note: string };
  const map = (...items: Change[]) => new Map(items.map((item) => [item.id, item]));

  it('is the union by id', () => {
    const { merged, conflicts } = mergeAppendOnly(map({ id: '1', note: 'a' }), map({ id: '2', note: 'b' }));
    expect([...merged.keys()].sort()).toEqual(['1', '2']);
    expect(conflicts).toEqual([]);
  });

  it('copies that are identical are not a conflict, whatever their key order', () => {
    const a = new Map([['1', { id: '1', note: 'a' }]]);
    const b = new Map([['1', { note: 'a', id: '1' }]]);
    expect(mergeAppendOnly(a, b).conflicts).toEqual([]);
  });

  it('reports two different records under one id and picks the same one both ways', () => {
    const a = map({ id: '1', note: 'first' });
    const b = map({ id: '1', note: 'second' });
    const forward = mergeAppendOnly(a, b);
    const backward = mergeAppendOnly(b, a);
    expect(forward.conflicts).toEqual(['1']);
    expect(forward.merged.get('1')).toEqual(backward.merged.get('1'));
  });

  it('is commutative and idempotent on sets (property)', () => {
    const changeArb = fc.record({ id: fc.constantFrom('1', '2', '3'), note: fc.constantFrom('a', 'b') });
    const mapArb = fc.array(changeArb).map((items) => map(...items));
    fc.assert(
      fc.property(mapArb, mapArb, (a, b) => {
        const ab = mergeAppendOnly(a, b);
        const ba = mergeAppendOnly(b, a);
        expect(Object.fromEntries(ab.merged)).toEqual(Object.fromEntries(ba.merged));
        expect(mergeAppendOnly(ab.merged, b).merged).toEqual(ab.merged);
      }),
    );
  });
});
