/**
 * Knopf „In der PDF-Werkstatt weiterbearbeiten“ in den Einzelwerkzeugen (plan-phase3.md 5.2):
 * erscheint, sobald das Werkzeug eine Datei geladen hat, und wechselt ohne Neuladen in die
 * Werkstatt, mit den Dateien im Arbeitsspeicher (W1). Die Werkstatt selbst wird erst beim Klick
 * geladen; statisch eingebunden ist nur dieser Knopf (chunk-guard).
 */

import type { WorkshopHandover } from '../core/workshop/export-plan.ts';
import type { PagePick } from '../core/workshop/model.ts';
import { showToast } from './toast.ts';

const LABEL = 'In der PDF-Werkstatt weiterbearbeiten';
const FAILED =
  'Die PDF-Werkstatt konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.';

/**
 * Legt den Knopf unten in der rechten Spalte des Werkzeugs an. Die zurückgegebene Funktion
 * setzt die Dateien, die übergeben werden; ohne Dateien ist der Knopf ausgeblendet. `layouts`
 * gibt je Datei Reihenfolge, Drehung und gelöschte Seiten mit (PDF-Seiten bearbeiten).
 * `handover` legt Einstellungen der Werkstatt fest (PDF-Metadaten entfernen: „Entfernen“).
 */
export function workshopLink(
  container: Element | null = document.querySelector('.workspace .side'),
  handover: WorkshopHandover = {},
): (files: readonly File[] | null, layouts?: ReadonlyMap<File, readonly PagePick[]>) => void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn ghost wide mt-s workshop-link';
  button.hidden = true;
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  button.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#i-workshop" /></svg>`;
  button.append(LABEL);
  container?.append(button);
  let files: readonly File[] = [];
  let pageLayouts: ReadonlyMap<File, readonly PagePick[]> | undefined;
  button.addEventListener('click', () => {
    button.disabled = true;
    void import('./workshop-switch.ts')
      .then(({ openInWorkshop }) => openInWorkshop([...files], pageLayouts, handover))
      .then((ok) => {
        if (!ok) showToast(FAILED);
      })
      .catch(() => showToast(FAILED))
      .finally(() => (button.disabled = false));
  });
  return (next, layouts) => {
    files = next ?? [];
    pageLayouts = layouts;
    button.hidden = files.length === 0;
  };
}
