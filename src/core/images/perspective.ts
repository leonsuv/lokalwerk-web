/**
 * Dokument entzerren (plan-phase2.md Vorschlag C): Homographie aus vier Eckpunkten und Abbildung
 * auf ein Rechteck, mit bilinearer Interpolation. Reine Rechnung auf RGBA-Pixeln.
 */

export interface Point {
  x: number;
  y: number;
}

/** 3×3-Matrix zeilenweise, h[8] = 1 */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Löst A·x = b (n×n) mit Gauß-Elimination und Spaltenpivot; null bei singulärer Matrix */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
    }
    if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot] ?? [], m[col] ?? []];
    const row = m[col] ?? [];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = (m[r]?.[col] ?? 0) / (row[col] ?? 1);
      for (let c = col; c <= n; c++) (m[r] as number[])[c] = (m[r]?.[c] ?? 0) - f * (row[c] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

/** Homographie, die die Punkte `from` auf `to` abbildet (je vier, gleiche Reihenfolge) */
export function homography(from: readonly Point[], to: readonly Point[]): Homography | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i] ?? { x: 0, y: 0 };
    const { x: u, y: v } = to[i] ?? { x: 0, y: 0 };
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return h ? ([...h, 1] as Homography) : null;
}

export function apply(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Größe des entzerrten Bildes aus den Ecken (oben links, oben rechts, unten rechts, unten
 * links): jeweils die längere gegenüberliegende Kante, damit keine Auflösung verloren geht.
 */
export function outputSize(corners: readonly Point[]): { width: number; height: number } {
  const [tl, tr, br, bl] = corners as [Point, Point, Point, Point];
  return {
    width: Math.max(1, Math.round(Math.max(dist(tl, tr), dist(bl, br)))),
    height: Math.max(1, Math.round(Math.max(dist(tl, bl), dist(tr, br)))),
  };
}

/**
 * Entzerrt das Viereck `corners` aus dem Quellbild auf ein Rechteck der Größe `out`.
 * Jedes Zielpixel wird über die Umkehrabbildung aus dem Quellbild gelesen (bilinear).
 */
export function warp(
  src: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  corners: readonly Point[],
  out: { width: number; height: number },
): Uint8ClampedArray {
  const target = [
    { x: 0, y: 0 },
    { x: out.width, y: 0 },
    { x: out.width, y: out.height },
    { x: 0, y: out.height },
  ];
  const inverse = homography(target, corners);
  if (!inverse) throw new RangeError('Die vier Ecken bilden kein Viereck.');
  const dst = new Uint8ClampedArray(out.width * out.height * 4);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const p = apply(inverse, { x: x + 0.5, y: y + 0.5 });
      const sx = Math.min(srcWidth - 1, Math.max(0, p.x - 0.5));
      const sy = Math.min(srcHeight - 1, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const y1 = Math.min(srcHeight - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * out.width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = src[(y0 * srcWidth + x0) * 4 + c] ?? 0;
        const v10 = src[(y0 * srcWidth + x1) * 4 + c] ?? 0;
        const v01 = src[(y1 * srcWidth + x0) * 4 + c] ?? 0;
        const v11 = src[(y1 * srcWidth + x1) * 4 + c] ?? 0;
        dst[o + c] = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
      }
    }
  }
  return dst;
}

/**
 * Bilden die Ecken (in Reihenfolge) ein echtes, nicht überschlagenes Viereck? Alle Kreuzprodukte
 * aufeinanderfolgender Kanten haben dann dasselbe Vorzeichen.
 */
export function isConvexQuad(corners: readonly Point[]): boolean {
  if (corners.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i] as Point;
    const b = corners[(i + 1) % 4] as Point;
    const c = corners[(i + 2) % 4] as Point;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/**
 * Ecken für ein gedrehtes Ergebnis: Bei `turns` Vierteldrehungen rechts herum wird die Ecke
 * unten links zur Ecke oben links usw. Die Reihenfolge bleibt oben links, oben rechts,
 * unten rechts, unten links.
 */
export function turnCorners<T>(corners: readonly T[], turns: number): T[] {
  const shift = ((turns % 4) + 4) % 4;
  return corners.map((_, i) => corners[(i - shift + 4) % 4] as T);
}
