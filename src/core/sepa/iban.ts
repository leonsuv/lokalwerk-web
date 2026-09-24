/**
 * IBAN prüfen: Normalisieren, Land, Länge, Prüfziffer nach ISO 13616 (Modulo 97).
 * Anlage 3 26.11 verlangt „eine gültige IBAN“ (S. 103, 111); das DK-Schema prüft nur das
 * Muster [A-Z]{2}[0-9]{2}[a-zA-Z0-9]{1,30} (Kap. 2.3.1.1, S. 253).
 */

import { EEA_IBAN_LENGTHS, NON_EEA_SEPA_COUNTRIES } from './iban-countries.ts';

export type IbanError =
  | { code: 'empty' }
  | { code: 'invalid-characters' }
  | { code: 'not-sepa'; country: string }
  | { code: 'non-eea'; country: string }
  | { code: 'wrong-length'; country: string; expected: number; actual: number }
  | { code: 'checksum' };

export type IbanResult = { ok: true; iban: string; country: string } | ({ ok: false } & IbanError);

/** Entfernt alle Leerzeichen (auch geschützte) und schreibt Großbuchstaben. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** Modulo 97 über die umgestellte IBAN, stückweise, damit keine großen Zahlen entstehen. */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = Number.parseInt(char, 36); // 0–9 → 0–9, A–Z → 10–35
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder;
}

export function validateIban(input: string): IbanResult {
  const iban = normalizeIban(input);
  if (iban === '') return { ok: false, code: 'empty' };
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(iban))
    return { ok: false, code: 'invalid-characters' };

  const country = iban.slice(0, 2);
  if (NON_EEA_SEPA_COUNTRIES.has(country)) return { ok: false, code: 'non-eea', country };
  const expected = EEA_IBAN_LENGTHS[country];
  if (expected === undefined) return { ok: false, code: 'not-sepa', country };
  if (iban.length !== expected) {
    return { ok: false, code: 'wrong-length', country, expected, actual: iban.length };
  }
  if (mod97(iban) !== 1) return { ok: false, code: 'checksum' };
  return { ok: true, iban, country };
}

/** Für die Anzeige: Vierergruppen „DE89 3704 0044 …“. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}
