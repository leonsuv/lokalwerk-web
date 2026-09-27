/**
 * Geometrie der Arbeitsfläche der PDF-Werkstatt (Umbau zum Editor), ohne DOM: Zoom, Zeilen im
 * umbrechenden Seitenraster, Einfügestelle beim Ziehen, Nachbarn für die Pfeiltasten. Die
 * Oberfläche misst die Kacheln (getBoundingClientRect) und fragt hier nach.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// ---------------------------------------------------------------------------------------------
// Zoom (Seitenraster und Einzelseite, in Prozent)

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 400;
export const ZOOM_DEFAULT = 100;
/** Stufen für Strg+Plus/Minus und die Knöpfe */
export const ZOOM_STEPS = [50, 67, 75, 90, 100, 125, 150, 175, 200, 250, 300, 400] as const;
/** Breite einer Seitenkachel bei 100 % in CSS-Pixeln */
export const TILE_WIDTH = 132;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_DEFAULT;
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)));
}

/** Nächste Stufe nach oben (`1`) oder unten (`-1`), auch von Werten zwischen den Stufen */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const z = clampZoom(zoom);
  if (direction > 0) return ZOOM_STEPS.find((s) => s > z) ?? ZOOM_MAX;
  return [...ZOOM_STEPS].reverse().find((s) => s < z) ?? ZOOM_MIN;
}

/**
 * Strg+Mausrad und Zwei-Finger-Zoom: stufenlos, gleichmäßig in beide Richtungen
 * (`deltaY` wie im WheelEvent, negativ = vergrößern).
 */
export function wheelZoom(zoom: number, deltaY: number): number {
  const delta = Math.max(-200, Math.min(200, deltaY));
  return clampZoom(zoom * Math.exp(-delta * 0.0025));
}

export function tileWidth(zoom: number): number {
  return Math.round((TILE_WIDTH * clampZoom(zoom)) / 100);
}

/**
 * Stufe der Auflösung für Vorschaubilder: gleiche Stufe, kein neues Zeichnen. Neu gezeichnet
 * wird erst, wenn die Kachel deutlich größer wird (Faktor 1,5).
 */
export function renderBucket(pixels: number): number {
  const steps = [96, 144, 216, 324, 486, 729, 1094, 1640];
  return steps.find((s) => s >= pixels) ?? 1640;
}

// ---------------------------------------------------------------------------------------------
// Zeilen im Raster

/** Kacheln in Zeilen gruppieren (Indizes), wie sie der Browser umbricht */
export function rowsOf(boxes: readonly Box[]): number[][] {
  const rows: number[][] = [];
  let top = Number.NaN;
  let bottom = Number.NaN;
  boxes.forEach((b, i) => {
    const row = rows[rows.length - 1];
    // Neue Zeile, wenn die Kachel unter der Mitte der bisherigen Zeile beginnt
    if (!row || b.top >= (top + bottom) / 2) {
      rows.push([i]);
      top = b.top;
      bottom = b.bottom;
    } else {
      row.push(i);
    }
  });
  return rows;
}

/**
 * Einfügestelle unter dem Zeiger (vor dieser Kachel; `boxes.length` = am Ende): in der Zeile, in
 * der der Zeiger steht, vor der ersten Kachel, deren Mitte rechts vom Zeiger liegt. Über der
 * ersten Zeile am Anfang, unter der letzten am Ende.
 */
export function dropIndex(boxes: readonly Box[], x: number, y: number): number {
  const rows = rowsOf(boxes).map((row) =>
    row.flatMap((i) => (boxes[i] ? [{ i, b: boxes[i] }] : [])),
  );
  const first = rows[0]?.[0];
  if (!first) return 0;
  if (y < first.b.top) return 0;
  for (const [r, row] of rows.entries()) {
    const bottom = Math.max(...row.map(({ b }) => b.bottom));
    const next = rows[r + 1];
    const nextTop = next ? Math.min(...next.map(({ b }) => b.top)) : Infinity;
    // Zwischen zwei Zeilen gehört die obere Hälfte des Abstands zur oberen Zeile
    if (!next || y <= bottom + (nextTop - bottom) / 2) {
      const before = row.find(({ b }) => x < (b.left + b.right) / 2);
      return before ? before.i : (row[row.length - 1]?.i ?? -1) + 1;
    }
  }
  return boxes.length;
}

/**
 * Kachel in der Zeile darüber (`-1`) oder darunter (`1`), die waagerecht am nächsten liegt;
 * null am Rand.
 */
export function verticalNeighbour(
  boxes: readonly Box[],
  index: number,
  direction: 1 | -1,
): number | null {
  const rows = rowsOf(boxes);
  const r = rows.findIndex((row) => row.includes(index));
  const target = rows[r + direction];
  const from = boxes[index];
  if (r < 0 || !target || !from) return null;
  const x = (from.left + from.right) / 2;
  let best: number | null = null;
  let distance = Infinity;
  for (const i of target) {
    const b = boxes[i];
    const d = b ? Math.abs((b.left + b.right) / 2 - x) : Infinity;
    if (d < distance) {
      best = i;
      distance = d;
    }
  }
  return best;
}

/** Schneiden sich zwei Rechtecke (Auswahlrechteck und Kachel)? */
export function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Rechteck aus zwei Punkten, in beliebiger Richtung aufgezogen */
export function boxFrom(x1: number, y1: number, x2: number, y2: number): Box {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}
