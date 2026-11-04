import type { StoredType } from '@auratrack/store';
import { useEffect, useState } from 'react';
import { useApp } from './AppContext';

/**
 * All records of one type (the active patient's, unless `all`), read again whenever the app's data changed. `null` while
 * the first read is under way. Records come back as the store holds them; the caller says what type they are.
 */
export function useRecords<T extends { patientId?: string }>(
  type: StoredType,
  options: { all?: boolean } = {},
): T[] | null {
  const { api, revision, patient } = useApp();
  const [records, setRecords] = useState<T[] | null>(null);
  const patientId = patient?.id ?? null;
  const all = options.all === true;
  useEffect(() => {
    let live = true;
    void Promise.resolve(api.list({ type }))
      .then((list) => {
        if (!live) return;
        const rows = list as unknown as T[];
        setRecords(all ? rows : rows.filter((r) => r.patientId === patientId));
      })
      .catch(() => undefined); // the app locked while this was being read: nothing to show
    return () => {
      live = false;
    };
  }, [api, type, revision, patientId, all]);
  return records;
}

const NONE: never[] = [];

/** Like useRecords, but an empty list (always the same one) until the first read, so it is safe in a dependency list. */
export function useRecordList<T extends { patientId?: string }>(
  type: StoredType,
  options: { all?: boolean } = {},
): T[] {
  return useRecords<T>(type, options) ?? (NONE as T[]);
}
