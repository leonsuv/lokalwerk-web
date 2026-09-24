import { describe, expect, it } from 'vitest';
import { detectDelimiter } from '../../../src/core/csv/delimiter.ts';

describe('detectDelimiter', () => {
  it('erkennt Semikolon (Excel deutsch)', () => {
    expect(detectDelimiter('Empfänger;IBAN;Betrag\nAnna;DE89…;1.234,56\nTom;DE41…;30,00')).toBe(
      ';',
    );
  });

  it('erkennt Komma, auch wenn Beträge Kommas in Anführungszeichen enthalten', () => {
    expect(detectDelimiter('Name,IBAN,Betrag\nAnna,DE89,"1.234,56"\nTom,DE41,"30,00"')).toBe(',');
  });

  it('erkennt Tabulator', () => {
    expect(detectDelimiter('Name\tBetrag\nAnna\t12,50\nTom\t3,00')).toBe('\t');
  });

  it('wählt nicht das Komma, das nur in deutschen Beträgen vorkommt', () => {
    expect(detectDelimiter('Name;Betrag\nAnna;12,50\nTom;3,00\nEva;7,25')).toBe(';');
  });

  it('nimmt Semikolon, wenn nur eine Spalte vorhanden ist', () => {
    expect(detectDelimiter('Name\nAnna\nTom')).toBe(';');
  });

  it('kommt mit Zeilenumbrüchen in Anführungszeichen zurecht', () => {
    expect(detectDelimiter('Name;Zweck\nAnna;"Zeile 1\nZeile 2"\nTom;x')).toBe(';');
  });
});
