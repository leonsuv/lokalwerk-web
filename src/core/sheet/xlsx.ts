/**
 * Schmaler Adapter um SheetJS CE (vendor/README.md): erstes Tabellenblatt einer .xlsx-,
 * .xls- oder .ods-Datei als Zeilen. Zahlen bleiben Zahlen (Beträge), Texte bleiben Texte.
 * Formeln werden nicht ausgewertet, es zählt der gespeicherte Wert.
 */

import { read, utils } from 'xlsx';

export type SheetErrorCode = 'empty' | 'encrypted' | 'damaged' | 'not-spreadsheet';

export class SheetError extends Error {
  readonly code: SheetErrorCode;

  constructor(code: SheetErrorCode, options?: ErrorOptions) {
    super(`Tabellen-Fehler: ${code}`, options);
    this.name = 'SheetError';
    this.code = code;
  }
}

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // .xlsx, .ods
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .xls, verschlüsselte .xlsx

/**
 * SheetJS liest auch beliebige Bytes als Text-Tabelle ein (z. B. eine umbenannte PDF).
 * Deshalb nur bekannte Container zulassen: ZIP, OLE, oder Markup (manche Programme
 * speichern „.xls“ als HTML- oder XML-Tabelle).
 */
function looksLikeSpreadsheet(bytes: Uint8Array): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(ZIP) || startsWith(OLE)) return true;
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 512)).replace(/^\uFEFF/, '');
  return /^\s*</.test(head);
}

export function readFirstSheet(bytes: Uint8Array): unknown[][] {
  if (bytes.length === 0) throw new SheetError('empty');
  if (!looksLikeSpreadsheet(bytes)) throw new SheetError('not-spreadsheet');
  let workbook;
  try {
    workbook = read(bytes, {
      type: 'array',
      // Wichtig: In Text-Formaten (HTML-/XML-Tabellen als „.xls“) keine Zahlen raten.
      // Sonst liest SheetJS „12,50“ nach englischer Konvention als 1250.
      raw: true,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellDates: false,
    });
  } catch (error) {
    // SheetJS meldet verschlüsselte Dateien z. B. mit „password-protected“ oder
    // „ECMA-376 Encrypted file …“.
    const message = error instanceof Error ? error.message : String(error);
    if (/password|encrypt/i.test(message)) throw new SheetError('encrypted', { cause: error });
    throw new SheetError('damaged', { cause: error });
  }
  const name = workbook.SheetNames[0];
  const sheet = name === undefined ? undefined : workbook.Sheets[name];
  if (!sheet) throw new SheetError('empty');
  return utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });
}
