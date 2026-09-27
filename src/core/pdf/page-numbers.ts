/**
 * Einstellungen für Seitenzahlen (plan-phase2.md Werkzeug 6), ohne pdf-lib: gemeinsam für das
 * Werkzeug „Seitenzahlen einfügen“, die PDF-Werkstatt (Dokument-Operation, plan-phase3.md 7.2)
 * und das Zeichnen in stamp.ts.
 */

import { edgeInView, type Anchor, type ViewPoint } from './stamp-geometry.ts';
import { CAP_HEIGHT, MM } from './stamp-layout.ts';

export type NumberFormat = 'n' | 'seite-n' | 'seite-n-von-m' | 'n-von-m' | 'strich';

export function pageNumberText(format: NumberFormat, n: number, last: number): string {
  switch (format) {
    case 'n':
      return String(n);
    case 'seite-n':
      return `Seite ${n}`;
    case 'seite-n-von-m':
      return `Seite ${n} von ${last}`;
    case 'n-von-m':
      return `${n} / ${last}`;
    case 'strich':
      return `– ${n} –`;
  }
}

export interface PageNumberOptions {
  format: NumberFormat;
  anchor: Anchor;
  /** Erste Seite (ab 1), die eine Zahl bekommt; davor bleibt frei (z. B. Deckblatt) */
  fromPage: number;
  /** Zahl auf der ersten nummerierten Seite */
  startAt: number;
  fontSize: number;
  /** Abstand vom Seitenrand in Millimetern */
  marginMm: number;
}

/** Welche Eingabe nicht passt: „Ab Seite“ oder „Erste Zahl“ */
export type PageNumberInputError = 'from' | 'start';

/** „Ab Seite“ muss eine Seite des Dokuments sein, „Erste Zahl“ eine ganze Zahl ab 0 */
export function checkPageNumberInput(
  fromPage: number,
  startAt: number,
  pages: number,
): PageNumberInputError | null {
  if (!Number.isInteger(fromPage) || fromPage < 1 || fromPage > pages) return 'from';
  if (!Number.isInteger(startAt) || startAt < 0) return 'start';
  return null;
}

export function samePageNumbers(a: PageNumberOptions, b: PageNumberOptions): boolean {
  return (
    a.format === b.format &&
    a.anchor === b.anchor &&
    a.fromPage === b.fromPage &&
    a.startAt === b.startAt &&
    a.fontSize === b.fontSize &&
    a.marginMm === b.marginMm
  );
}

/**
 * Text der Seitenzahl für die Seite an Position `index` (ab 0) eines Dokuments mit `count`
 * Seiten, oder null vor „Ab Seite“. Liegt „Ab Seite“ hinter der letzten Seite, bekommt keine
 * Seite eine Zahl.
 */
export function pageNumberFor(
  options: PageNumberOptions,
  index: number,
  count: number,
): string | null {
  const first = Math.max(1, Math.floor(options.fromPage));
  if (index + 1 < first) return null;
  const last = options.startAt + (count - first);
  return pageNumberText(options.format, options.startAt + index + 1 - first, last);
}

/**
 * Anfang der Grundlinie der Seitenzahl auf der sichtbaren Seite (`width` × `height` Punkt,
 * Ursprung unten links). `textWidth` ist die Breite des Texts in Helvetica bei `fontSize`.
 * Gemeinsam für das Setzen in die PDF (stamp.ts) und die Vorschau der Werkstatt.
 */
export function pageNumberInView(
  width: number,
  height: number,
  options: PageNumberOptions,
  textWidth: number,
): ViewPoint {
  return edgeInView(
    width,
    height,
    options.anchor,
    textWidth,
    options.fontSize * CAP_HEIGHT,
    options.marginMm * MM,
  );
}
