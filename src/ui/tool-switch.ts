/**
 * Werkzeug öffnen ohne Neuladen (plan.md Schritt 9, plan-phase3.md 5.3, W1): Eine Datei lässt
 * sich nicht über einen Seitenwechsel mitnehmen, ohne sie im Browser zu speichern (AGENTS.md
 * Regel 5). Deshalb wird der Inhalt des Werkzeugs (dieselbe main.html wie auf seiner Seite) in
 * <main> eingesetzt, Titel, Beschreibung und Adresse werden geändert und die Dateien im
 * Arbeitsspeicher übergeben. Die Zurück-Taste lädt die vorige Seite neu.
 *
 * Genutzt von der Startseite und vom Knopf „In der PDF-Werkstatt weiterbearbeiten“ in den
 * Einzelwerkzeugen. Werkzeug und Bibliotheken werden erst hier geladen (plan.md A5).
 */

import { SITE_URL, type ToolPage } from '../../build/pages.ts';
import { renderRelated } from '../../build/tool-blocks.ts';
import { $ } from './dom.ts';

export interface ToolLoader {
  markup: () => Promise<string>;
  open: () => Promise<(files: File[]) => unknown>;
}

function updateHead(page: ToolPage): void {
  document.title = page.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  // Wie auf der Werkzeugseite selbst (build/html-partials.ts): immer die öffentliche Adresse.
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE_URL + page.url);
}

let listening = false;

/**
 * Wechselt zum Werkzeug und übergibt die Dateien. Gibt false zurück, wenn es nicht geladen
 * werden konnte (z. B. offline, bevor die Dateien des Werkzeugs im Browser-Cache lagen).
 */
export async function switchToTool(
  page: ToolPage,
  loader: ToolLoader,
  files: File[],
): Promise<boolean> {
  let open: (files: File[]) => unknown;
  try {
    // Erst den Inhalt laden und einsetzen: Das Werkzeug sucht beim Laden seine Elemente.
    const markup = await loader.markup();
    // Festes Markup aus dem eigenen Build und dem Register, keine Nutzerdaten.
    $('main').innerHTML = markup + renderRelated(page);
    open = await loader.open();
  } catch {
    return false;
  }
  history.pushState({ tool: page.tool.id }, '', page.url);
  if (!listening) {
    listening = true;
    window.addEventListener('popstate', () => location.reload());
  }
  updateHead(page);
  window.scrollTo(0, 0);
  const heading = $('main h1');
  heading.tabIndex = -1;
  heading.focus();
  await open(files);
  return true;
}
