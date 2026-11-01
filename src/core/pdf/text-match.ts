/**
 * Textstellen in einer PDF-Seite finden und als Rechtecke (Anteile 0–1, Ursprung oben links)
 * liefern, damit „PDF schwärzen“ sie vorschlagen kann. Ohne DOM und ohne pdf.js: Die Seite gibt
 * die Textstücke mit ihrer Lage im Seitenbild (Punkt, Ursprung oben links) herein.
 *
 * Gefunden wird im Text der Seite, in dem die Textstücke durch je ein Leerzeichen getrennt sind.
 * Ein Treffer über mehrere Stücke ergibt je Stück ein Rechteck; bei einem Teiltreffer in einem
 * Stück wird nach geschätzten Zeichenbreiten geteilt (die echten Schriftbreiten kennt die Seite
 * hier nicht) und an angeschnittenen Rändern um knapp ein Zeichen nach außen erweitert. Lieber
 * etwas zu viel schwärzen als einen Rest stehen lassen.
 * Seiten ohne Text (Scans) liefern nichts.
 */

import { fitRect, type NormRect } from '../geometry/norm-rect.ts';

/** Ein Textstück: Text, Matrix [a b c d e f] im Seitenbild und Breite im Seitenbild */
export interface PageTextItem {
  str: string;
  tx: readonly number[];
  width: number;
}

export interface PageText {
  width: number;
  height: number;
  items: readonly PageTextItem[];
}

/** Matrix m1 × m2 wie pdf.js `Util.transform` */
export function multiply(m1: readonly number[], m2: readonly number[]): number[] {
  const [a1 = 1, b1 = 0, c1 = 0, d1 = 1, e1 = 0, f1 = 0] = m1;
  const [a2 = 1, b2 = 0, c2 = 0, d2 = 1, e2 = 0, f2 = 0] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/** Anteil der Schrifthöhe, den ein Rechteck unter die Grundlinie reicht (Unterlängen) */
const DESCENT = 0.3;
/** Rand um jeden Treffer, als Anteil der Schrifthöhe */
const PAD = 0.08;

/**
 * Umschließendes Rechteck des Abschnitts [from, to] (Anteile 0–1 der Breite) eines Textstücks,
 * in Seitenbildpunkten. Funktioniert für jede Drehung, weil es von den Achsen der Matrix ausgeht.
 */
export function itemBox(
  item: PageTextItem,
  from: number,
  to: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = item.tx;
  const lengthU = Math.hypot(a, b) || 1;
  const ux = a / lengthU;
  const uy = b / lengthU;
  // Aufwärtsrichtung der Schrift und Schrifthöhe: zweite Achse der Matrix
  const height = Math.hypot(c, d);
  const vx = height > 0 ? c / height : 0;
  const vy = height > 0 ? d / height : -1;
  const start = item.width * from;
  const end = item.width * to;
  const pad = height * PAD;
  const corners = [
    [start - pad, -DESCENT * height - pad],
    [end + pad, -DESCENT * height - pad],
    [start - pad, height + pad],
    [end + pad, height + pad],
  ].map(([s = 0, h = 0]) => [e + ux * s + vx * h, f + uy * s + vy * h] as const);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Zeichenbreiten der Standardschrift Helvetica (je 1000 Einheiten Schriftgröße, Adobe-Standard-
 * Schriftmetriken, wie sie auch pdf-lib mitbringt). Die Seite kennt die Schrift des Textstücks
 * nicht; für ähnliche Schriften (Arial, Calibri, Liberation Sans) stimmen die Verhältnisse
 * ungefähr, deshalb gibt es an angeschnittenen Rändern einen Zuschlag (siehe `fractions`).
 */
const HELVETICA_CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÄÖÜäöüßéèàç€';
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  667, 778, 722, 556, 556, 556, 611, 556, 556, 556, 500, 556,
];
const HELVETICA = new Map(Array.from(HELVETICA_CHARS, (ch, i) => [ch, HELVETICA_WIDTHS[i] ?? 556]));

/** Breite eines Zeichens relativ zu 1000; unbekannte Zeichen zählen wie ein kleiner Buchstabe */
export function charWeight(ch: string): number {
  return (HELVETICA.get(ch) ?? 556) / 1000;
}

/** Anteil [from, to] der Breite von `str` für die Zeichen [lo, hi), nach Zeichenbreiten */
function fractions(str: string, lo: number, hi: number): [number, number] {
  const weights = Array.from(str, charWeight);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const before = weights.slice(0, lo).reduce((a, b) => a + b, 0);
  const upto = weights.slice(0, hi).reduce((a, b) => a + b, 0);
  const half = (total / Math.max(1, str.length)) * 0.8;
  const from = lo > 0 ? Math.max(0, before - half) : 0;
  const to = hi < str.length ? Math.min(total, upto + half) : total;
  return [from / total, to / total];
}

/** Rechtecke aller Treffer der Ausdrücke (mit Flag g) auf einer Seite */
export function findRects(page: PageText, patterns: readonly RegExp[]): NormRect[] {
  if (page.width <= 0 || page.height <= 0) return [];
  const spans: { start: number; end: number; item: PageTextItem }[] = [];
  let text = '';
  for (const item of page.items) {
    if (item.str === '') continue;
    if (text !== '') text += ' ';
    spans.push({ start: text.length, end: text.length + item.str.length, item });
    text += item.str;
  }
  const out: NormRect[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const s = match.index;
      const e = s + match[0].length;
      if (match[0].length === 0) continue;
      for (const span of spans) {
        const lo = Math.max(s, span.start);
        const hi = Math.min(e, span.end);
        if (lo >= hi) continue;
        const [from, to] = fractions(span.item.str, lo - span.start, hi - span.start);
        const box = itemBox(span.item, from, to);
        out.push(
          fitRect({
            x: box.x0 / page.width,
            y: box.y0 / page.height,
            w: (box.x1 - box.x0) / page.width,
            h: (box.y1 - box.y0) / page.height,
          }),
        );
      }
    }
  }
  return out;
}

/** Wörtliche Suche: Groß-/Kleinschreibung egal, beliebig viele Leerzeichen entsprechen einem */
export function termPattern(term: string): RegExp | null {
  const words = term.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('\\s+'), 'giu');
}

/** IBAN mit oder ohne Leerzeichen in Vierergruppen (Länge 15 bis 34 Zeichen) */
export const IBAN_PATTERN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g;

/** E-Mail-Adresse, bewusst großzügig */
export const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
