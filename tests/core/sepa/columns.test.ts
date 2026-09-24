import { describe, expect, it } from 'vitest';
import { guessColumns, missingRequiredFields } from '../../../src/core/sepa/columns.ts';

describe('guessColumns', () => {
  it('erkennt die Spalten der Beispieldaten aus dem Prototyp', () => {
    expect(guessColumns(['Empfänger', 'IBAN', 'Betrag', 'Verwendungszweck'])).toEqual({
      name: 0,
      iban: 1,
      amount: 2,
      purpose: 3,
      bic: -1,
    });
  });

  it('ordnet „IBAN des Empfängers“ der IBAN zu, nicht dem Namen', () => {
    expect(guessColumns(['Empfänger', 'IBAN des Empfängers', 'Betrag in EUR'])).toMatchObject({
      name: 0,
      iban: 1,
      amount: 2,
    });
  });

  it('erkennt weitere übliche Überschriften', () => {
    expect(
      guessColumns(['Kontoinhaber', 'Kontonummer (IBAN)', 'BIC/SWIFT', 'Summe', 'Betreff']),
    ).toEqual({
      name: 0,
      iban: 1,
      bic: 2,
      amount: 3,
      purpose: 4,
    });
  });

  it('verwendet jede Spalte höchstens einmal', () => {
    const mapping = guessColumns(['Name', 'Name']);
    expect(mapping.name).toBe(0);
    expect(Object.values(mapping).filter((i) => i === 1)).toHaveLength(0);
  });

  it('meldet fehlende Pflichtspalten', () => {
    const mapping = guessColumns(['Name', 'Notiz']);
    expect(missingRequiredFields(mapping)).toEqual(['iban', 'amount']);
  });
});
