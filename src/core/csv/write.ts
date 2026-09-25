/**
 * CSV schreiben nach RFC 4180: Felder mit Trennzeichen, Anführungszeichen oder Zeilenumbruch
 * stehen in Anführungszeichen, "" steht für ein Anführungszeichen im Feld, Zeilenende CRLF.
 * Werte werden nicht verändert; auch Felder, die mit = oder + beginnen, bleiben wie sie sind.
 */

import type { Delimiter } from './parse.ts';

function field(value: string, delimiter: Delimiter): string {
  if (value.includes(delimiter) || /["\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: readonly (readonly string[])[], delimiter: Delimiter): string {
  return rows.map((row) => row.map((v) => field(v, delimiter)).join(delimiter)).join('\r\n');
}
