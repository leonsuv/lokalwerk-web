/** Dateiarten anhand von MIME-Typ und Endung erkennen. Der MIME-Typ fehlt manchmal
 *  (z. B. bei manchen Downloads unter Windows), deshalb zählt auch die Endung. */

export interface FileLike {
  name: string;
  type: string;
}

export function isPdf(file: FileLike): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImage(file: FileLike): boolean {
  return file.type.startsWith('image/');
}

/** CSV und Text-Export aus Excel („Unicode-Text“ als .txt) */
export function isCsv(file: FileLike): boolean {
  return /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv';
}

/** Tabellen im Binär- oder Container-Format, gelesen mit SheetJS */
export function isWorkbook(file: FileLike): boolean {
  return /\.(xlsx|xls|ods)$/i.test(file.name);
}

export function isSpreadsheet(file: FileLike): boolean {
  return isCsv(file) || isWorkbook(file);
}
