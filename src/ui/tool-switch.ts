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

import type { ToolPage } from '../../build/pages.ts';
import { renderRelated } from '../../build/tool-blocks.ts';
import { $ } from './dom.ts';

export interface ToolLoader {
  markup: () => Promise<string>;
  open: () => Promise<(files: File[]) => unknown>;
}

function updateHead(page: ToolPage): void {
  document.title = page.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  // Wie auf der Werkzeugseite selbst (build/html-partials.ts): die beim Build gesetzte
  // öffentliche Adresse, nur mit dem Pfad des Werkzeugs.
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = new URL(page.url, canonical.href).href;
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', page.title);
  document
    .querySelector('meta[property="og:description"]')
    ?.setAttribute('content', page.description);
  if (canonical)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical.href);
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
