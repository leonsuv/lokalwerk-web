import { describe, expect, it } from 'vitest';
import {
  findDuplicates,
  groupNumbers,
  normalizeValue,
} from '../../../src/core/table/duplicates.ts';

describe('normalizeValue', () => {
  it.each([
    ['  Müller ', 'mueller'],
    ['MUELLER', 'mueller'],
    ['Straße', 'strasse'],
    ['René', 'rene'],
    ['Anna   Maria', 'anna maria'],
    ['DE89 3704 0044 0532 0130 00', 'de89370400440532013000'],
    ['de89370400440532013000', 'de89370400440532013000'],
    ['Hauptstr. 1', 'hauptstr. 1'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeValue(input)).toBe(expected);
  });

  it('macht keine unscharfen Treffer', () => {
    expect(normalizeValue('Meier')).not.toBe(normalizeValue('Maier'));
    expect(normalizeValue('Anna Maria')).not.toBe(normalizeValue('AnnaMaria'));
  });
});

describe('findDuplicates', () => {
  const rows = [
    ['Jürgen Groß', 'j.gross@example.org', 'Köln'],
    ['Anna Beispiel', 'anna@example.org', 'Bonn'],
    ['JUERGEN GROSS', 'J.Gross@example.org ', 'Koeln'],
    ['Anna Beispiel', 'anna.b@example.org', 'Bonn'],
    ['', '', ''],
    ['', '', ''],
    ['Jürgen Groß', 'j.gross@example.org', 'Köln'],
  ];

  it('findet Gruppen über alle gewählten Spalten, in Reihenfolge der Datei', () => {
    expect(findDuplicates(rows, [0, 1, 2])).toEqual([{ rows: [0, 2, 6] }]);
    expect(findDuplicates(rows, [0])).toEqual([{ rows: [0, 2, 6] }, { rows: [1, 3] }]);
  });

  it('übergeht leere Zeilen und liefert ohne Spalten nichts', () => {
    expect(findDuplicates(rows, [2]).flatMap((g) => g.rows)).not.toContain(4);
    expect(findDuplicates(rows, [])).toEqual([]);
  });

  it('nummeriert Gruppen je Zeile, löscht nichts', () => {
    const groups = findDuplicates(rows, [0]);
    expect(groupNumbers(rows.length, groups)).toEqual([1, 2, 1, 2, 0, 0, 1]);
    expect(rows).toHaveLength(7);
  });
});
