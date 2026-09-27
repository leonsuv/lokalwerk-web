import { describe, expect, it } from 'vitest';
import {
  boxFrom,
  clampZoom,
  dropIndex,
  intersects,
  renderBucket,
  rowsOf,
  stepZoom,
  tileWidth,
  verticalNeighbour,
  wheelZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  type Box,
} from '../../../src/core/workshop/layout.ts';

/** Raster mit `perRow` Kacheln je Zeile, 100 × 140, Abstand 20 */
function grid(count: number, perRow: number): Box[] {
  return Array.from({ length: count }, (_, i) => {
    const left = (i % perRow) * 120;
    const top = Math.floor(i / perRow) * 160;
    return { left, top, right: left + 100, bottom: top + 140 };
  });
}

describe('Zoom', () => {
  it('bleibt in den Grenzen und rundet', () => {
    expect(clampZoom(10)).toBe(ZOOM_MIN);
    expect(clampZoom(999)).toBe(ZOOM_MAX);
    expect(clampZoom(Number.NaN)).toBe(100);
    expect(clampZoom(123.6)).toBe(124);
  });

  it('springt zur nächsten Stufe, auch von Zwischenwerten', () => {
    expect(stepZoom(100, 1)).toBe(125);
    expect(stepZoom(100, -1)).toBe(90);
    expect(stepZoom(110, 1)).toBe(125);
    expect(stepZoom(110, -1)).toBe(100);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });

  it('Mausrad: hoch vergrößert, runter verkleinert, gleich weit zurück', () => {
    const up = wheelZoom(100, -100);
    expect(up).toBeGreaterThan(100);
    expect(wheelZoom(100, 100)).toBeLessThan(100);
    expect(Math.abs(wheelZoom(up, 100) - 100)).toBeLessThanOrEqual(1);
    // Große Sprünge eines Touchpads werden begrenzt
    expect(wheelZoom(100, -5000)).toBe(wheelZoom(100, -200));
  });

  it('Kachelbreite und Auflösungsstufen', () => {
    expect(tileWidth(100)).toBe(132);
    expect(tileWidth(200)).toBe(264);
    expect(renderBucket(100)).toBe(144);
    expect(renderBucket(144)).toBe(144);
    expect(renderBucket(99999)).toBe(1640);
  });
});

describe('Raster', () => {
  it('gruppiert Kacheln in Zeilen', () => {
    expect(rowsOf(grid(7, 3))).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
    expect(rowsOf([])).toEqual([]);
  });

  it('Einfügestelle: vor der Kachel, deren Mitte rechts vom Zeiger liegt', () => {
    const boxes = grid(7, 3);
    expect(dropIndex(boxes, 10, 50)).toBe(0);
    expect(dropIndex(boxes, 60, 50)).toBe(1);
    expect(dropIndex(boxes, 300, 50)).toBe(3);
    expect(dropIndex(boxes, 70, 200)).toBe(4);
    // Unter der letzten Zeile, rechts von der letzten Kachel: am Ende
    expect(dropIndex(boxes, 200, 400)).toBe(7);
    expect(dropIndex(boxes, 10, 900)).toBe(6);
    // Über dem Raster: am Anfang; ohne Kacheln: 0
    expect(dropIndex(boxes, 200, -40)).toBe(0);
    expect(dropIndex([], 5, 5)).toBe(0);
  });

  it('im Abstand zwischen zwei Zeilen zählt die nähere Zeile', () => {
    const boxes = grid(6, 3);
    // Zeile 1 endet bei 140, Zeile 2 beginnt bei 160
    expect(dropIndex(boxes, 10, 145)).toBe(0);
    expect(dropIndex(boxes, 10, 155)).toBe(3);
  });

  it('Pfeil hoch und runter: nächste Kachel in der Nachbarzeile', () => {
    const boxes = grid(7, 3);
    expect(verticalNeighbour(boxes, 1, 1)).toBe(4);
    expect(verticalNeighbour(boxes, 4, -1)).toBe(1);
    expect(verticalNeighbour(boxes, 5, 1)).toBe(6);
    expect(verticalNeighbour(boxes, 6, 1)).toBeNull();
    expect(verticalNeighbour(boxes, 0, -1)).toBeNull();
  });

  it('Auswahlrechteck in jeder Richtung', () => {
    const band = boxFrom(250, 300, 50, 100);
    expect(band).toEqual({ left: 50, top: 100, right: 250, bottom: 300 });
    const boxes = grid(7, 3);
    expect(boxes.flatMap((b, i) => (intersects(band, b) ? [i] : []))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(intersects(boxFrom(0, 0, 10, 10), { left: 10, top: 0, right: 20, bottom: 10 })).toBe(
      false,
    );
  });
});
