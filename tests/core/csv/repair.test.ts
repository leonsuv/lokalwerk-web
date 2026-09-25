import { describe, expect, it } from 'vitest';
import {
  analyzeRepairs,
  applyRepairs,
  irregularRows,
  looksDoubleEncoded,
  repairText,
} from '../../../src/core/csv/repair.ts';

/** So entsteht der Fehler: UTF-8-Bytes als Windows-1252 gelesen */
const mangle = (text: string) =>
  new TextDecoder('windows-1252').decode(new TextEncoder().encode(text));

describe('repairText', () => {
  it.each(['Müller', 'Straße', 'ÄÖÜäöüß', 'Café', '12,50 €', 'Zoë Mäder', 'Łódź'])(
    'repariert „%s“ nach doppelter Kodierung',
    (original) => {
      const broken = mangle(original);
      expect(broken).not.toBe(original);
      expect(repairText(broken)).toBe(original);
    },
  );

  it('zeigt das bekannte Muster', () => {
    expect(mangle('ä')).toBe('Ã¤');
    expect(repairText('MÃ¼ller')).toBe('Müller');
  });

  it.each([
    ['Müller', 'richtiger Text'],
    ['ASCII only', 'nur ASCII'],
    ['SÃO PAULO', 'Ã ohne Folgezeichen'],
    ['Ã¤ und ä gemischt', 'teils kaputt, teils richtig: nicht eindeutig'],
    ['Ã¤ 😀', 'Zeichen außerhalb von Windows-1252'],
    ['', 'leer'],
  ])('lässt „%s“ unverändert (%s)', (text) => {
    expect(repairText(text)).toBeNull();
  });

  it('erkennt das Muster auch dort, wo die Reparatur nicht eindeutig ist', () => {
    expect(looksDoubleEncoded('Ã¤ und ä gemischt')).toBe(true);
    expect(looksDoubleEncoded('Müller')).toBe(false);
  });
});

describe('analyzeRepairs und applyRepairs', () => {
  const rows = [
    ['Name', 'Ort'],
    [mangle('Jürgen'), 'Köln'],
    ['Ã¤ und ä', mangle('Düsseldorf')],
  ];

  it('listet jede Änderung mit Zeile und Spalte und meldet unsichere Zellen', () => {
    const { changes, unsure } = analyzeRepairs(rows);
    expect(changes).toEqual([
      { row: 2, column: 1, before: 'JÃ¼rgen', after: 'Jürgen' },
      { row: 3, column: 2, before: 'DÃ¼sseldorf', after: 'Düsseldorf' },
    ]);
    expect(unsure).toEqual([{ row: 3, column: 1, before: 'Ã¤ und ä' }]);
  });

  it('wendet genau die gelisteten Änderungen an', () => {
    const { changes } = analyzeRepairs(rows);
    expect(applyRepairs(rows, changes)).toEqual([
      ['Name', 'Ort'],
      ['Jürgen', 'Köln'],
      ['Ã¤ und ä', 'Düsseldorf'],
    ]);
    expect(rows[1]?.[0]).toBe('JÃ¼rgen');
  });
});

describe('irregularRows', () => {
  it('findet Zeilen mit abweichender Spaltenzahl', () => {
    expect(irregularRows([['a', 'b'], ['1', '2'], ['3'], ['4', '5', '6'], ['7', '8']])).toEqual({
      expected: 2,
      rows: [3, 4],
    });
  });
});
