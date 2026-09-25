import { describe, expect, it } from 'vitest';
import {
  describeDrop,
  dropKind,
  type FileKind,
  isCsv,
  isImage,
  isPdf,
  isSpreadsheet,
  isWorkbook,
  toolsForDrop,
} from '../../../src/core/files/classify.ts';

describe('isPdf', () => {
  it.each([
    [{ name: 'a.pdf', type: 'application/pdf' }, true],
    [{ name: 'Rechnung.PDF', type: '' }, true],
    [{ name: 'ohne-endung', type: 'application/pdf' }, true],
    [{ name: 'bild.jpg', type: 'image/jpeg' }, false],
    [{ name: 'pdf.txt', type: 'text/plain' }, false],
  ])('%o → %s', (file, expected) => {
    expect(isPdf(file)).toBe(expected);
  });
});

describe('isImage', () => {
  it.each([
    [{ name: 'a.jpg', type: 'image/jpeg' }, true],
    [{ name: 'a.heic', type: 'image/heic' }, true],
    [{ name: 'a.pdf', type: 'application/pdf' }, false],
    [{ name: 'a.jpg', type: '' }, false],
  ])('%o → %s', (file, expected) => {
    expect(isImage(file)).toBe(expected);
  });
});

describe('Tabellen', () => {
  it.each([
    [{ name: 'liste.csv', type: '' }, true, false],
    [{ name: 'LISTE.CSV', type: 'text/csv' }, true, false],
    [{ name: 'export.txt', type: 'text/plain' }, true, false],
    [{ name: 'daten', type: 'text/csv' }, true, false],
    [{ name: 'liste.xlsx', type: '' }, false, true],
    [{ name: 'alt.xls', type: '' }, false, true],
    [{ name: 'calc.ods', type: '' }, false, true],
    [{ name: 'bild.jpg', type: 'image/jpeg' }, false, false],
  ])('%o: CSV %s, Arbeitsmappe %s', (file, csv, workbook) => {
    expect(isCsv(file)).toBe(csv);
    expect(isWorkbook(file)).toBe(workbook);
    expect(isSpreadsheet(file)).toBe(csv || workbook);
  });
});

describe('dropKind (Ablage auf der Startseite)', () => {
  const f = (name: string, type = '') => ({ name, type });

  it.each([
    [[f('a.pdf', 'application/pdf'), f('b.PDF')], 'pdf', 2],
    [[f('a.jpg', 'image/jpeg'), f('b.png', 'image/png')], 'image', 2],
    [[f('liste.xlsx')], 'spreadsheet', 1],
    [[f('liste.csv', 'text/csv'), f('b.ods')], 'spreadsheet', 2],
  ] as const)('%o → %s', (files, kind, count) => {
    expect(dropKind(files)).toEqual({ ok: true, kind, count });
  });

  it.each([
    [[f('a.pdf', 'application/pdf'), f('b.jpg', 'image/jpeg')]],
    [[f('a.docx')]],
    [[f('a.csv'), f('b.pdf', 'application/pdf')]],
    [[f('a.pdf', 'application/pdf'), f('b.docx')]],
  ])('%o → gemischt oder nicht unterstützt', (files) => {
    expect(dropKind(files)).toEqual({ ok: false, code: 'mixed' });
  });

  it('meldet eine leere Ablage', () => {
    expect(dropKind([])).toEqual({ ok: false, code: 'empty' });
  });
});

describe('toolsForDrop', () => {
  const tools: { id: string; accepts?: { kind: FileKind; multiple: boolean } }[] = [
    { id: 'merge', accepts: { kind: 'pdf', multiple: true } },
    { id: 'split', accepts: { kind: 'pdf', multiple: false } },
    { id: 'sepa', accepts: { kind: 'spreadsheet', multiple: false } },
    { id: 'ohne' },
  ];
  const ids = (kind: FileKind, count: number) => toolsForDrop(tools, kind, count).map((t) => t.id);

  it('nimmt bei einer Datei alle passenden Werkzeuge in Registerreihenfolge', () => {
    expect(ids('pdf', 1)).toEqual(['merge', 'split']);
    expect(ids('spreadsheet', 1)).toEqual(['sepa']);
  });

  it('lässt Werkzeuge für eine einzelne Datei bei mehreren weg', () => {
    expect(ids('pdf', 3)).toEqual(['merge']);
    expect(ids('spreadsheet', 2)).toEqual([]);
  });

  it('findet nichts für Dateiarten ohne Werkzeug', () => {
    expect(ids('image', 1)).toEqual([]);
  });
});

describe('describeDrop', () => {
  it.each([
    ['pdf', 1, '1 PDF'],
    ['pdf', 2, '2 PDFs'],
    ['image', 1, '1 Foto'],
    ['image', 5, '5 Fotos'],
    ['spreadsheet', 1, '1 Tabelle'],
    ['spreadsheet', 2, '2 Tabellen'],
  ] as const)('%s, %i → %s', (kind, count, text) => {
    expect(describeDrop(kind, count)).toBe(text);
  });
});
