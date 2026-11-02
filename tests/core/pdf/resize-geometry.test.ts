import { describe, expect, it } from 'vitest';
import { A4, A5, LETTER, MM } from '../../../src/core/pdf/image-layout.ts';
import {
  centeredCell,
  MARGIN,
  scaleFor,
  targetSize,
} from '../../../src/core/pdf/resize-geometry.ts';

describe('targetSize', () => {
  it('feste Formate aus image-layout.ts, hoch bei Hochformat', () => {
    expect(targetSize('a4', { width: 300, height: 400 })).toEqual(A4);
    expect(targetSize('a5', { width: 300, height: 400 })).toEqual(A5);
    expect(targetSize('letter', { width: 300, height: 400 })).toEqual(LETTER);
  });

  it('Querformat bleibt quer', () => {
    expect(targetSize('a4', { width: 800, height: 600 })).toEqual({
      width: A4.height,
      height: A4.width,
    });
  });

  it('„Wie das Blatt“ übernimmt die Größe der Seite', () => {
    expect(targetSize('keep', { width: 123, height: 456 })).toEqual({ width: 123, height: 456 });
  });

  it('DIN A4 in Punkt entspricht 210 × 297 mm', () => {
    expect(A4.width).toBeCloseTo(595.28, 2);
    expect(A4.height).toBeCloseTo(841.89, 2);
    expect(MM).toBeCloseTo(72 / 25.4, 10);
  });
});

describe('scaleFor', () => {
  const target = { width: 600, height: 800 };

  it('Originalgröße ist immer Maßstab 1', () => {
    expect(scaleFor({ width: 2000, height: 3000 }, target, 'center')).toBe(1);
  });

  it('einpassen: kleinere Seite bestimmt den Maßstab, Rand bleibt frei', () => {
    const w = target.width - 2 * MARGIN;
    const h = target.height - 2 * MARGIN;
    expect(scaleFor({ width: 300, height: 300 }, target, 'scale')).toBeCloseTo(
      Math.min(w / 300, h / 300),
      10,
    );
    // Hochkant-Seite: Höhe ist der Engpass
    expect(scaleFor({ width: 100, height: 2000 }, target, 'scale')).toBeCloseTo(h / 2000, 10);
  });

  it('einpassen vergrößert kleine Seiten', () => {
    expect(scaleFor({ width: 100, height: 100 }, target, 'scale')).toBeGreaterThan(1);
  });

  it('null, wenn der Rand die Zielseite ausfüllt', () => {
    expect(
      scaleFor({ width: 10, height: 10 }, { width: 2 * MARGIN, height: 800 }, 'scale'),
    ).toBeNull();
    expect(scaleFor({ width: 0, height: 10 }, target, 'scale')).toBeNull();
  });
});

describe('centeredCell', () => {
  it('Feld der skalierten Seite liegt mittig auf der Zielseite', () => {
    const cell = centeredCell({ width: 200, height: 100 }, 0.5, { width: 300, height: 400 });
    expect(cell).toEqual({ x: 100, y: 175, width: 100, height: 50 });
  });

  it('bei Maßstab 1 und gleicher Größe füllt das Feld die Seite', () => {
    expect(centeredCell({ width: 300, height: 400 }, 1, { width: 300, height: 400 })).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 400,
    });
  });
});
