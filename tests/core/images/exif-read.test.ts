import { readFileSync } from 'node:fs';
import { parse } from 'exifr/dist/lite.esm.mjs';
import { describe, expect, it } from 'vitest';
import { describeMetadata, formatDms, formatExifDate } from '../../../src/core/images/exif-read.ts';

type Parsed = Parameters<typeof describeMetadata>[0];

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/images/${name}`, import.meta.url)));

const OPTIONS = {
  tiff: true,
  exif: true,
  gps: true,
  xmp: true,
  mergeOutput: false,
  reviveValues: false,
  translateValues: false,
} as const;

describe('formatDms und formatExifDate', () => {
  it('schreibt Koordinaten als Grad, Minuten, Sekunden mit Himmelsrichtung', () => {
    expect(formatDms([52, 30, 58.68], 'N', 'lat')).toBe('52° 30′ 58,68″ N');
    expect(formatDms([13, 22, 39.72], 'W', 'lon')).toBe('13° 22′ 39,72″ W');
    expect(formatDms([13, 22, 39.72], 'E', 'lon')).toBe('13° 22′ 39,72″ O');
    expect(formatDms('Unsinn', 'N', 'lat')).toBeNull();
  });

  it('schreibt Exif-Zeiten deutsch, ohne Zeitzone umzurechnen', () => {
    expect(formatExifDate('2026:09:24 10:00:00')).toBe('24.09.2026, 10:00:00');
    expect(formatExifDate('irgendwas')).toBe('irgendwas');
    expect(formatExifDate(undefined)).toBeNull();
  });
});

describe('describeMetadata mit exifr (Lite) auf echten Dateien', () => {
  it('Testfoto mit GPS und Kamera', async () => {
    const parsed = (await parse(fixture('mit-gps-und-kamera.jpg'), OPTIONS)) as Parsed;
    const report = describeMetadata(parsed);
    expect(report.flags.sort()).toEqual(['camera', 'date', 'gps']);
    const byTitle = Object.fromEntries(report.sections.map((s) => [s.title, s.rows]));
    expect(byTitle['Aufnahmeort']).toEqual([
      { label: 'Breite', value: '52° 30′ 58,68″ N' },
      { label: 'Länge', value: '13° 22′ 39,72″ O' },
    ]);
    expect(byTitle['Kamera']).toEqual([
      { label: 'Hersteller', value: 'Lokalwerk Testkamera' },
      { label: 'Modell', value: 'Modell 1' },
    ]);
    expect(byTitle['Zeit']?.[0]).toEqual({ label: 'Aufgenommen', value: '24.09.2026, 12:00:00' });
  });

  it('Foto ohne Metadaten: keine Abschnitte', async () => {
    const parsed = (await parse(fixture('ohne-metadaten.jpg'), OPTIONS)) as Parsed;
    expect(describeMetadata(parsed)).toEqual({ sections: [], flags: [] });
  });

  it('nennt XMP, IPTC und Kommentare aus der eigenen Prüfung', () => {
    const report = describeMetadata(undefined, { xmp: true, iptc: true, comment: false });
    expect(report.sections.map((s) => s.title)).toEqual(['Weitere Angaben']);
    const rows = report.sections[0]?.rows ?? [];
    expect(rows.map((r) => r.label)).toEqual(['XMP-Daten', 'IPTC-Daten']);
    for (const r of rows) expect(r.value).toMatch(/^vorhanden/);
  });
});
