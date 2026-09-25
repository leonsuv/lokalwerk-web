import { describe, expect, it } from 'vitest';
import {
  assess,
  composite,
  contrastRatio,
  formatRatio,
  relativeLuminance,
  type Rgba,
} from '../../../src/core/color/contrast.ts';
import { parseColor, toHex } from '../../../src/core/color/parse.ts';

const c = (text: string): Rgba => {
  const color = parseColor(text);
  if (!color) throw new Error(`keine Farbe: ${text}`);
  return color;
};

describe('relativeLuminance und contrastRatio (WCAG 2.2)', () => {
  it('Schwarz 0, Weiß 1, Verhältnis 21:1 und 1:1', () => {
    expect(relativeLuminance(c('#000'))).toBe(0);
    expect(relativeLuminance(c('#fff'))).toBe(1);
    expect(contrastRatio(c('#000'), c('#fff'))).toBe(21);
    expect(contrastRatio(c('#fff'), c('#000'))).toBe(21);
    expect(contrastRatio(c('#abc'), c('#abc'))).toBe(1);
  });

  it('nutzt die Schwelle 0,04045 (Werte 10/255 und 11/255 liegen beidseits davon)', () => {
    // 10/255 = 0,0392 ≤ 0,04045 → linear; 11/255 = 0,0431 > 0,04045 → Potenz
    expect(relativeLuminance({ r: 10, g: 0, b: 0, a: 1 })).toBeCloseTo(
      (0.2126 * 10) / 255 / 12.92,
      12,
    );
    expect(relativeLuminance({ r: 11, g: 0, b: 0, a: 1 })).toBeCloseTo(
      0.2126 * ((11 / 255 + 0.055) / 1.055) ** 2.4,
      12,
    );
  });

  it('bekannte Werte: #767676 auf Weiß 4,54:1, unsere Tokens wie in plan-phase2.md', () => {
    expect(formatRatio(contrastRatio(c('#767676'), c('#fff')))).toBe('4,54:1');
    expect(formatRatio(contrastRatio(c('#cf1d23'), c('#fff')))).toBe('5,45:1');
    // 4,855…:1, im Plan kaufmännisch gerundet als 4,86 angegeben; hier abgerundet
    expect(formatRatio(contrastRatio(c('#7d45d0'), c('#f0e8fc')))).toBe('4,85:1');
    expect(formatRatio(contrastRatio(c('#b8760a'), c('#fbf0dc')))).toBe('3,30:1');
  });
});

describe('assess und formatRatio', () => {
  it('rundet nie auf: knapp unter 4,5 besteht AA nicht und zeigt 4,49', () => {
    // #777 auf Weiß: 4,478…
    const result = assess(c('#777'), c('#fff'));
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.aa).toBe(false);
    expect(result.aaLarge).toBe(true);
    expect(formatRatio(result.ratio)).toBe('4,47:1');
    expect(formatRatio(4.4999)).toBe('4,49:1');
    expect(formatRatio(21)).toBe('21,00:1');
  });

  it('prüft alle Schwellen', () => {
    expect(assess(c('#000'), c('#fff'))).toEqual({
      ratio: 21,
      aa: true,
      aaLarge: true,
      aaa: true,
      aaaLarge: true,
      nonText: true,
    });
    const mid = assess(c('#595959'), c('#fff')); // 7,0:1
    expect(mid.aaa).toBe(true);
    expect(assess(c('#999'), c('#fff')).nonText).toBe(false);
  });

  it('mischt halbtransparenten Text mit dem Hintergrund', () => {
    expect(composite(c('rgba(0,0,0,0.5)'), c('#fff'))).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 1,
    });
    expect(assess(c('rgb(0 0 0 / 50%)'), c('#fff')).ratio).toBeCloseTo(
      contrastRatio({ r: 127.5, g: 127.5, b: 127.5, a: 1 }, c('#fff')),
      12,
    );
  });
});

describe('parseColor', () => {
  it.each([
    ['#3a55e0', [58, 85, 224, 1]],
    ['3A55E0', [58, 85, 224, 1]],
    ['#fff', [255, 255, 255, 1]],
    ['#0008', [0, 0, 0, 136 / 255]],
    ['#11223380', [17, 34, 51, 128 / 255]],
    ['rgb(58, 85, 224)', [58, 85, 224, 1]],
    ['rgb(58 85 224 / 0.5)', [58, 85, 224, 0.5]],
    ['rgba(58,85,224,.25)', [58, 85, 224, 0.25]],
    ['rgb(100% 0% 50%)', [255, 0, 127.5, 1]],
    ['hsl(0, 100%, 50%)', [255, 0, 0, 1]],
    ['hsl(120deg 100% 25%)', [0, 127.5, 0, 1]],
    ['hsla(240, 100%, 50%, 0.5)', [0, 0, 255, 0.5]],
    ['hsl(-120 100% 50%)', [0, 0, 255, 1]],
  ])('%s', (input, [r, g, b, a]) => {
    const color = c(input);
    expect(color.r).toBeCloseTo(r ?? 0, 6);
    expect(color.g).toBeCloseTo(g ?? 0, 6);
    expect(color.b).toBeCloseTo(b ?? 0, 6);
    expect(color.a).toBeCloseTo(a ?? 0, 6);
  });

  it.each(['', 'blau', '#12', '#12345', 'rgb(1,2)', 'rgb(1,2,3,4,5)', 'hsl(1,2,3)', 'rgb(a,b,c)'])(
    '„%s“ ist keine Farbe',
    (input) => {
      expect(parseColor(input)).toBeNull();
    },
  );

  it('schreibt #rrggbb für den Farbwähler', () => {
    expect(toHex(c('rgb(58 85 224)'))).toBe('#3a55e0');
    expect(toHex(c('hsl(120 100% 25%)'))).toBe('#008000');
  });
});
