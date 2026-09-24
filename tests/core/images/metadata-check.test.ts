import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findMetadata } from '../../../src/core/images/metadata-check.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/images/${name}`, import.meta.url)));

/** Kleiner TIFF-Block (little endian) mit IFD0-Einträgen; optional Exif-IFD mit Tags. */
function tiff(ifd0Tags: number[], exifTags: number[] = []): number[] {
  const entries = [...ifd0Tags, ...(exifTags.length ? [0x8769] : [])];
  const ifd0Size = 2 + entries.length * 12 + 4;
  const exifOffset = 8 + ifd0Size;
  const bytes = [0x49, 0x49, 42, 0, 8, 0, 0, 0];
  const u16 = (v: number) => [v & 0xff, v >> 8];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24];
  const entry = (tag: number, value: number) => [...u16(tag), ...u16(4), ...u32(1), ...u32(value)];
  bytes.push(...u16(entries.length));
  for (const tag of entries) bytes.push(...entry(tag, tag === 0x8769 ? exifOffset : 0));
  bytes.push(...u32(0));
  if (exifTags.length) {
    bytes.push(...u16(exifTags.length));
    for (const tag of exifTags) bytes.push(...entry(tag, 0));
    bytes.push(...u32(0));
  }
  return bytes;
}

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const JFIF = segment(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const jpeg = (...segments: number[][]) =>
  new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 0xff, 0xd9]);
const exif = (bytes: number[]) => segment(0xe1, [...ascii('Exif\0\0'), ...bytes]);

function webp(...chunks: [string, number[]][]): Uint8Array {
  const body = chunks.flatMap(([id, data]) => {
    const size = data.length;
    return [...ascii(id), size & 0xff, (size >> 8) & 0xff, 0, 0, ...data, ...(size % 2 ? [0] : [])];
  });
  const total = 4 + body.length;
  return new Uint8Array([
    ...ascii('RIFF'),
    total & 0xff,
    total >> 8,
    0,
    0,
    ...ascii('WEBP'),
    ...body,
  ]);
}

describe('findMetadata mit echten Dateien (macOS ImageIO)', () => {
  it('findet GPS, Kamera und Aufnahmedatum in einem Foto mit diesen Angaben', () => {
    expect(findMetadata(fixture('mit-gps-und-kamera.jpg'))).toEqual(
      expect.arrayContaining(['camera', 'date', 'gps']),
    );
  });

  it('findet in einem Foto ohne diese Angaben weder GPS noch Kamera noch Datum', () => {
    const found = findMetadata(fixture('ohne-metadaten.jpg'));
    expect(found).not.toContain('gps');
    expect(found).not.toContain('camera');
    expect(found).not.toContain('date');
  });
});

describe('findMetadata für JPEG', () => {
  it('meldet nichts bei einem sauberen JPEG, wie es ein Canvas erzeugt', () => {
    expect(findMetadata(jpeg(JFIF))).toEqual([]);
  });

  it('meldet nichts bei harmlosem Exif (nur Ausrichtung und Farbraum)', () => {
    expect(findMetadata(jpeg(JFIF, exif(tiff([0x0112], [0xa001]))))).toEqual([]);
  });

  it.each([
    [[0x8825], [], 'gps'],
    [[0x010f, 0x0110], [], 'camera'],
    [[0x0132], [], 'date'],
    [[0x013b], [], 'author'],
    [[], [0x9003], 'date'],
    [[], [0xa431], 'camera'],
    [[], [0x9286], 'comment'],
  ])('IFD0 %o, Exif-IFD %o → %s', (ifd0, exifIfd, expected) => {
    expect(findMetadata(jpeg(JFIF, exif(tiff(ifd0, exifIfd))))).toEqual([expected]);
  });

  it('meldet XMP, IPTC und Kommentare immer', () => {
    expect(findMetadata(jpeg(segment(0xe1, ascii('http-xmp-daten'))))).toEqual(['xmp']);
    expect(findMetadata(jpeg(segment(0xed, ascii('Photoshop 3.0\0'))))).toEqual(['iptc']);
    expect(findMetadata(jpeg(segment(0xfe, ascii('Hallo'))))).toEqual(['comment']);
  });

  it('meldet beschädigte Strukturen als malformed statt sie durchzulassen', () => {
    expect(findMetadata(jpeg(exif([0x49, 0x49, 42, 0, 0xff, 0xff, 0, 0])))).toEqual(['malformed']);
    expect(findMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00]))).toEqual([
      'malformed',
    ]);
  });
});

describe('findMetadata für WebP', () => {
  const vp8: [string, number[]] = ['VP8 ', [1, 2, 3]];

  it('meldet nichts bei reinen Bilddaten', () => {
    expect(findMetadata(webp(vp8))).toEqual([]);
  });

  it('findet GPS im EXIF-Chunk, auch mit „Exif“-Präfix', () => {
    expect(findMetadata(webp(vp8, ['EXIF', tiff([0x8825])]))).toEqual(['gps']);
    expect(findMetadata(webp(vp8, ['EXIF', [...ascii('Exif\0\0'), ...tiff([0x8825])]]))).toEqual([
      'gps',
    ]);
  });

  it('meldet XMP', () => {
    expect(findMetadata(webp(vp8, ['XMP ', ascii('<x/>')]))).toEqual(['xmp']);
  });
});

describe('findMetadata für andere Formate', () => {
  it('meldet unbekannte Formate', () => {
    expect(findMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual(['unknown-format']);
    expect(findMetadata(new Uint8Array())).toEqual(['unknown-format']);
  });
});
