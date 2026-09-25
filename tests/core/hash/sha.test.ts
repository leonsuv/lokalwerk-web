import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createSha1,
  createSha256,
  parseExpectedHash,
  SHA1_H0,
  SHA1_K,
  SHA256_H0,
  SHA256_K,
  toHex,
  type Hasher,
} from '../../../src/core/hash/sha.ts';

/** NIST CAVP .rsp lesen (tests/fixtures/SOURCES.md): Len (Bit), Msg (hex), MD (hex). */
function vectors(name: string): { len: number; msg: Uint8Array; md: string }[] {
  const text = readFileSync(new URL(`../../fixtures/nist/${name}`, import.meta.url), 'utf8');
  const out = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const len = /Len = (\d+)/.exec(block)?.[1];
    const msg = /Msg = ([0-9a-f]+)/.exec(block)?.[1];
    const md = /MD = ([0-9a-f]+)/.exec(block)?.[1];
    if (len === undefined || msg === undefined || md === undefined) continue;
    const bytes = Number(len) / 8;
    out.push({
      len: Number(len),
      msg: Uint8Array.from({ length: bytes }, (_, i) => parseInt(msg.slice(i * 2, i * 2 + 2), 16)),
      md,
    });
  }
  return out;
}

const hash = (create: () => Hasher, data: Uint8Array, chunk = data.length || 1) => {
  const h = create();
  for (let i = 0; i < data.length; i += chunk) h.update(data.subarray(i, i + chunk));
  return toHex(h.digest());
};

describe('Konstanten nach FIPS 180-4, unabhängig nachgerechnet', () => {
  const primes = (n: number) => {
    const out: bigint[] = [];
    for (let k = 2n; out.length < n; k++) if (out.every((p) => k % p !== 0n)) out.push(k);
    return out;
  };
  /** Ganzzahlige r-te Wurzel (abgerundet) mit BigInt, per Bisektion */
  const iroot = (x: bigint, r: bigint) => {
    let lo = 0n;
    let hi = 1n << 128n;
    while (lo < hi) {
      const mid = (lo + hi + 1n) / 2n;
      if (mid ** r <= x) lo = mid;
      else hi = mid - 1n;
    }
    return lo;
  };
  /** Erste 32 Bit der Nachkommastellen der r-ten Wurzel von p */
  const frac32 = (p: bigint, r: bigint) => Number(iroot(p << (32n * r), r) & 0xffffffffn);

  it('SHA-256 K: Kubikwurzeln der ersten 64 Primzahlen', () => {
    expect([...SHA256_K]).toEqual(primes(64).map((p) => frac32(p, 3n)));
  });

  it('SHA-256 H(0): Quadratwurzeln der ersten 8 Primzahlen', () => {
    expect([...SHA256_H0]).toEqual(primes(8).map((p) => frac32(p, 2n)));
  });

  it('SHA-1 K und H(0) wie in FIPS 180-4, 4.2.1 und 5.3.1', () => {
    expect([...SHA1_K].map((k) => k.toString(16))).toEqual([
      '5a827999',
      '6ed9eba1',
      '8f1bbcdc',
      'ca62c1d6',
    ]);
    expect([...SHA1_H0].map((k) => k.toString(16))).toEqual([
      '67452301',
      'efcdab89',
      '98badcfe',
      '10325476',
      'c3d2e1f0',
    ]);
  });
});

describe.each([
  ['SHA-256', createSha256, 'SHA256'],
  ['SHA-1', createSha1, 'SHA1'],
] as const)('%s', (_name, create, prefix) => {
  for (const file of ['ShortMsg', 'LongMsg']) {
    const list = vectors(`${prefix}${file}.rsp`);
    it(`erfüllt alle ${list.length} NIST-Prüfvektoren aus ${prefix}${file}.rsp`, () => {
      expect(list.length).toBeGreaterThan(60);
      for (const v of list) expect(hash(create, v.msg), `Len = ${v.len}`).toBe(v.md);
    });
  }

  it('liefert dasselbe, egal wie die Daten in Stücke geteilt werden', () => {
    const data = Uint8Array.from({ length: 1000 }, (_, i) => (i * 31) % 256);
    const whole = hash(create, data);
    for (const chunk of [1, 3, 55, 56, 63, 64, 65, 127, 999])
      expect(hash(create, data, chunk)).toBe(whole);
  });
});

describe('Gegenprobe mit WebCrypto', () => {
  it('stimmt für viele Längen um die Blockgrenzen und große Daten überein', async () => {
    const lengths = [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 65_536, 3_000_001];
    for (const n of lengths) {
      const data = new Uint8Array(n);
      for (let i = 0; i < n; i += 65_536) webcrypto.getRandomValues(data.subarray(i, i + 65_536));
      for (const [name, create] of [
        ['SHA-256', createSha256],
        ['SHA-1', createSha1],
      ] as const) {
        const expected = toHex(new Uint8Array(await webcrypto.subtle.digest(name, data)));
        expect(hash(create, data, 65_536), `${name}, ${n} Byte`).toBe(expected);
      }
    }
  });

  it('stimmt auch mit Node (OpenSSL) überein', () => {
    const data = new TextEncoder().encode('Lokalwerk – Prüfsumme');
    expect(hash(createSha256, data)).toBe(createHash('sha256').update(data).digest('hex'));
    expect(hash(createSha1, data)).toBe(createHash('sha1').update(data).digest('hex'));
  });

  it('lässt nach digest keine weiteren Daten zu', () => {
    const h = createSha256();
    h.digest();
    expect(() => h.update(new Uint8Array(1))).toThrow();
  });
});

describe('parseExpectedHash', () => {
  const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const sha1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
  it.each([
    [sha256, 'SHA-256', sha256],
    [sha256.toUpperCase(), 'SHA-256', sha256],
    [`  ${sha256}  lokalwerk.iso`, 'SHA-256', sha256],
    [`SHA256 (lokalwerk.iso) = ${sha256}`, 'SHA-256', sha256],
    [sha256.replace(/(.{8})/g, '$1 '), 'SHA-256', sha256],
    [sha1, 'SHA-1', sha1],
  ] as const)('%s → %s', (input, algorithm, hex) => {
    expect(parseExpectedHash(input)).toEqual({ algorithm, hex });
  });

  it.each(['', 'abc', sha256.slice(0, 63), 'md5: d41d8cd98f00b204e9800998ecf8427e'])(
    '„%s“ ist keine SHA-Prüfsumme',
    (input) => {
      expect(parseExpectedHash(input)).toBeNull();
    },
  );
});
