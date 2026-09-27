/**
 * Einstellungen von „Stempel und Wasserzeichen“ (Text, Position, Farbe, Deckkraft, Seiten):
 * gemeinsam für die Werkzeugseite (page.ts) und die PDF-Werkstatt (embed.ts). Die Elemente
 * werden beim Einbinden gesucht, nicht beim Laden des Moduls (plan-phase3.md 7.1).
 */

import { parsePageRanges, type PageRange } from '../../core/pdf/page-ranges.ts';
import type { StampColor, StampOptions, StampPlacement } from '../../core/pdf/stamp.ts';
import { unsupportedChars } from '../../core/pdf/winansi.ts';

export type StampLook = Omit<StampOptions, 'pages'>;

export interface StampSettings {
  /** Fehler im Text („“ wenn keiner); ohne Zeichenvorrat wird nur auf leer geprüft */
  textError(charset: ReadonlySet<number> | null): string;
  /** Seitenangabe für ein Dokument mit `pages` Seiten; leer heißt alle, `null`: nicht prüfen */
  pagesResult(pages: number | null): { ranges: PageRange[] } | { error: string };
  /** Zeigt Fehler an den Feldern; true, wenn alles passt */
  validate(pages: number | null, charset: ReadonlySet<number> | null): boolean;
  look(): StampLook;
  set(look: StampLook, pages?: string): void;
  focus(): void;
}

const quoted = (chars: string[]) => chars.map((c) => `„${c}“`).join(', ');

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element ${selector} fehlt`);
  return el;
}

export function stampSettings(root: ParentNode, onChange: () => void): StampSettings {
  const text = find<HTMLInputElement>(root, '#stamp-text');
  const placement = find<HTMLSelectElement>(root, '#stamp-placement');
  const color = find<HTMLSelectElement>(root, '#stamp-color');
  const opacity = find<HTMLInputElement>(root, '#stamp-opacity');
  const opacityValue = find(root, '#stamp-opacity-val');
  const pagesInput = find<HTMLInputElement>(root, '#stamp-pages');
  const textErrorEl = find(root, '#stamp-text-error');
  const pagesErrorEl = find(root, '#stamp-pages-error');
  for (const el of [text, placement, color, opacity, pagesInput]) {
    el.addEventListener('input', onChange);
    el.addEventListener('change', onChange);
  }

  const settings: StampSettings = {
    textError(charset) {
      const value = text.value;
      if (value.trim() === '') return 'Gib den Text für den Stempel ein.';
      if (!charset) return '';
      const missing = unsupportedChars(value, charset);
      if (missing.length === 0) return '';
      return `Diese Zeichen kann die PDF-Schrift nicht darstellen: ${quoted(missing)}. Ersetze sie, zum Beispiel Ł durch L.`;
    },
    pagesResult(pages) {
      if (pages === null || pagesInput.value.trim() === '') return { ranges: [] };
      const parsed = parsePageRanges(pagesInput.value, pages);
      if (parsed.ok) return { ranges: parsed.ranges };
      const e = parsed.error;
      switch (e.code) {
        case 'syntax':
          return {
            error: `„${e.part}“ ist keine Seitenangabe. Schreib Seiten wie 5 oder Bereiche wie 1-3.`,
          };
        case 'out-of-range':
          return {
            error: `„${e.part}“ gibt es nicht: Die PDF hat ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}.`,
          };
        case 'reversed':
          return { error: `Bei „${e.part}“ muss die erste Seite vor der letzten stehen.` };
        default:
          return { ranges: [] };
      }
    },
    validate(pages, charset) {
      opacityValue.textContent = opacity.value;
      const tError = settings.textError(charset);
      textErrorEl.textContent = tError;
      text.setAttribute('aria-invalid', String(tError !== ''));
      const result = settings.pagesResult(pages);
      const pError = 'error' in result ? result.error : '';
      pagesErrorEl.textContent = pError;
      pagesInput.setAttribute('aria-invalid', String(pError !== ''));
      return tError === '' && pError === '';
    },
    look() {
      return {
        text: text.value.trim(),
        placement: placement.value as StampPlacement,
        color: color.value as StampColor,
        opacity: Number(opacity.value) / 100,
      };
    },
    set(look, pages = '') {
      text.value = look.text;
      placement.value = look.placement;
      color.value = look.color;
      opacity.value = String(Math.round(look.opacity * 100));
      pagesInput.value = pages;
      opacityValue.textContent = opacity.value;
    },
    focus() {
      text.focus();
    },
  };
  return settings;
}
