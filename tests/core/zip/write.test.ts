import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  crc32,
  dosDateTime,
  uniqueNames,
  ZipError,
  zipLayout,
  type ZipEntryInfo,
} from '../../../src/core/zip/write.ts';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('crc32', () => {
  it('liefert den Prüfwert aus der Spezifikation für „123456789“', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('stimmt mit zlib überein, auch in Stücken berechnet', () => {
    const data = new Uint8Array(100_000).map((_, i) => (i * 7919) % 251);
    const whole = crc32(data);
    expect(whole).toBe(nodeCrc32(data));
    let parts = 0;
    for (let i = 0; i < data.length; i += 4096) parts = crc32(data.subarray(i, i + 4096), parts);
    expect(parts).toBe(whole);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('dosDateTime', () => {
  it('rechnet Ortszeit in das MS-DOS-Format um, Sekunden in 2er-Schritten', () => {
    const { date, time } = dosDateTime(new Date(2026, 8, 25, 14, 30, 59));
    expect(date).toBe((46 << 9) | (9 << 5) | 25);
    expect(time).toBe((14 << 11) | (30 << 5) | 29);
  });

  it('setzt Daten vor 1980 auf den 1. Januar 1980', () => {
    expect(dosDateTime(new Date(1970, 0, 1))).toEqual({ date: (1 << 5) | 1, time: 0 });
  });
});

describe('uniqueNames', () => {
  it('nummeriert doppelte Namen durch, ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(uniqueNames(['foto.jpg', 'Foto.JPG', 'foto.jpg', 'liste'])).toEqual([
      'foto.jpg',
      'Foto (2).JPG',
      'foto (3).jpg',
      'liste',
    ]);
  });

  it('entfernt Ordner und Steuerzeichen und ersetzt leere Namen', () => {
    expect(uniqueNames(['../a/b.pdf', 'c\\d.pdf', 'x\u0000y.pdf', '  ', 'e:f.txt'])).toEqual([
      '.._a_b.pdf',
      'c_d.pdf',
      'x_y.pdf',
      'datei',
      'e_f.txt',
    ]);
  });
});

/** Setzt ein Archiv zusammen wie src/ui/zip.ts, nur mit Bytes statt Blobs. */
function build(files: { name: string; data: Uint8Array }[], modified = new Date(2026, 8, 25)) {
  const entries: ZipEntryInfo[] = files.map((f) => ({
    name: f.name,
    size: f.data.length,
    crc: crc32(f.data),
    modified,
  }));
  const layout = zipLayout(entries);
  const parts = files.flatMap((f, i) => [layout.localHeaders[i] ?? new Uint8Array(), f.data]);
  parts.push(layout.centralDirectory);
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return { out, layout };
}

/** Kleiner Leser nach APPNOTE 4.3: liest das Archiv über das zentrale Verzeichnis. */
function read(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const files = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const flags = v.getUint16(at + 8, true);
    const method = v.getUint16(at + 10, true);
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 24, true);
    const nameLength = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const localNameLength = v.getUint16(local + 26, true);
    const start = local + 30 + localNameLength + v.getUint16(local + 28, true);
    const data = zip.subarray(start, start + size);
    files.push({ name, flags, method, crc, data });
    at += 46 + nameLength;
  }
  return files;
}

describe('zipLayout', () => {
  it('ergibt ein lesbares Archiv mit Namen, Inhalten und Prüfsummen', () => {
    const files = [
      { name: 'Straße-klein.jpg', data: bytes('Bilddaten ä') },
      { name: 'leer.txt', data: new Uint8Array(0) },
      { name: 'b.pdf', data: new Uint8Array(5000).fill(7) },
    ];
    const { out, layout } = build(files);
    expect(layout.totalSize).toBe(out.length);
    const read_ = read(out);
    expect(read_.map((f) => f.name)).toEqual(files.map((f) => f.name));
    for (const [i, f] of read_.entries()) {
      expect(f.method).toBe(0);
      expect(f.flags & 0x0800).toBe(0x0800);
      expect(f.data).toEqual(files[i]?.data);
      expect(f.crc).toBe(nodeCrc32(f.data));
    }
  });

  it('lehnt leere Listen, zu viele und zu große Dateien ab', () => {
    const entry = (size: number): ZipEntryInfo => ({
      name: 'a',
      size,
      crc: 0,
      modified: new Date(),
    });
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof ZipError ? error.code : 'anderer Fehler';
      }
      return 'kein Fehler';
    };
    expect(code(() => zipLayout([]))).toBe('empty');
    expect(code(() => zipLayout(Array.from({ length: 65_536 }, () => entry(0))))).toBe('too-many');
    expect(code(() => zipLayout([entry(0xffffffff + 1)]))).toBe('too-large');
    expect(code(() => zipLayout([entry(3_000_000_000), entry(2_000_000_000)]))).toBe('too-large');
  });
});
