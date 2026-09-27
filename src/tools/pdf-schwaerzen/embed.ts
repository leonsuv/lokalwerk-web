/**
 * „PDF schwärzen“ in der PDF-Werkstatt (plan-phase3.md 7.2, Schritt 2.3): Auflösung und Zähler
 * aus der Werkzeugseite (main.html, #red-settings) und deren Prüfhinweis; die Bereiche legt ein
 * Dialog der Werkstatt fest, das Rastern übernimmt die Werkstatt (`bake`). Das Ergebnis ist die
 * neue, geschwärzte Quelle; die Werkstatt setzt das Dokument darauf um („Einbacken“).
 *
 * Lädt weder den Worker noch pdf.js der Werkzeugseite (die stecken in page.ts).
 */

import type { NormRect } from '../../core/geometry/norm-rect.ts';
import type { PageKey } from '../../core/workshop/model.ts';
import type { MountTool } from '../../ui/tool-host.ts';
import markup from './main.html?raw';

export type RedactAreas = ReadonlyMap<PageKey, readonly NormRect[]>;

export interface RedactToolOptions<Result> {
  labels: {
    hint: string;
    areas: string;
    apply: string;
    progress: (done: number, total: number) => string;
    building: string;
  };
  /** Dialog zum Festlegen der Bereiche; null nach „Abbrechen“ */
  areas: (current: RedactAreas) => Promise<RedactAreas | null>;
  /** Rastert und baut die neue PDF; `progress(fertig, alle)`, fertig = alle beim Bauen */
  bake: (
    areas: RedactAreas,
    dpi: number,
    progress: (done: number, total: number) => void,
  ) => Promise<Result>;
  /** Ergebnis verwerfen, wenn das Werkzeug während des Rasterns geschlossen wurde */
  discard: (result: Result) => void;
  /** Fehler beim Rastern oder Bauen melden */
  failed: (error: unknown) => void;
}

const CANCEL = 'Abbrechen';

function fromMarkup(...selectors: string[]): DocumentFragment {
  const template = document.createElement('template');
  // Festes Markup aus dem eigenen Build, keine Nutzerdaten.
  template.innerHTML = markup;
  const fragment = document.createDocumentFragment();
  for (const selector of selectors) {
    const el = template.content.querySelector(selector);
    if (!el) throw new Error(`${selector} fehlt in main.html`);
    fragment.append(el);
  }
  return fragment;
}

function button(label: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

export function redactTool<Result>(options: RedactToolOptions<Result>): MountTool<Result> {
  return (host) => {
    const { labels } = options;
    const hint = document.createElement('p');
    hint.className = 'hint mt-m';
    hint.textContent = labels.hint;
    const areasButton = button(labels.areas, 'btn ghost wide mt-m');
    const apply = button(labels.apply, 'btn wide');
    const cancel = button(CANCEL, 'btn ghost wide mt-s');
    host.root.replaceChildren(
      fromMarkup('#red-settings'),
      hint,
      areasButton,
      fromMarkup('#red-check'),
      apply,
      cancel,
    );
    const q = <T extends HTMLElement>(selector: string) => {
      const el = host.root.querySelector<T>(selector);
      if (!el) throw new Error(`${selector} fehlt`);
      return el;
    };
    const dpi = q<HTMLSelectElement>('#red-dpi');

    let areas: RedactAreas = new Map();
    let busy = false;
    let closed = false;
    const render = () => {
      const lists = [...areas.values()];
      const count = lists.reduce((sum, list) => sum + list.length, 0);
      q('#red-count').textContent = String(count);
      q('#red-pages').textContent = String(lists.filter((l) => l.length > 0).length);
      apply.disabled = busy || count === 0;
      areasButton.disabled = busy;
      dpi.disabled = busy;
    };
    render();

    areasButton.addEventListener('click', () => {
      void options.areas(areas).then((next) => {
        if (next) areas = next;
        render();
        areasButton.focus();
      });
    });
    apply.addEventListener('click', () => {
      busy = true;
      render();
      const progress = (done: number, total: number) => {
        apply.textContent = done < total ? labels.progress(done + 1, total) : labels.building;
      };
      options.bake(areas, Number(dpi.value), progress).then(
        (result) => {
          if (closed) options.discard(result);
          else host.apply(result);
        },
        (error: unknown) => {
          busy = false;
          apply.textContent = labels.apply;
          render();
          if (!closed) options.failed(error);
        },
      );
    });
    cancel.addEventListener('click', () => host.cancel());
    return {
      focus: () => dpi.focus(),
      dispose: () => {
        closed = true;
      },
    };
  };
}
