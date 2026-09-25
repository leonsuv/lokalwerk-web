/**
 * Schmaler Adapter um SheetJS CE (vendor/README.md): erstes Tabellenblatt einer .xlsx-,
 * .xls- oder .ods-Datei als Zeilen. Zahlen bleiben Zahlen (Beträge), Texte bleiben Texte.
 * Formeln werden nicht ausgewertet, es zählt der gespeicherte Wert.
 */

import { read, utils, type WorkBook, type WorkSheet } from 'xlsx';
import { wallClockFromDate, type SheetValue } from './values.ts';

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

function open(bytes: Uint8Array, cellDates: boolean): WorkBook {
  if (bytes.length === 0) throw new SheetError('empty');
  if (!looksLikeSpreadsheet(bytes)) throw new SheetError('not-spreadsheet');
  try {
    return read(bytes, {
      type: 'array',
      // Wichtig: In Text-Formaten (HTML-/XML-Tabellen als „.xls“) keine Zahlen raten.
      // Sonst liest SheetJS „12,50“ nach englischer Konvention als 1250.
      raw: true,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellDates,
    });
  } catch (error) {
    // SheetJS meldet verschlüsselte Dateien z. B. mit „password-protected“ oder
    // „ECMA-376 Encrypted file …“.
    const message = error instanceof Error ? error.message : String(error);
    if (/password|encrypt/i.test(message)) throw new SheetError('encrypted', { cause: error });
    throw new SheetError('damaged', { cause: error });
  }
}

export function readFirstSheet(bytes: Uint8Array): unknown[][] {
  const workbook = open(bytes, false);
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

export interface SheetData {
  name: string;
  /** Zeilen ab A1 bis zur letzten belegten Zelle; leere Zeilen dazwischen bleiben erhalten */
  rows: SheetValue[][];
}

/**
 * Fehlerwerte, wie sie in der Datei stehen (englische Kürzel, Tabelle BErr in SheetJS nach
 * [MS-XLS] 2.5.10). Excel zeigt sie je nach Sprache anders an, z. B. #NV statt #N/A.
 */
const ERRORS: Record<number, string> = {
  0x00: '#NULL!',
  0x07: '#DIV/0!',
  0x0f: '#VALUE!',
  0x17: '#REF!',
  0x1d: '#NAME?',
  0x24: '#NUM!',
  0x2a: '#N/A',
};

function cellValue(cell: { t: string; v?: unknown } | undefined): SheetValue {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  switch (cell.t) {
    case 'n':
      return typeof cell.v === 'number' ? cell.v : null;
    case 'b':
      return cell.v === true;
    case 'd':
      return cell.v instanceof Date ? wallClockFromDate(cell.v) : null;
    case 'e':
      return typeof cell.v === 'number' ? (ERRORS[cell.v] ?? '#FEHLER') : '#FEHLER';
    default:
      return typeof cell.v === 'string' || typeof cell.v === 'number' ? String(cell.v) : null;
  }
}

/**
 * Alle Tabellenblätter mit Werten, wie sie in den Zellen stehen: Zahlen als Zahl, Datum als
 * Wanduhrzeit, Formeln als gespeichertes Ergebnis. Zellen werden selbst gelesen statt über
 * sheet_to_json, weil das Datumswerte in die Ortszeit des Browsers verschiebt. Wirft
 * SheetError, auch wenn kein Blatt eine belegte Zelle hat.
 */
/**
 * Zeilen eines Blatts ab A1. Nur belegte Zellen werden angesehen: Der Bereich in „!ref“ reicht
 * in manchen Dateien über formatierte, aber leere Zellen bis zur letzten Zeile des Blatts.
 */
export function sheetRows(sheet: WorkSheet): SheetValue[][] {
  const cells: { r: number; c: number; value: SheetValue }[] = [];
  let lastRow = -1;
  let lastColumn = -1;
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue;
    const value = cellValue(sheet[address] as { t: string; v?: unknown });
    if (value === null || value === '') continue;
    const { r, c } = utils.decode_cell(address);
    cells.push({ r, c, value });
    lastRow = Math.max(lastRow, r);
    lastColumn = Math.max(lastColumn, c);
  }
  const rows: SheetValue[][] = Array.from({ length: lastRow + 1 }, () =>
    Array.from<SheetValue>({ length: lastColumn + 1 }).fill(null),
  );
  for (const { r, c, value } of cells) {
    const row = rows[r];
    if (row) row[c] = value;
  }
  return rows;
}

export function readSheets(bytes: Uint8Array): SheetData[] {
  const workbook = open(bytes, true);
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return { name, rows: sheet ? sheetRows(sheet) : [] };
  });
  if (sheets.every((s) => s.rows.length === 0)) throw new SheetError('empty');
  return sheets;
}
