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

export type DropTarget = 'pdf' | 'images' | 'sepa';
export type DropResult = { ok: true; target: DropTarget } | { ok: false; code: 'empty' | 'mixed' };

/**
 * Ablage auf der Startseite (wie im Prototyp): nur PDFs → PDF-Werkzeug, nur Fotos → Fotos,
 * genau eine Tabelle → SEPA. Alles andere (gemischt, mehrere Tabellen, unbekannt) → Meldung.
 */
export function classifyDrop(files: readonly FileLike[]): DropResult {
  if (files.length === 0) return { ok: false, code: 'empty' };
  if (files.every(isPdf)) return { ok: true, target: 'pdf' };
  if (files.every(isImage)) return { ok: true, target: 'images' };
  const [first] = files;
  if (files.length === 1 && first && isSpreadsheet(first)) return { ok: true, target: 'sepa' };
  return { ok: false, code: 'mixed' };
}
