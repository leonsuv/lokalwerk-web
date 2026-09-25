/**
 * Web Worker für „Prüfsumme berechnen“. Liest die Datei stückweise und berechnet SHA-256 und
 * SHA-1 gleichzeitig (src/core/hash/sha.ts). Bis 64 MB rechnet zusätzlich WebCrypto
 * (crypto.subtle.digest) nach; weichen die Ergebnisse ab, wird keines angezeigt.
 */

import { createSha1, createSha256, toHex } from '../../core/hash/sha.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export interface HashRequest {
  type: 'hash';
  file: File;
}

export interface HashProgress {
  done: number;
  total: number;
}

export interface HashResult {
  sha256: string;
  sha1: string;
  /** Gegenprobe mit WebCrypto: gemacht und gleich, oder wegen der Größe übersprungen */
  crossCheck: 'ok' | 'skipped';
}

/** Bis zu dieser Größe wird zusätzlich mit WebCrypto gerechnet (braucht die ganze Datei im Speicher). */
export const CROSS_CHECK_LIMIT = 64 * 1024 * 1024;

async function crossCheck(file: File, sha256: string, sha1: string): Promise<'ok' | 'skipped'> {
  if (file.size > CROSS_CHECK_LIMIT || typeof crypto === 'undefined' || !crypto.subtle) {
    return 'skipped';
  }
  const data = await file.arrayBuffer();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', data),
    crypto.subtle.digest('SHA-1', data),
  ]);
  if (toHex(new Uint8Array(a)) !== sha256 || toHex(new Uint8Array(b)) !== sha1) {
    throw new WorkerError('mismatch');
  }
  return 'ok';
}

serveRequests<HashRequest>(async ({ file }, progress) => {
  const sha256 = createSha256();
  const sha1 = createSha1();
  let done = 0;
  let lastReport = 0;
  try {
    const reader = file.stream().getReader();
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      sha256.update(value);
      sha1.update(value);
      done += value.length;
      if (done - lastReport > 4 * 1024 * 1024) {
        lastReport = done;
        progress({ done, total: file.size } satisfies HashProgress);
      }
    }
  } catch {
    throw new WorkerError('unreadable');
  }
  const result = { sha256: toHex(sha256.digest()), sha1: toHex(sha1.digest()) };
  return { result: { ...result, crossCheck: await crossCheck(file, result.sha256, result.sha1) } };
});
