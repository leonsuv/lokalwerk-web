/**
 * Etikettenbögen als reine Geometrie (plan-phase2.md Werkzeug 24). Alle Maße in Millimetern,
 * Ursprung oben links auf einem DIN-A4-Blatt (ISO 216: 210 × 297 mm).
 *
 * Voreinstellungen nennen nur Maße, keine Hersteller oder Artikelnummern (Entscheidung E10).
 * Sie beschreiben Bögen ohne Abstände zwischen den Etiketten, das Raster mittig auf dem Blatt.
 * Jeder Bogen lässt sich nachmessen und anpassen.
 */

export const PAGE = { width: 210, height: 297 } as const;

export interface SheetSpec {
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  /** Abstand vom oberen Blattrand zur Oberkante der ersten Etikettenreihe */
  marginTop: number;
  /** Abstand vom linken Blattrand zur linken Kante der ersten Spalte */
  marginLeft: number;
  /** Abstand zwischen zwei Etiketten nebeneinander */
  gapX: number;
  /** Abstand zwischen zwei Etiketten untereinander */
  gapY: number;
}

export interface LabelPreset {
  id: string;
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
}

export const PRESETS: readonly LabelPreset[] = [
  { id: '3x8-70x37', columns: 3, rows: 8, labelWidth: 70, labelHeight: 37 },
  { id: '3x8-70x36', columns: 3, rows: 8, labelWidth: 70, labelHeight: 36 },
  { id: '3x7-70x42.3', columns: 3, rows: 7, labelWidth: 70, labelHeight: 42.3 },
  { id: '3x11-70x25.4', columns: 3, rows: 11, labelWidth: 70, labelHeight: 25.4 },
  { id: '2x8-105x37', columns: 2, rows: 8, labelWidth: 105, labelHeight: 37 },
  { id: '2x7-105x42.3', columns: 2, rows: 7, labelWidth: 105, labelHeight: 42.3 },
  { id: '2x4-105x74', columns: 2, rows: 4, labelWidth: 105, labelHeight: 74 },
];

const round = (v: number) => Math.round(v * 100) / 100;

/** Bogen zu einer Voreinstellung: ohne Abstände, Raster mittig auf dem Blatt */
export function presetSheet(p: LabelPreset): SheetSpec {
  return {
    columns: p.columns,
    rows: p.rows,
    labelWidth: p.labelWidth,
    labelHeight: p.labelHeight,
    marginTop: round((PAGE.height - p.rows * p.labelHeight) / 2),
    marginLeft: round((PAGE.width - p.columns * p.labelWidth) / 2),
    gapX: 0,
    gapY: 0,
  };
}

export type SheetProblem = 'invalid' | 'too-wide' | 'too-tall';

/** Toleranz für Rundungen bei nachgemessenen Werten */
const TOLERANCE = 0.05;

/** Passt der Bogen auf das Blatt? null, wenn ja */
export function checkSheet(s: SheetSpec): SheetProblem | null {
  const counts = [s.columns, s.rows];
  const sizes = [s.labelWidth, s.labelHeight];
  const offsets = [s.marginTop, s.marginLeft, s.gapX, s.gapY];
  if (
    !counts.every((n) => Number.isInteger(n) && n >= 1 && n <= 40) ||
    !sizes.every((v) => Number.isFinite(v) && v >= 5) ||
    !offsets.every((v) => Number.isFinite(v) && v >= 0)
  ) {
    return 'invalid';
  }
  const width = s.marginLeft + s.columns * s.labelWidth + (s.columns - 1) * s.gapX;
  const height = s.marginTop + s.rows * s.labelHeight + (s.rows - 1) * s.gapY;
  if (width > PAGE.width + TOLERANCE) return 'too-wide';
  if (height > PAGE.height + TOLERANCE) return 'too-tall';
  return null;
}

export const labelsPerPage = (s: SheetSpec): number => s.columns * s.rows;

export interface MmRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lage des Etiketts Nummer `index` (0 = oben links, zeilenweise) auf seinem Blatt */
export function labelRect(s: SheetSpec, index: number): MmRect {
  const slot = index % labelsPerPage(s);
  const column = slot % s.columns;
  const row = Math.floor(slot / s.columns);
  return {
    x: s.marginLeft + column * (s.labelWidth + s.gapX),
    y: s.marginTop + row * (s.labelHeight + s.gapY),
    width: s.labelWidth,
    height: s.labelHeight,
  };
}

/** Anzahl Blätter für `count` Etiketten, wenn das erste auf Platz `start` (ab 1) kommt */
export function pageCount(s: SheetSpec, count: number, start: number): number {
  if (count === 0) return 0;
  return Math.ceil((start - 1 + count) / labelsPerPage(s));
}
