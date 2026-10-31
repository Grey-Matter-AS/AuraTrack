import { z } from 'zod';

// Every id in v7 is a UUID, created once on the device that writes the record. Ids are never reused or rewritten.
export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const newId = (): Id => globalThis.crypto.randomUUID();
