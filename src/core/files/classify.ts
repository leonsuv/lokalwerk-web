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

/** Dateiarten, die die Ablage der Startseite unterscheidet. */
export type FileKind = 'pdf' | 'image' | 'spreadsheet';

export function fileKind(file: FileLike): FileKind | null {
  if (isPdf(file)) return 'pdf';
  if (isImage(file)) return 'image';
  if (isSpreadsheet(file)) return 'spreadsheet';
  return null;
}

export type DropKind =
  { ok: true; kind: FileKind; count: number } | { ok: false; code: 'empty' | 'mixed' };

/** Alle abgelegten Dateien müssen dieselbe bekannte Art haben. */
export function dropKind(files: readonly FileLike[]): DropKind {
  const [first] = files;
  if (!first) return { ok: false, code: 'empty' };
  const kind = fileKind(first);
  if (!kind || files.some((f) => fileKind(f) !== kind)) return { ok: false, code: 'mixed' };
  return { ok: true, kind, count: files.length };
}

export interface Accepting {
  accepts?: { kind: FileKind; multiple: boolean } | undefined;
}

/**
 * Werkzeuge, die diese Ablage übernehmen können (plan-phase2.md Abschnitt 3.4), in der
 * Reihenfolge der Eingabe. Werkzeuge für eine einzelne Datei fallen bei mehreren weg.
 */
export function toolsForDrop<T extends Accepting>(
  tools: readonly T[],
  kind: FileKind,
  count: number,
): T[] {
  return tools.filter((t) => t.accepts?.kind === kind && (count === 1 || t.accepts.multiple));
}

const NOUNS: Record<FileKind, [string, string]> = {
  pdf: ['PDF', 'PDFs'],
  image: ['Foto', 'Fotos'],
  spreadsheet: ['Tabelle', 'Tabellen'],
};

/** „1 PDF“, „3 Fotos“ */
export function describeDrop(kind: FileKind, count: number): string {
  return `${count} ${NOUNS[kind][count === 1 ? 0 : 1]}`;
}
