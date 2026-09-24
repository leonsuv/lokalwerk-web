/**
 * Länder im SEPA-Raum und IBAN-Längen.
 *
 * Länder: EPC409-09 „EPC List of SEPA Scheme Countries“ v8.0 vom 24.12.2025, Kap. 2 und 5.
 * Nur EU/EWR-Länder werden in Phase 1 unterstützt (plan.md S4). Länder außerhalb des EWR
 * brauchen Adressangaben und werden mit Hinweis ausgeschlossen; Gibraltar ebenso (plan.md O5).
 *
 * OFFEN (plan.md O4): Die IBAN-Längen stammen aus dem Prototyp und sind noch nicht gegen die
 * SWIFT IBAN Registry geprüft. Sobald `.local-specs/swift/iban-registry.txt` vorliegt, werden
 * sie abgeglichen (docs/lokale-spezifikationen.md) und dieser Hinweis entfernt.
 */

/** EU/EWR-Länder im SEPA-Raum (30) mit IBAN-Länge. */
export const EEA_IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AT: 20,
  BE: 16,
  BG: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  EE: 20,
  ES: 24,
  FI: 18,
  FR: 27,
  GR: 27,
  HR: 21,
  HU: 28,
  IE: 22,
  IS: 26,
  IT: 27,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MT: 31,
  NL: 18,
  NO: 15,
  PL: 28,
  PT: 25,
  RO: 24,
  SE: 24,
  SI: 19,
  SK: 24,
};

/**
 * SEPA-Länder außerhalb des EWR (EPC409-09 v8.0, Kap. 2) sowie Gibraltar (plan.md O5).
 * Guernsey, Jersey und die Isle of Man nutzen GB-IBANs und sind damit abgedeckt.
 */
export const NON_EEA_SEPA_COUNTRIES: ReadonlySet<string> = new Set([
  'AD',
  'AL',
  'CH',
  'GB',
  'GI',
  'MC',
  'MD',
  'ME',
  'MK',
  'RS',
  'SM',
  'VA',
]);
