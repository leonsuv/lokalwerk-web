import { describe, expect, it } from 'vitest';
import { contentCell, letterheadPageIndex } from '../../../src/core/pdf/letterhead-geometry.ts';

describe('letterheadPageIndex', () => {
  it('„first“ nimmt immer die erste Seite', () => {
    expect([0, 1, 2].map((i) => letterheadPageIndex(i, 3, 'first'))).toEqual([0, 0, 0]);
  });

  it('„match“ nimmt die Seite mit gleicher Nummer', () => {
    expect([0, 1, 2].map((i) => letterheadPageIndex(i, 3, 'match'))).toEqual([0, 1, 2]);
  });

  it('bei „match“ bekommen überzählige Briefseiten die letzte Briefpapierseite', () => {
    expect([0, 1, 2, 3].map((i) => letterheadPageIndex(i, 2, 'match'))).toEqual([0, 1, 1, 1]);
  });

  it('ein einseitiges Briefpapier gilt für alle Seiten, auch bei „match“', () => {
    expect([0, 1, 4].map((i) => letterheadPageIndex(i, 1, 'match'))).toEqual([0, 0, 0]);
  });
});

describe('contentCell', () => {
  const a4 = { width: 595, height: 842 };

  it('ohne Anpassen bleibt der Maßstab 1 und der Brief hängt oben links', () => {
    expect(contentCell({ width: 400, height: 500 }, a4, false)).toEqual({
      x: 0,
      y: 842 - 500,
      width: 400,
      height: 500,
    });
  });

  it('mit Anpassen passt der Brief ohne Verzerrung in die Briefpapierseite', () => {
    const cell = contentCell({ width: 1190, height: 1684 }, a4, true);
    expect(cell?.width).toBeCloseTo(595);
    expect(cell?.height).toBeCloseTo(842);
    expect(cell?.y).toBeCloseTo(0);
  });

  it('mit Anpassen wird auch eine kleine Seite vergrößert, bis sie passt', () => {
    const cell = contentCell({ width: 297.5, height: 421 }, a4, true);
    expect(cell?.width).toBeCloseTo(595);
    expect(cell?.height).toBeCloseTo(842);
  });

  it('eine Seite ohne Fläche ergibt kein Feld', () => {
    expect(contentCell({ width: 0, height: 100 }, a4, false)).toBeNull();
  });
});
