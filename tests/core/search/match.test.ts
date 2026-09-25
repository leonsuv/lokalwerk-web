import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeQuery, searchText } from '../../../src/core/search/match.ts';

describe('normalizeQuery', () => {
  it.each([
    ['PDF zusammenfügen', 'pdf zusammenfuegen'],
    ['  Größe   ändern ', 'groesse aendern'],
    ['Excel-→CSV', 'excel csv'],
    ['Straße', 'strasse'],
    ['Café crème', 'cafe creme'],
    ['pain.001', 'pain 001'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeQuery(input)).toBe(expected);
  });
});

describe('searchText', () => {
  it('enthält jede Angabe mit ausgeschriebenen und vereinfachten Umlauten, ohne Dopplungen', () => {
    expect(searchText(['PDFs zusammenfügen', 'PDF'])).toBe('pdfs zusammenfuegen zusammenfugen pdf');
  });
});

describe('matchesQuery', () => {
  const text = searchText([
    'PDFs zusammenfügen',
    'Mehrere PDFs zu einer Datei verbinden.',
    'merge',
  ]);

  it.each([
    'pdf',
    'PDF zusammenfügen',
    'zusammenfuegen',
    'zusammenfugen',
    'ZUSAMMEN',
    'verbinden pdf',
    'merge',
    '',
    '   ',
  ])('„%s“ trifft', (query) => {
    expect(matchesQuery(query, text)).toBe(true);
  });

  it.each(['foto', 'pdf foto', 'teilen'])('„%s“ trifft nicht', (query) => {
    expect(matchesQuery(query, text)).toBe(false);
  });
});
