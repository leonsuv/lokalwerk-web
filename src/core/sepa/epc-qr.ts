/**
 * Nutzdaten für den QR-Code zur Überweisung nach EPC069-12 Version 3.1 („Quick Response Code –
 * Guidelines to Enable the Data Capture for the Initiation of a SEPA Credit Transfer“, gültig
 * seit 19.03.2024), Kap. 2.1 und 2.2. Ohne Rechnungsbezug (plan-phase2.md E1): keine
 * strukturierte Referenz (Creditor Reference) in der Oberfläche.
 *
 * Reihenfolge der Elemente: BCD, Version, Zeichensatz, SCT, BIC, Name, IBAN, Betrag, Purpose,
 * Referenz, Verwendungszweck, Hinweis an den Zahlenden. Getrennt durch LF; nach dem letzten
 * belegten Element folgt nichts. Höchstens 331 Byte, Fehlerkorrektur M, höchstens Version 13.
 */

import { centsToXmlDecimal, MAX_CENTS, MIN_CENTS } from './amount.ts';

export const EPC_MAX_BYTES = 331;
export const EPC_MAX_VERSION = 13;
export const EPC_NAME_MAX = 70;
export const EPC_TEXT_MAX = 140;

export interface EpcFields {
  version: '001' | '002';
  /** 1 = UTF-8, 2 = ISO 8859-1 (Kap. 2.1) */
  charset: 1 | 2;
  bic: string;
  name: string;
  iban: string;
  /** Cent, oder null für „ohne Betrag“ */
  amountCents: number | null;
  purposeCode: string;
  reference: string;
  text: string;
  info: string;
}

/** Betrag wie in den Beispielen aus Kap. 2.3: „EUR12.3“, mindestens eine Nachkommastelle */
export function epcAmount(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
    throw new RangeError(`Betrag außerhalb von 0,01 bis 999.999.999,99: ${cents}`);
  }
  const decimal = centsToXmlDecimal(cents);
  return `EUR${decimal.endsWith('0') ? decimal.slice(0, -1) : decimal}`;
}

export function epcPayload(f: EpcFields): string {
  const elements = [
    'BCD',
    f.version,
    String(f.charset),
    'SCT',
    f.bic,
    f.name,
    f.iban,
    f.amountCents === null ? '' : epcAmount(f.amountCents),
    f.purposeCode,
    f.reference,
    f.text,
    f.info,
  ];
  while (elements.length > 0 && elements.at(-1) === '') elements.pop();
  return elements.join('\n');
}

/** Bytes der Nutzdaten im angegebenen Zeichensatz */
export function epcBytes(payload: string, charset: 1 | 2): number[] {
  if (charset === 1) return [...new TextEncoder().encode(payload)];
  return [...payload].map((c) => {
    const code = c.codePointAt(0) ?? 0;
    if (code > 0xff) throw new RangeError(`Zeichen außerhalb von ISO 8859-1: ${c}`);
    return code;
  });
}
