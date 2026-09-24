import { describe, expect, it } from 'vitest';
import {
  classifyDrop,
  isCsv,
  isImage,
  isPdf,
  isSpreadsheet,
  isWorkbook,
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

describe('classifyDrop (Ablage auf der Startseite)', () => {
  const f = (name: string, type = '') => ({ name, type });

  it.each([
    [[f('a.pdf', 'application/pdf'), f('b.PDF')], 'pdf'],
    [[f('a.jpg', 'image/jpeg'), f('b.png', 'image/png')], 'images'],
    [[f('liste.xlsx')], 'sepa'],
    [[f('liste.csv', 'text/csv')], 'sepa'],
  ] as const)('%o → %s', (files, target) => {
    expect(classifyDrop(files)).toEqual({ ok: true, target });
  });

  it.each([
    [[f('a.pdf', 'application/pdf'), f('b.jpg', 'image/jpeg')]],
    [[f('a.csv'), f('b.csv')]],
    [[f('a.docx')]],
    [[f('a.csv'), f('b.pdf', 'application/pdf')]],
  ])('%o → gemischt oder nicht unterstützt', (files) => {
    expect(classifyDrop(files)).toEqual({ ok: false, code: 'mixed' });
  });

  it('meldet eine leere Ablage', () => {
    expect(classifyDrop([])).toEqual({ ok: false, code: 'empty' });
  });
});
