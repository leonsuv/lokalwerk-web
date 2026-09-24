/**
 * BIC prüfen (nur das Format). Muster laut Anlage 3 26.11, Kap. 2.3.1.1, S. 253
 * (BICFIDec2014Identifier): [A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3}){0,1}.
 * 8 oder 11 Zeichen (S. 104). Ob es die Bank gibt, lässt sich offline nicht prüfen.
 */

export type BicResult = { ok: true; bic: string } | { ok: false; code: 'invalid-format' };

export function normalizeBic(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function validateBic(input: string): BicResult {
  const bic = normalizeBic(input);
  return /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)
    ? { ok: true, bic }
    : { ok: false, code: 'invalid-format' };
}
