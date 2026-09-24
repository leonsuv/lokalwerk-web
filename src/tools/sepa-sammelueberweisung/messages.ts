/**
 * Meldungen der SEPA-Seite (AGENTS.md Abschnitt 7): sagen, was falsch ist und wie man es behebt.
 */

import { formatEuro } from '../../core/format/money.ts';
import { MAX_CENTS, type AmountError } from '../../core/sepa/amount.ts';
import type { Replacement } from '../../core/sepa/charset.ts';
import { FIELDS, type Field } from '../../core/sepa/columns.ts';
import type { ExecutionDateResult } from '../../core/sepa/dates.ts';
import type { IbanError } from '../../core/sepa/iban.ts';
import type { RowError, RowWarning } from '../../core/sepa/transfers.ts';
import type { ReadResult } from './read-result.ts';

const fieldLabel = (field: Field) => FIELDS.find((f) => f.field === field)?.label ?? field;

export function ibanMessage(error: IbanError): string {
  switch (error.code) {
    case 'empty':
      return 'IBAN fehlt';
    case 'invalid-characters':
      return 'IBAN enthält ungültige Zeichen';
    case 'not-sepa':
      return `Land ${error.country} gehört nicht zum SEPA-Raum`;
    case 'non-eea':
      return `Überweisungen in dieses Land (${error.country}) brauchen zusätzliche Angaben und werden noch nicht unterstützt`;
    case 'wrong-length':
      return `IBAN muss ${error.expected} Zeichen haben, hat ${error.actual}`;
    case 'checksum':
      return 'Prüfziffer stimmt nicht (Tippfehler?)';
  }
}

const AMOUNT: Record<AmountError, string> = {
  empty: 'Betrag fehlt',
  unreadable: 'Betrag nicht lesbar',
  ambiguous: 'Betrag ist nicht eindeutig. Schreib 1.234,00 oder 1,23.',
  'too-many-decimals': 'Betrag hat mehr als zwei Nachkommastellen',
  negative: 'Betrag darf nicht negativ sein',
  zero: 'Betrag muss größer als 0 sein',
  'too-large': `Betrag ist höher als ${formatEuro(MAX_CENTS)}`,
};

export function rowErrorMessage(
  error: RowError,
  who: 'Empfänger' | 'Kontoinhaber' = 'Empfänger',
): string {
  switch (error.code) {
    case 'missing-columns':
      return `Spalte zuordnen: ${error.fields.map(fieldLabel).join(', ')}`;
    case 'name-empty':
      return `${who} fehlt`;
    case 'iban':
      return ibanMessage(error.error);
    case 'amount':
      return AMOUNT[error.error];
    case 'bic-invalid':
      return 'BIC hat ein ungültiges Format';
  }
}

function describeFrom(char: string): string {
  if (char === '\n' || char === '\r') return 'Zeilenumbruch';
  if (char === '\t') return 'Tabulator';
  if (/\p{Cf}/u.test(char)) return 'unsichtbares Zeichen';
  if (/\s/u.test(char)) return 'besonderes Leerzeichen';
  return char;
}

export function replacementsText(replacements: readonly Replacement[]): string {
  return replacements
    .map(({ from, to }) => {
      const label = describeFrom(from);
      if (to === '') return `${label} entfernt`;
      return `${label} → ${to === ' ' ? 'Leerzeichen' : to}`;
    })
    .join(', ');
}

export function rowWarningMessage(warning: RowWarning): string {
  const field = warning.field === 'name' ? 'Name' : 'Verwendungszweck';
  if (warning.code === 'truncated') return `${field} auf ${warning.to} Zeichen gekürzt`;
  return `${field}: ${replacementsText(warning.replacements)}`;
}

export function dateMessage(result: ExecutionDateResult): string | null {
  if (result.ok) {
    return result.warning === 'far-future'
      ? 'Banken müssen Aufträge mit einem Datum mehr als 15 Tage in der Zukunft nicht annehmen.'
      : null;
  }
  switch (result.code) {
    case 'empty':
      return 'Ausführungsdatum fehlt';
    case 'invalid':
      return 'Ausführungsdatum ist ungültig';
    case 'past':
      return 'Ausführungsdatum liegt in der Vergangenheit';
  }
}

export function readErrorMessage(result: Extract<ReadResult, { ok: false }>): string {
  switch (result.code) {
    case 'empty':
      return 'Die Datei ist leer.';
    case 'encrypted':
      return 'Die Datei ist mit einem Passwort geschützt. Speichere sie ohne Passwort und versuch es noch einmal.';
    case 'damaged':
      return 'Die Datei ist beschädigt. Öffne sie in deinem Tabellenprogramm und speichere sie erneut als .xlsx oder .csv.';
    case 'not-spreadsheet':
      return 'Die Datei ist keine Excel- oder ODS-Tabelle. Speichere sie als .xlsx oder .csv.';
    case 'unterminated-quote':
      return `In Zeile ${result.line ?? '?'} fehlt ein schließendes Anführungszeichen. Prüfe die Datei im Tabellenprogramm.`;
    case 'unreadable':
      return 'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.';
  }
}

export const TABLE_MESSAGES = {
  empty: 'Die Datei ist leer.',
  'no-data': 'Die Liste braucht eine Kopfzeile und mindestens eine Überweisung.',
  unsupported: 'Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.',
  single:
    'Manche Banken lehnen Dateien mit nur einer Überweisung ab. Für eine einzelne Überweisung nutzt du besser direkt dein Onlinebanking.',
} as const;
