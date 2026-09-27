/**
 * „Seitenzahlen einfügen“ in der PDF-Werkstatt (plan-phase3.md 7.1 und 7.2, Schritt 2.1):
 * dieselben Einstellungen wie auf der Werkzeugseite, aus deren main.html übernommen. Statt zu
 * speichern, gibt das Werkzeug die Einstellung als Dokument-Operation an die Werkstatt zurück;
 * gezeichnet wird beim Export auf die dann gültige Seitenfolge.
 *
 * Lädt weder den Worker noch pdf-lib der Werkzeugseite (die stecken in page.ts).
 */

import type { PageNumberOptions } from '../../core/pdf/page-numbers.ts';
import type { MountTool } from '../../ui/tool-host.ts';
import markup from './main.html?raw';
import { numberSettings } from './settings.ts';

const APPLY = 'Seitenzahlen übernehmen';
const REMOVE = 'Seitenzahlen entfernen';
const CANCEL = 'Abbrechen';
const HINT =
  'Die Seitenzahlen werden beim Speichern gesetzt und zählen die Seiten in der Reihenfolge, die das Dokument dann hat.';

/** Die Einstellungen aus dem Markup der Werkzeugseite, als eigene Kopie */
function settingsMarkup(): DocumentFragment {
  const template = document.createElement('template');
  // Festes Markup aus dem eigenen Build, keine Nutzerdaten.
  template.innerHTML = markup;
  const settings = template.content.querySelector('#num-settings');
  if (!settings) throw new Error('#num-settings fehlt in main.html');
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

export const mountPageNumbers: MountTool<PageNumberOptions> = (host) => {
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = HINT;
  const apply = button(APPLY, 'btn wide mt-m');
  const remove = button(REMOVE, 'btn ghost wide mt-s');
  remove.hidden = host.current === null;
  const cancel = button(CANCEL, 'btn ghost wide mt-s');
  host.root.replaceChildren(settingsMarkup(), hint, apply, remove, cancel);

  const settings = numberSettings(host.root, () => {
    apply.disabled = typeof settings.validate(host.target.pages) === 'string';
  });
  if (host.current) settings.set(host.current);
  apply.disabled = typeof settings.validate(host.target.pages) === 'string';

  apply.addEventListener('click', () => {
    const result = settings.validate(host.target.pages);
    if (typeof result !== 'string') host.apply(result);
  });
  remove.addEventListener('click', () => host.apply(null));
  cancel.addEventListener('click', () => host.cancel());
  return { focus: () => settings.focus() };
};
