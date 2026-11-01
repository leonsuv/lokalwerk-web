/**
 * Dateien aus der Zwischenablage (Strg+V) für Ablageflächen. Gilt nur, wenn die Einfügung nicht in
 * ein Eingabefeld geht (dort soll Text wie gewohnt eingefügt werden) und Dateien enthält.
 */

interface PasteTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

interface PasteLike {
  clipboardData: { files: ArrayLike<File> } | null;
  target: unknown;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isEditableTarget(target: unknown): boolean {
  const t = target as PasteTarget | null;
  if (!t) return false;
  return EDITABLE_TAGS.has((t.tagName ?? '').toUpperCase()) || t.isContentEditable === true;
}

/** Die eingefügten Dateien, oder eine leere Liste, wenn die Einfügung nicht gemeint ist */
export function pastedFiles(event: PasteLike): File[] {
  if (isEditableTarget(event.target)) return [];
  return Array.from(event.clipboardData?.files ?? []);
}
