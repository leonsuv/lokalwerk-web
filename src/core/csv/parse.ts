/**
 * CSV nach RFC 4180 zerlegen: Felder in Anführungszeichen, "" als Anführungszeichen im Feld,
 * Zeilenumbrüche (LF, CRLF, CR) auch innerhalb von Anführungszeichen.
 * Die Excel-Kennzeichnung „sep=;“ in der ersten Zeile wird erkannt und entfernt.
 */

export type Delimiter = ';' | ',' | '\t';

export class CsvError extends Error {
  readonly code: 'unterminated-quote';
  readonly line: number;

  constructor(code: 'unterminated-quote', line: number) {
    super(`CSV-Fehler ${code} in Zeile ${line}`);
    this.name = 'CsvError';
    this.code = code;
    this.line = line;
  }
}

export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  let line = 1;
  let quoteStartLine = 1;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (char === '\n') line++;
        field += char;
      }
      continue;
    }
    if (char === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
      quoteStartLine = line;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (quoted) throw new CsvError('unterminated-quote', quoteStartLine);
  // Letzte Zeile ohne abschließenden Zeilenumbruch
  if (field !== '' || row.length > 0 || fieldStarted) endRow();
  return rows;
}

/** Erkennt Excels „sep=;“-Zeile. Gibt das Trennzeichen und den Rest des Texts zurück. */
export function stripSepHint(text: string): { delimiter: Delimiter | null; text: string } {
  const match = /^sep=(.)\r?\n/i.exec(text);
  if (!match) return { delimiter: null, text };
  const sep = match[1];
  const delimiter = sep === ';' || sep === ',' || sep === '\t' ? sep : null;
  return { delimiter, text: text.slice(match[0].length) };
}
