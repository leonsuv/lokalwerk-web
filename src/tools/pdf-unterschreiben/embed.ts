/**
 * „Unterschrift einfügen“ in der PDF-Werkstatt (plan-phase3.md 7.2, Schritt 2.2): Unterschrift
 * erstellen wie auf der Werkzeugseite (creator.ts, Markup aus deren main.html, samt Hinweis zur
 * rechtlichen Einordnung), platzieren im Dialog der Werkstatt. Das Ergebnis sind Rechtecke auf
 * einer Seite; die Werkstatt hängt sie als Seiten-Operation an die Seite.
 *
 * Lädt weder den Worker noch pdf-lib oder pdf.js der Werkzeugseite (die stecken in page.ts).
 */

import type { NormRect } from '../../core/geometry/norm-rect.ts';
import type { SignatureImage as StoredSignature } from '../../core/workshop/model.ts';
import type { MountTool } from '../../ui/tool-host.ts';
import { signatureCreator } from './creator.ts';
import markup from './main.html?raw';

export interface SignatureResult {
  /** null: Unterschriften der Seite entfernen */
  image: StoredSignature | null;
  /** Rechtecke, wie die Seite angezeigt wird */
  rects: NormRect[];
}

export interface SignatureToolOptions {
  labels: { place: string; remove: string; needed: string; hint: string };
  /** Neue Kennung für ein Unterschriftsbild */
  newId: () => string;
  /** Dialog zum Platzieren; Rechtecke nach „Übernehmen“, null nach „Abbrechen“ */
  place: (
    image: { url: string; width: number; height: number },
    rects: readonly NormRect[],
  ) => Promise<NormRect[] | null>;
  notify: (message: string) => void;
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

export function signatureTool(options: SignatureToolOptions): MountTool<SignatureResult> {
  return (host) => {
    const { labels } = options;
    const needed = document.createElement('p');
    needed.className = 'hint';
    needed.textContent = labels.needed;
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = labels.hint;
    const place = button(labels.place, 'btn wide mt-m');
    const remove = button(labels.remove, 'btn ghost wide mt-s');
    remove.hidden = host.current === null;
    const cancel = button(CANCEL, 'btn ghost wide mt-s');
    host.root.replaceChildren(
      fromMarkup('#sig-settings', '#sig-legal'),
      hint,
      needed,
      place,
      remove,
      cancel,
    );

    const existing = host.current?.image ?? null;
    const update = () => {
      const ready = creator.signature !== null || existing !== null;
      place.disabled = !ready;
      needed.hidden = ready;
    };
    const creator = signatureCreator(host.root, update, options.notify);
    update();

    place.addEventListener('click', () => {
      const drawn = creator.signature;
      // Ohne neue Unterschrift: die vorhandene der Seite weiter verwenden (nur verschieben)
      const url =
        drawn?.url ??
        (existing
          ? URL.createObjectURL(
              new Blob([existing.png as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
            )
          : null);
      const size = drawn ?? existing;
      if (!url || !size) return;
      void options
        .place({ url, width: size.width, height: size.height }, host.current?.rects ?? [])
        .then((rects) => {
          if (!drawn) URL.revokeObjectURL(url);
          if (rects === null) return;
          const image: StoredSignature | null = drawn
            ? { id: options.newId(), png: drawn.png, width: drawn.width, height: drawn.height }
            : existing;
          creator.dispose();
          host.apply({ image: rects.length > 0 ? image : null, rects });
        });
    });
    remove.addEventListener('click', () => {
      creator.dispose();
      host.apply({ image: null, rects: [] });
    });
    cancel.addEventListener('click', () => {
      creator.dispose();
      host.cancel();
    });
    return { focus: () => creator.focus(), dispose: () => creator.dispose() };
  };
}
