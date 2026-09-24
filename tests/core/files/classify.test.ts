import { describe, expect, it } from 'vitest';
import {
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
