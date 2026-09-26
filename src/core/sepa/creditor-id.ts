/**
 * Gläubiger-Identifikationsnummer (Creditor Identifier, CI) prüfen.
 *
 * Quelle: EPC262-08 „Creditor Identifier Overview“ Version 12.0 vom 05.10.2025, Kap. 3 und 4:
 * Stellen 1–2 Ländercode, 3–4 Prüfziffer nach ISO 7064 Mod 97-10, 5–7 Geschäftsbereichskennung
 * (Creditor Business Code, sonst „ZZZ“), ab Stelle 8 die nationale Kennung. Die Prüfziffer wird
 * ohne Geschäftsbereichskennung berechnet (Kap. 4). Rechenweg: Kap. 8.1.15 (Malta): nationale
 * Kennung + Ländercode + „00“, Buchstaben als Zahlen, Rest modulo 97, Prüfziffer = 98 − Rest.
 * Deutschland (Kap. 8.1.8): 18 Stellen, die nationale Kennung ist eine laufende Nummer.
 *
 * Geprüft wird nur, ob die Nummer formal stimmt, nicht, ob sie vergeben ist.
 */

import { EEA_IBAN_LENGTHS, NON_EEA_SEPA_COUNTRIES } from './iban-countries.ts';
import { mod97 } from './iban.ts';

export type CreditorIdError =
  | { code: 'empty' }
  | { code: 'format' }
  | { code: 'not-sepa'; country: string }
  | { code: 'length-de'; actual: number }
  | { code: 'national-de' }
  | { code: 'checksum' };

export interface CreditorIdParts {
  id: string;
  country: string;
  checkDigits: string;
  businessCode: string;
  national: string;
}

export type CreditorIdResult = ({ ok: true } & CreditorIdParts) | ({ ok: false } & CreditorIdError);

/** Leerzeichen entfernen, Großbuchstaben */
export function normalizeCreditorId(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** Prüfziffer (zwei Stellen) zu Ländercode und nationaler Kennung */
export function creditorCheckDigits(country: string, national: string): string {
  const remainder = mod97(`${national}${country}00`);
  return String(98 - remainder).padStart(2, '0');
}

export function validateCreditorId(input: string): CreditorIdResult {
  const id = normalizeCreditorId(input);
  if (id === '') return { ok: false, code: 'empty' };
  const match = /^([A-Z]{2})([0-9]{2})([A-Z0-9]{3})([A-Z0-9]{1,28})$/.exec(id);
  if (!match) return { ok: false, code: 'format' };
  const [, country = '', checkDigits = '', businessCode = '', national = ''] = match;
  if (EEA_IBAN_LENGTHS[country] === undefined && !NON_EEA_SEPA_COUNTRIES.has(country)) {
    return { ok: false, code: 'not-sepa', country };
  }
  if (country === 'DE') {
    if (id.length !== 18) return { ok: false, code: 'length-de', actual: id.length };
    if (!/^[0-9]{11}$/.test(national)) return { ok: false, code: 'national-de' };
  }
  if (creditorCheckDigits(country, national) !== checkDigits)
    return { ok: false, code: 'checksum' };
  return { ok: true, id, country, checkDigits, businessCode, national };
}
