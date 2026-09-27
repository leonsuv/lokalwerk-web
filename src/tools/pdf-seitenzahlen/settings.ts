/**
 * Einstellungen von „Seitenzahlen einfügen“ (Form, Position, Ab Seite, Erste Zahl, Größe,
 * Abstand): gemeinsam für die Werkzeugseite (page.ts) und die PDF-Werkstatt (embed.ts). Die
 * Elemente werden beim Einbinden gesucht, nicht beim Laden des Moduls (plan-phase3.md 7.1).
 */

import {
  checkPageNumberInput,
  type NumberFormat,
  type PageNumberOptions,
} from '../../core/pdf/page-numbers.ts';
import type { Anchor } from '../../core/pdf/stamp-geometry.ts';

const IDS = ['#num-from', '#num-start', '#num-format', '#num-anchor', '#num-size', '#num-margin'];

export interface NumberSettings {
  /** Einstellungen für ein Dokument mit `pages` Seiten, oder die Fehlermeldung */
  read(pages: number): PageNumberOptions | string;
  /** Zeigt die Fehlermeldung (oder keine) an den Feldern und gibt das Ergebnis von `read` zurück */
  validate(pages: number): PageNumberOptions | string;
  /** Keine Fehlermeldung anzeigen (z. B. solange keine PDF geladen ist) */
  clearError(): void;
  /** Übernimmt vorhandene Einstellungen in die Felder */
  set(options: PageNumberOptions): void;
  /** Fokus auf das erste Feld */
  focus(): void;
}

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element ${selector} fehlt`);
  return el;
}

/** Bindet die Felder unter `root` ein; `onChange` bei jeder Eingabe */
export function numberSettings(root: ParentNode, onChange: () => void): NumberSettings {
  const from = find<HTMLInputElement>(root, '#num-from');
  const start = find<HTMLInputElement>(root, '#num-start');
  const format = find<HTMLSelectElement>(root, '#num-format');
  const anchor = find<HTMLSelectElement>(root, '#num-anchor');
  const size = find<HTMLSelectElement>(root, '#num-size');
  const margin = find<HTMLSelectElement>(root, '#num-margin');
  const error = find<HTMLElement>(root, '#num-error');
  for (const id of IDS) {
    const el = find(root, id);
    el.addEventListener('input', onChange);
    el.addEventListener('change', onChange);
  }

  const read = (pages: number): PageNumberOptions | string => {
    const fromPage = Number(from.value);
    const startAt = Number(start.value);
    const problem = checkPageNumberInput(fromPage, startAt, pages);
    if (problem === 'from') return `„Ab Seite“ muss zwischen 1 und ${pages} liegen.`;
    if (problem === 'start') return '„Erste Zahl“ muss eine ganze Zahl ab 0 sein.';
    return {
      format: format.value as NumberFormat,
      anchor: anchor.value as Anchor,
      fromPage,
      startAt,
      fontSize: Number(size.value),
      marginMm: Number(margin.value),
    };
  };

  const showError = (message: string): void => {
    error.textContent = message;
    from.setAttribute('aria-invalid', String(message.startsWith('„Ab')));
    start.setAttribute('aria-invalid', String(message.startsWith('„Erste')));
  };

  return {
    read,
    validate(pages) {
      const result = read(pages);
      showError(typeof result === 'string' ? result : '');
      from.max = String(Math.max(1, pages));
      return result;
    },
    clearError() {
      showError('');
    },
    set(options) {
      format.value = options.format;
      anchor.value = options.anchor;
      from.value = String(options.fromPage);
      start.value = String(options.startAt);
      size.value = String(options.fontSize);
      margin.value = String(options.marginMm);
    },
    focus() {
      format.focus();
    },
  };
}
