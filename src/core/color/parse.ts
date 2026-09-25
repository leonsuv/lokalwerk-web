/**
 * Farbangaben lesen wie in CSS: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() und hsl()/hsla(),
 * mit Kommas oder Leerzeichen und optionalem „/ Alpha“ (CSS Color Module Level 4).
 */

import type { Rgba } from './contrast.ts';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function parseHex(hex: string): Rgba | null {
  if (!/^[0-9a-f]+$/i.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return null;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const m = /^(\d*\.?\d+)(%?)$/.exec(token);
  if (!m) return null;
  return clamp(Number(m[1]) / (m[2] ? 100 : 1), 0, 1);
}

function parseArgs(inner: string): { values: string[]; alpha: string | undefined } | null {
  const [main, alpha, extra] = inner.split('/').map((s) => s.trim());
  if (extra !== undefined || main === undefined) return null;
  const values = main.split(/[\s,]+/).filter(Boolean);
  if (values.length === 4 && alpha === undefined)
    return { values: values.slice(0, 3), alpha: values[3] };
  return values.length === 3 ? { values, alpha } : null;
}

/** HSL nach sRGB wie in CSS Color 4, Abschnitt „Converting HSL Colors to sRGB“ */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function parseColor(input: string): Rgba | null {
  const text = input.trim().toLowerCase();
  if (text.startsWith('#')) return parseHex(text.slice(1));
  if (/^[0-9a-f]{6}$/.test(text) || /^[0-9a-f]{3}$/.test(text)) return parseHex(text);

  const fn = /^(rgba?|hsla?)\((.*)\)$/.exec(text);
  if (!fn?.[1] || fn[2] === undefined) return null;
  const args = parseArgs(fn[2]);
  if (!args) return null;
  const a = parseAlpha(args.alpha);
  if (a === null) return null;

  if (fn[1].startsWith('rgb')) {
    const rgb = args.values.map((v) => {
      const m = /^(\d*\.?\d+)(%?)$/.exec(v);
      if (!m) return Number.NaN;
      return clamp(m[2] ? (Number(m[1]) * 255) / 100 : Number(m[1]), 0, 255);
    });
    if (rgb.some(Number.isNaN)) return null;
    return { r: rgb[0] ?? 0, g: rgb[1] ?? 0, b: rgb[2] ?? 0, a };
  }

  const [hv, sv, lv] = args.values;
  const h = /^(-?\d*\.?\d+)(deg)?$/.exec(hv ?? '');
  const s = /^(\d*\.?\d+)%$/.exec(sv ?? '');
  const l = /^(\d*\.?\d+)%$/.exec(lv ?? '');
  if (!h || !s || !l) return null;
  const hue = ((Number(h[1]) % 360) + 360) % 360;
  const [r, g, b] = hslToRgb(hue, clamp(Number(s[1]) / 100, 0, 1), clamp(Number(l[1]) / 100, 0, 1));
  return { r, g, b, a };
}

/** #rrggbb für <input type="color"> (ohne Deckkraft) */
export function toHex({ r, g, b }: Rgba): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
