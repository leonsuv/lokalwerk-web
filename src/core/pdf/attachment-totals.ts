/**
 * Summen für die Anhang-Liste (Werkzeug „Anhänge verwalten“). Ohne pdf-lib, damit die Seite sie
 * laden kann, ohne die PDF-Bibliothek auf den Hauptthread zu ziehen.
 */

/** Summe der bekannten Größen in Byte; unbekannte (null) zählen nicht mit */
export function sumAttachmentSizes(sizes: ReadonlyArray<number | null>): number {
  return sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0);
}
