import { describe, expect, it } from 'vitest';
import { fitRect, turnRect } from '../../../src/core/geometry/norm-rect.ts';

describe('fitRect (Bereiche bleiben auf der Seite)', () => {
  it('schiebt Bereiche zurück auf die Seite', () => {
    expect(fitRect({ x: 0.9, y: -0.1, w: 0.3, h: 0.2 })).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.2 });
  });

  it('hält eine Mindestgröße und höchstens die ganze Seite', () => {
    expect(fitRect({ x: 0.5, y: 0.5, w: 0, h: 2 })).toEqual({ x: 0.5, y: 0, w: 0.01, h: 1 });
  });
});

describe('turnRect (Bereiche drehen mit dem Bild)', () => {
  it('rechts herum: oben links wird oben rechts', () => {
    expect(turnRect({ x: 0, y: 0, w: 0.2, h: 0.1 }, 90)).toEqual({ x: 0.9, y: 0, w: 0.1, h: 0.2 });
  });

  it('links und rechts heben sich auf', () => {
    const r = { x: 0.125, y: 0.25, w: 0.5, h: 0.375 };
    expect(turnRect(turnRect(r, 90), -90)).toEqual(r);
  });
});
