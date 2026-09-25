import { describe, expect, it } from 'vitest';
import {
  diagonalAngle,
  normalizeRotation,
  placeAtEdge,
  placeCentered,
  toUserSpace,
  toVisible,
  visibleSize,
  type PageRotation,
} from '../../../src/core/pdf/stamp-geometry.ts';

// Hochformat mit verschobener CropBox, damit ein vergessener Versatz auffällt
const box = { x: 20, y: 30, width: 600, height: 800 };
const rotations: PageRotation[] = [0, 90, 180, 270];

/** Richtung der Grundlinie auf der sichtbaren Seite */
function visibleDirection(rotation: PageRotation, x: number, y: number, rotate: number) {
  const rad = (rotate * Math.PI) / 180;
  const a = toVisible(box, rotation, x, y);
  const b = toVisible(box, rotation, x + Math.cos(rad), y + Math.sin(rad));
  return { dx: b.vx - a.vx, dy: b.vy - a.vy };
}

describe('Drehung', () => {
  it('normalisiert Winkel', () => {
    expect([0, 90, -90, 270, 360, 450, -180].map(normalizeRotation)).toEqual([
      0, 90, 270, 270, 0, 90, 180,
    ]);
  });

  it.each(rotations)('%i Grad: Hin- und Rückrechnung stimmen, Ecken liegen richtig', (r) => {
    const { width, height } = visibleSize(box, r);
    for (const [vx, vy] of [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
      [123, 45],
    ] as const) {
      const p = toUserSpace(box, r, vx, vy);
      const back = toVisible(box, r, p.x, p.y);
      expect(back.vx).toBeCloseTo(vx, 9);
      expect(back.vy).toBeCloseTo(vy, 9);
      // jeder Punkt der sichtbaren Seite liegt in der CropBox
      expect(p.x).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(p.x).toBeLessThanOrEqual(box.x + box.width + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(p.y).toBeLessThanOrEqual(box.y + box.height + 1e-9);
    }
  });

  it('dreht bei 90 Grad im Uhrzeigersinn: oben links wird oben rechts (ISO 32000-2, /Rotate)', () => {
    // ungedreht oben links = Benutzerraum (x, y + height)
    const v = toVisible(box, 90, box.x, box.y + box.height);
    expect(v).toEqual({ vx: 800, vy: 600 });
    expect(visibleSize(box, 90)).toEqual({ width: 800, height: 600 });
  });
});

describe('placeAtEdge', () => {
  it.each(rotations)('%i Grad: Text läuft auf der sichtbaren Seite waagerecht nach rechts', (r) => {
    const place = placeAtEdge(box, r, 'bottom-right', 50, 7, 28);
    const dir = visibleDirection(r, place.x, place.y, place.rotate);
    expect(dir.dx).toBeCloseTo(1, 9);
    expect(dir.dy).toBeCloseTo(0, 9);
  });

  it.each(rotations)('%i Grad: Abstände zum sichtbaren Rand stimmen', (r) => {
    const { width, height } = visibleSize(box, r);
    const bottomRight = placeAtEdge(box, r, 'bottom-right', 50, 7, 28);
    const v1 = toVisible(box, r, bottomRight.x, bottomRight.y);
    expect(v1.vx).toBeCloseTo(width - 28 - 50, 9);
    expect(v1.vy).toBeCloseTo(28, 9);

    const topCenter = placeAtEdge(box, r, 'top-center', 50, 7, 28);
    const v2 = toVisible(box, r, topCenter.x, topCenter.y);
    expect(v2.vx).toBeCloseTo((width - 50) / 2, 9);
    expect(v2.vy).toBeCloseTo(height - 28 - 7, 9);

    const bottomLeft = placeAtEdge(box, r, 'bottom-left', 50, 7, 28);
    expect(toVisible(box, r, bottomLeft.x, bottomLeft.y).vx).toBeCloseTo(28, 9);
  });
});

describe('placeCentered', () => {
  it.each(rotations)(
    '%i Grad: Mitte der Zeile liegt in der Seitenmitte, Richtung wie gewünscht',
    (r) => {
      const angle = diagonalAngle(box, r);
      const place = placeCentered(box, r, angle, 300, 40);
      const rad = (place.rotate * Math.PI) / 180;
      // Mittelpunkt der Zeile im Benutzerraum: Anfang + gedrehtes (150, 20)
      const cx = place.x + 150 * Math.cos(rad) - 20 * Math.sin(rad);
      const cy = place.y + 150 * Math.sin(rad) + 20 * Math.cos(rad);
      const center = toVisible(box, r, cx, cy);
      const { width, height } = visibleSize(box, r);
      expect(center.vx).toBeCloseTo(width / 2, 6);
      expect(center.vy).toBeCloseTo(height / 2, 6);
      const dir = visibleDirection(r, place.x, place.y, place.rotate);
      expect((Math.atan2(dir.dy, dir.dx) * 180) / Math.PI).toBeCloseTo(angle, 6);
    },
  );

  it('Diagonale: Hochformat steiler als 45 Grad, Querformat flacher', () => {
    expect(diagonalAngle(box, 0)).toBeGreaterThan(45);
    expect(diagonalAngle(box, 90)).toBeLessThan(45);
  });
});
