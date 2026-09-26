/**
 * IBANs einer Liste prüfen (plan-phase2.md Werkzeug 16, Entscheidung E9: vorerst ohne Bankdaten).
 * Die Bankdaten kommen später über `lookup` dazu (Bankleitzahlendatei der Bundesbank), ohne dass
 * sich die Prüfung ändert.
 *
 * SEPA-Länder außerhalb des EWR: Prüfziffer wird geprüft, die Länge nicht, weil die Längen noch
 * nicht gegen die SWIFT IBAN Registry abgeglichen sind (plan.md O4, iban-countries.ts).
 */

import { formatIban, mod97, normalizeIban, validateIban, type IbanError } from './iban.ts';

export interface BankInfo {
  name: string;
  bic: string;
}

/** Bankname und BIC zu einer gültigen IBAN, oder null (heute: keine Daten) */
export type BankLookup = (iban: string) => BankInfo | null;

export type IbanCheck =
  | { status: 'ok'; iban: string; formatted: string; country: string; bank: BankInfo | null }
  | { status: 'empty' }
  | { status: 'non-eea'; country: string; formatted: string; checksumOk: boolean }
  | ({ status: 'error' } & Exclude<IbanError, { code: 'empty' } | { code: 'non-eea' }>);

export function checkIbanValue(value: string, lookup?: BankLookup): IbanCheck {
  const result = validateIban(value);
  if (result.ok) {
    return {
      status: 'ok',
      iban: result.iban,
      formatted: formatIban(result.iban),
      country: result.country,
      bank: lookup?.(result.iban) ?? null,
    };
  }
  if (result.code === 'empty') return { status: 'empty' };
  if (result.code === 'non-eea') {
    const iban = normalizeIban(value);
    return {
      status: 'non-eea',
      country: result.country,
      formatted: formatIban(iban),
      checksumOk: mod97(iban.slice(4) + iban.slice(0, 4)) === 1,
    };
  }
  const { ok: _ok, ...error } = result;
  return { status: 'error', ...error };
}

export interface ListSummary {
  ok: number;
  errors: number;
  nonEea: number;
  empty: number;
  /** Dieselbe IBAN mehrfach (nur gültige), Zeilen je IBAN ab 0 */
  repeated: Map<string, number[]>;
}

export function summarize(checks: readonly IbanCheck[]): ListSummary {
  const seen = new Map<string, number[]>();
  const summary: ListSummary = { ok: 0, errors: 0, nonEea: 0, empty: 0, repeated: new Map() };
  checks.forEach((c, i) => {
    if (c.status === 'ok') {
      summary.ok++;
      seen.set(c.iban, [...(seen.get(c.iban) ?? []), i]);
    } else if (c.status === 'error') summary.errors++;
    else if (c.status === 'non-eea') summary.nonEea++;
    else summary.empty++;
  });
  for (const [iban, rows] of seen) if (rows.length > 1) summary.repeated.set(iban, rows);
  return summary;
}
