/**
 * „Stempel und Wasserzeichen“ in der PDF-Werkstatt (plan-phase3.md 7.2, Schritt 2.2): dieselben
 * Einstellungen wie auf der Werkzeugseite, aus deren main.html übernommen. Das Ergebnis ist ein
 * Stempel für die angegebenen Seiten des Dokuments; die Werkstatt hängt ihn als
 * Seiten-Operation an diese Seiten, gesetzt wird er beim Speichern.
 *
 * Lädt weder den Worker noch pdf-lib der Werkzeugseite (die stecken in page.ts).
 */

import { rangeLabel, type PageRange } from '../../core/pdf/page-ranges.ts';
import type { MountTool } from '../../ui/tool-host.ts';
import markup from './main.html?raw';
import { stampSettings, type StampLook } from './settings.ts';

export interface StampResult {
  look: StampLook;
  /** Seiten des Dokuments (ab 1); leer heißt alle */
  ranges: PageRange[];
}

const APPLY = 'Stempel übernehmen';
const REMOVE = 'Stempel entfernen';
const CANCEL = 'Abbrechen';
const HINT =
  'Der Stempel gehört zu den Seiten und wandert mit, wenn du sie verschiebst. Gesetzt wird er beim Speichern.';

function settingsMarkup(): DocumentFragment {
  const template = document.createElement('template');
  // Festes Markup aus dem eigenen Build, keine Nutzerdaten.
  template.innerHTML = markup;
  const settings = template.content.querySelector('#stamp-settings');
  if (!settings) throw new Error('#stamp-settings fehlt in main.html');
  const fragment = document.createDocumentFragment();
  fragment.append(settings);
  return fragment;
}

function button(label: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

/**
 * `charset`: Zeichenvorrat der PDF-Schrift (vom Werkstatt-Worker); bis er da ist, wird nur auf
 * leeren Text geprüft. `pages`: Vorbelegung des Felds „Seiten“, z. B. aus der Auswahl.
 */
export function stampTool(options: {
  charset: Promise<ReadonlySet<number>>;
  pages: readonly PageRange[];
}): MountTool<StampResult> {
  return (host) => {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = HINT;
    const apply = button(APPLY, 'btn wide mt-m');
    const remove = button(REMOVE, 'btn ghost wide mt-s');
    remove.hidden = host.current === null;
    const cancel = button(CANCEL, 'btn ghost wide mt-s');
    host.root.replaceChildren(settingsMarkup(), hint, apply, remove, cancel);

    let charset: ReadonlySet<number> | null = null;
    const update = () => {
      apply.disabled = !settings.validate(host.target.pages, charset);
    };
    const settings = stampSettings(host.root, update);
    const pages = options.pages.map(rangeLabel).join(', ');
    if (host.current) settings.set(host.current.look, pages);
    else if (pages) settings.set(settings.look(), pages);
    update();
    void options.charset.then(
      (set) => {
        charset = set;
        if (host.root.isConnected) update();
      },
      () => undefined,
    );

    apply.addEventListener('click', () => {
      if (!settings.validate(host.target.pages, charset)) return;
      const result = settings.pagesResult(host.target.pages);
      if ('error' in result) return;
      host.apply({ look: settings.look(), ranges: result.ranges });
    });
    remove.addEventListener('click', () => host.apply(null));
    cancel.addEventListener('click', () => host.cancel());
    return { focus: () => settings.focus() };
  };
}
