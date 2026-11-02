/**
 * Lesezeichen einer PDF als flache Liste mit Ebenen (Werkzeug „PDF-Lesezeichen bearbeiten“).
 * Ohne DOM und ohne pdf-lib; die Datei lesen und schreiben steht in ./bookmarks.ts.
 *
 * Eine Liste ist gültig, wenn der erste Eintrag auf Ebene 0 steht und kein Eintrag mehr als
 * eine Ebene tiefer liegt als sein Vorgänger. Dann ist der Baum eindeutig: Ein Eintrag gehört
 * zum letzten davorstehenden Eintrag, der eine Ebene höher liegt. Jede Änderung liefert eine
 * neue Liste und lässt die Eingabe unverändert.
 *
 * Unterpunkte bewegen sich mit: Eine Ebene tiefer oder höher verschiebt den Eintrag mit allen
 * Unterpunkten. Löschen hebt die Unterpunkte um eine Ebene, damit kein Titel verloren geht.
 */

export interface BookmarkEntry {
  title: string;
  /** 0 für oberste Ebene */
  level: number;
  /** Seite, 0-basiert; null, wenn das Ziel in der Datei nicht gefunden wurde */
  page: number | null;
  /** Position im Original in Lesereihenfolge; null bei neu angelegten Einträgen */
  origin: number | null;
}

export const MAX_TITLE_LENGTH = 255;

export type BookmarkErrorCode =
  | 'empty-title'
  | 'title-too-long'
  | 'page-out-of-range'
  | 'invalid-outline'
  | 'too-large'
  | 'too-deep';

export class BookmarkError extends Error {
  readonly code: BookmarkErrorCode;

  constructor(code: BookmarkErrorCode) {
    super(`Lesezeichen-Fehler: ${code}`);
    this.name = 'BookmarkError';
    this.code = code;
  }
}

/** Titel ohne Rand-Leerzeichen; leer oder zu lang ist ein Fehler. */
export function cleanTitle(raw: string): string {
  const title = raw.trim();
  if (title === '') throw new BookmarkError('empty-title');
  if (title.length > MAX_TITLE_LENGTH) throw new BookmarkError('title-too-long');
  return title;
}

export function isValidOutline(entries: readonly BookmarkEntry[]): boolean {
  let previous = -1;
  for (const entry of entries) {
    if (!Number.isInteger(entry.level) || entry.level < 0 || entry.level > previous + 1) {
      return false;
    }
    previous = entry.level;
  }
  return true;
}

/** Index des ersten Eintrags nach dem Eintrag `index` und seinen Unterpunkten. */
export function subtreeEnd(entries: readonly BookmarkEntry[], index: number): number {
  const base = entries[index]?.level ?? Number.POSITIVE_INFINITY;
  let end = index + 1;
  while (end < entries.length && (entries[end]?.level ?? -1) > base) end++;
  return end;
}

/** Anzahl aller Unterpunkte (auch tiefer verschachtelte) eines Eintrags. */
export function descendantCount(entries: readonly BookmarkEntry[], index: number): number {
  return subtreeEnd(entries, index) - index - 1;
}

function shiftSubtree(
  entries: readonly BookmarkEntry[],
  index: number,
  delta: 1 | -1,
): BookmarkEntry[] {
  const end = subtreeEnd(entries, index);
  return entries.map((entry, i) =>
    i >= index && i < end ? { ...entry, level: entry.level + delta } : entry,
  );
}

/** Ein Eintrag darf eine Ebene tiefer, wenn er nicht der erste ist und der Vorgänger es erlaubt. */
export function canIndent(entries: readonly BookmarkEntry[], index: number): boolean {
  const entry = entries[index];
  const previous = entries[index - 1];
  return entry !== undefined && previous !== undefined && entry.level <= previous.level;
}

export function canOutdent(entries: readonly BookmarkEntry[], index: number): boolean {
  return (entries[index]?.level ?? 0) > 0;
}

/** Eine Ebene tiefer, mit Unterpunkten. Nicht erlaubt: Liste unverändert. */
export function indentEntry(entries: BookmarkEntry[], index: number): BookmarkEntry[] {
  return canIndent(entries, index) ? shiftSubtree(entries, index, 1) : entries;
}

/** Eine Ebene höher, mit Unterpunkten. Nicht erlaubt: Liste unverändert. */
export function outdentEntry(entries: BookmarkEntry[], index: number): BookmarkEntry[] {
  return canOutdent(entries, index) ? shiftSubtree(entries, index, -1) : entries;
}

/** Titel ändern. Das Ziel bleibt wie es ist. */
export function renameEntry(
  entries: BookmarkEntry[],
  index: number,
  rawTitle: string,
): BookmarkEntry[] {
  const title = cleanTitle(rawTitle);
  return entries.map((entry, i) => (i === index ? { ...entry, title } : entry));
}

/**
 * Eintrag löschen. Seine Unterpunkte rücken eine Ebene nach oben, damit ihre Titel erhalten
 * bleiben und die Liste gültig bleibt.
 */
export function deleteEntry(entries: BookmarkEntry[], index: number): BookmarkEntry[] {
  if (index < 0 || index >= entries.length) return entries;
  const end = subtreeEnd(entries, index);
  const lifted = entries.map((entry, i) =>
    i > index && i < end ? { ...entry, level: entry.level - 1 } : entry,
  );
  return lifted.filter((_, i) => i !== index);
}

/**
 * Neuen Eintrag nach dem Eintrag `afterIndex` anlegen, nach dessen Unterpunkten, auf derselben
 * Ebene. `afterIndex` null hängt ihn ans Ende der Liste (auf die Ebene des letzten Eintrags).
 */
export function addEntry(
  entries: BookmarkEntry[],
  afterIndex: number | null,
  input: { title: string; page: number },
  pageCount: number,
): BookmarkEntry[] {
  const title = cleanTitle(input.title);
  if (!Number.isInteger(input.page) || input.page < 0 || input.page >= pageCount) {
    throw new BookmarkError('page-out-of-range');
  }
  const entry: BookmarkEntry = { title, page: input.page, origin: null, level: 0 };
  const last = entries.at(-1);
  if (last === undefined) return [entry];
  if (afterIndex === null || afterIndex >= entries.length - 1) {
    return [...entries, { ...entry, level: last.level }];
  }
  const anchor = afterIndex < 0 ? undefined : entries[afterIndex];
  if (anchor === undefined) throw new BookmarkError('invalid-outline');
  const end = subtreeEnd(entries, afterIndex);
  return [...entries.slice(0, end), { ...entry, level: anchor.level }, ...entries.slice(end)];
}
