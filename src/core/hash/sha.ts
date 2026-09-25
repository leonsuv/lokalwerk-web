/**
 * SHA-256 und SHA-1 nach FIPS 180-4 (NIST, „Secure Hash Standard“, August 2015), schrittweise:
 * Daten kommen in beliebig großen Stücken, damit auch Dateien mit mehreren hundert MB nicht
 * ganz im Speicher liegen müssen. WebCrypto (crypto.subtle.digest) kann das nicht.
 *
 * Geprüft gegen die NIST-Prüfvektoren (CAVP, tests/fixtures/nist/) und gegen WebCrypto.
 * SHA-1 gilt als unsicher gegen gezielte Kollisionen; es wird nur zum Vergleich mit alten
 * Angaben angeboten.
 */

export interface Hasher {
  update(data: Uint8Array): void;
  /** Schließt ab; danach darf update nicht mehr aufgerufen werden. */
  digest(): Uint8Array;
}

/** FIPS 180-4, 4.2.2: die ersten 32 Bit der Nachkommastellen der Kubikwurzeln der ersten 64 Primzahlen */
export const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** FIPS 180-4, 5.3.3: die ersten 32 Bit der Nachkommastellen der Quadratwurzeln der ersten 8 Primzahlen */
export const SHA256_H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** FIPS 180-4, 4.2.1 und 5.3.1 */
export const SHA1_K = new Uint32Array([0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6]);
export const SHA1_H0 = new Uint32Array([
  0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

/**
 * Gemeinsamer Rahmen: 512-Bit-Blöcke, Auffüllen nach FIPS 180-4, 5.1.1 (eine 1, Nullen,
 * Länge in Bit als 64-Bit-Zahl, Big Endian).
 */
function blockHasher(
  state: Uint32Array,
  compress: (state: Uint32Array, block: Uint8Array, offset: number) => void,
): Hasher {
  const buffer = new Uint8Array(64);
  let buffered = 0;
  let total = 0;
  let done = false;

  const update = (data: Uint8Array) => {
    if (done) throw new Error('digest wurde schon aufgerufen');
    total += data.length;
    let i = 0;
    if (buffered > 0) {
      const take = Math.min(64 - buffered, data.length);
      buffer.set(data.subarray(0, take), buffered);
      buffered += take;
      i = take;
      if (buffered < 64) return;
      compress(state, buffer, 0);
      buffered = 0;
    }
    for (; i + 64 <= data.length; i += 64) compress(state, data, i);
    buffer.set(data.subarray(i), 0);
    buffered = data.length - i;
  };

  const digest = () => {
    if (done) throw new Error('digest wurde schon aufgerufen');
    done = true;
    const pad = new Uint8Array((buffered < 56 ? 64 : 128) - buffered);
    pad[0] = 0x80;
    const view = new DataView(pad.buffer);
    // Länge in Bit: total · 8, aufgeteilt in obere und untere 32 Bit
    view.setUint32(pad.length - 8, Math.floor(total / 0x20000000));
    view.setUint32(pad.length - 4, (total % 0x20000000) * 8);
    const tail = new Uint8Array(buffered + pad.length);
    tail.set(buffer.subarray(0, buffered));
    tail.set(pad, buffered);
    for (let i = 0; i < tail.length; i += 64) compress(state, tail, i);
    const out = new Uint8Array(state.length * 4);
    const outView = new DataView(out.buffer);
    state.forEach((word, i) => outView.setUint32(i * 4, word));
    return out;
  };

  return { update, digest };
}

export function createSha256(): Hasher {
  const w = new Uint32Array(64);
  return blockHasher(new Uint32Array(SHA256_H0), (h, block, offset) => {
    for (let t = 0; t < 16; t++) {
      const j = offset + t * 4;
      w[t] =
        ((block[j] ?? 0) << 24) |
        ((block[j + 1] ?? 0) << 16) |
        ((block[j + 2] ?? 0) << 8) |
        (block[j + 3] ?? 0);
    }
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15] ?? 0;
      const w2 = w[t - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = (w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]].map(
      (x) => x ?? 0,
    ) as [number, number, number, number, number, number, number, number];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (SHA256_K[t] ?? 0) + (w[t] ?? 0)) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] ?? 0) + a;
    h[1] = (h[1] ?? 0) + b;
    h[2] = (h[2] ?? 0) + c;
    h[3] = (h[3] ?? 0) + d;
    h[4] = (h[4] ?? 0) + e;
    h[5] = (h[5] ?? 0) + f;
    h[6] = (h[6] ?? 0) + g;
    h[7] = (h[7] ?? 0) + hh;
  });
}

export function createSha1(): Hasher {
  const w = new Uint32Array(80);
  return blockHasher(new Uint32Array(SHA1_H0), (h, block, offset) => {
    for (let t = 0; t < 16; t++) {
      const j = offset + t * 4;
      w[t] =
        ((block[j] ?? 0) << 24) |
        ((block[j + 1] ?? 0) << 16) |
        ((block[j + 2] ?? 0) << 8) |
        (block[j + 3] ?? 0);
    }
    for (let t = 16; t < 80; t++) {
      w[t] = rotl((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0), 1);
    }
    let [a, b, c, d, e] = [h[0], h[1], h[2], h[3], h[4]].map((x) => x ?? 0) as [
      number,
      number,
      number,
      number,
      number,
    ];
    for (let t = 0; t < 80; t++) {
      let f: number;
      if (t < 20) f = (b & c) ^ (~b & d);
      else if (t < 40 || t >= 60) f = b ^ c ^ d;
      else f = (b & c) ^ (b & d) ^ (c & d);
      const temp = (rotl(a, 5) + f + e + (SHA1_K[Math.floor(t / 20)] ?? 0) + (w[t] ?? 0)) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h[0] = (h[0] ?? 0) + a;
    h[1] = (h[1] ?? 0) + b;
    h[2] = (h[2] ?? 0) + c;
    h[3] = (h[3] ?? 0) + d;
    h[4] = (h[4] ?? 0) + e;
  });
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type HashAlgorithm = 'SHA-256' | 'SHA-1';

/** Hex-Längen der Verfahren, um eine eingefügte Prüfsumme zuzuordnen */
export const HEX_LENGTH: Record<HashAlgorithm, number> = { 'SHA-256': 64, 'SHA-1': 40 };

/**
 * Eingefügte Prüfsumme lesen: Leerzeichen und Groß-/Kleinschreibung zählen nicht, auch Formen
 * wie „SHA256 (datei.iso) = 3a7b…“ oder „3a7b…  datei.iso“ werden erkannt. Gibt die erste
 * Folge aus 40 oder 64 Hex-Zeichen zurück, sonst null.
 */
export function parseExpectedHash(input: string): { algorithm: HashAlgorithm; hex: string } | null {
  for (const token of input.toLowerCase().split(/[^0-9a-f]+/)) {
    if (token.length === 64) return { algorithm: 'SHA-256', hex: token };
    if (token.length === 40) return { algorithm: 'SHA-1', hex: token };
  }
  // Prüfsumme mit Leerzeichen in Gruppen („3a7b 91c0 …“)
  const joined = input.toLowerCase().replace(/\s+/g, '');
  if (/^[0-9a-f]{64}$/.test(joined)) return { algorithm: 'SHA-256', hex: joined };
  if (/^[0-9a-f]{40}$/.test(joined)) return { algorithm: 'SHA-1', hex: joined };
  return null;
}
