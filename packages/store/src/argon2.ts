// The only place the Argon2id library is imported. crypto.ts loads this file on demand, and because the import here
// names just `argon2id`, the bundler keeps that one algorithm (not the library's dozens of other hashes).
import { argon2id } from 'hash-wasm';

export interface Argon2Input {
  password: Uint8Array;
  salt: Uint8Array;
  /** Memory in KiB. */
  m: number;
  /** Passes. */
  t: number;
  /** Lanes. */
  p: number;
}

/** 32 bytes of Argon2id output. The caller wipes them once they have become a key. */
export const argon2Bytes = ({ password, salt, m, t, p }: Argon2Input): Promise<Uint8Array> =>
  argon2id({ password, salt, memorySize: m, iterations: t, parallelism: p, hashLength: 32, outputType: 'binary' });
