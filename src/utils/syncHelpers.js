import { db } from '../data/db';
import { MAX_SYNC_PAYLOAD_CHARS, sanitizeImportPayload } from './importSanitizer';

const QR_SYNC_CODEC_TIMEOUT_MS = 2500;

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? b64 + '='.repeat(4 - b64.length % 4) : b64;
  const binary = atob(pad);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

export async function exportLocalData() {
  const events = await db.events.toArray();
  const medications = await db.medications.toArray().catch(() => []);
  const medicationLogs = await db.medicationLogs.toArray().catch(() => []);
  return { version: 7, exportedAt: Date.now(), events, medications, medicationLogs };
}

export async function mergeRemoteData(parsed) {
  const results = { events: 0, medications: 0, logs: 0 };
  const { events, medications, medicationLogs } = sanitizeImportPayload(parsed);

  if (events.length) {
    const existing = await db.events.toArray();
    const existingUUIDs = new Set(existing.map(e => e.uuid).filter(Boolean));
    const existingTimes = new Set(existing.map(e => e.startTime));
    const toInsert = events
      .filter(e => e.uuid ? !existingUUIDs.has(e.uuid) : !existingTimes.has(e.startTime));
    if (toInsert.length) await db.events.bulkAdd(toInsert);
    results.events = toInsert.length;
  }

  if (medications.length) {
    const existing = await db.medications.toArray().catch(() => []);
    const existingKeys = new Set(existing.map(m => `${m.name}|${m.frequency}`));
    const toInsert = medications
      .filter(m => !existingKeys.has(`${m.name}|${m.frequency}`));
    if (toInsert.length) await db.medications.bulkAdd(toInsert).catch(() => {});
    results.medications = toInsert.length;
  }

  if (medicationLogs.length) {
    const existing = await db.medicationLogs.toArray().catch(() => []);
    const existingKeys = new Set(
      existing.map(l => `${l.medicationId}|${l.scheduledTime ?? ''}|${l.takenAt}`)
    );
    const toInsert = medicationLogs
      .filter(l => !existingKeys.has(`${l.medicationId}|${l.scheduledTime ?? ''}|${l.takenAt}`));
    if (toInsert.length) await db.medicationLogs.bulkAdd(toInsert).catch(() => {});
    results.logs = toInsert.length;
  }

  return results;
}

export async function compressSDP(sdpString) {
  const data = new TextEncoder().encode(sdpString);

  try {
    if (typeof CompressionStream !== 'function') throw new Error('CompressionStream unavailable');
    const compressed = await withTimeout((async () => {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      await writer.write(data);
      await writer.close();
      const chunks = [];
      const reader = cs.readable.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(totalLen);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    })(), QR_SYNC_CODEC_TIMEOUT_MS, 'SDP compression');

    return `c.${toBase64Url(compressed)}`;
  } catch {
    // Fallback for browsers where CompressionStream is missing or stalls.
    return `u.${toBase64Url(data)}`;
  }
}

export async function decompressSDP(b64url) {
  if (b64url.length > 50_000) throw new Error('SDP payload too large');
  const [codec, payload = ''] = b64url.includes('.') ? b64url.split(/\.(.+)/, 2) : ['c', b64url];

  if (codec === 'u') {
    const plain = fromBase64Url(payload);
    if (plain.length > MAX_SYNC_PAYLOAD_CHARS) throw new Error('SDP payload too large');
    return new TextDecoder().decode(plain);
  }

  const compressed = fromBase64Url(payload);
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot read compressed sync QR codes.');
  }
  const out = await withTimeout((async () => {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    await writer.write(compressed);
    await writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      const totalLen = chunks.reduce((n, c) => n + c.length, 0);
      if (totalLen > MAX_SYNC_PAYLOAD_CHARS) throw new Error('SDP payload too large');
    }
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    return merged;
  })(), QR_SYNC_CODEC_TIMEOUT_MS, 'SDP decompression');

  return new TextDecoder().decode(out);
}
