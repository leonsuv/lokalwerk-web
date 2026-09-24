/**
 * Startseite: Die große Ablagefläche öffnet das passende Werkzeug mit der Datei (plan.md
 * Schritt 9). Eine Datei lässt sich nicht über einen Seitenwechsel mitnehmen, ohne sie im
 * Browser zu speichern (AGENTS.md Regel 5). Deshalb wechselt die Seite ohne Neuladen: Sie
 * setzt den Inhalt des Werkzeugs ein (dieselbe main.html wie die Werkzeugseite), ändert
 * Titel und Adresse und übergibt die Dateien im Arbeitsspeicher. Die Zurück-Taste lädt die
 * Startseite neu. Werkzeug und Bibliotheken werden erst beim Ablegen geladen (plan.md A5).
 */

import { PAGES, SITE_URL } from '../../../build/pages.ts';
import { classifyDrop, type DropTarget } from '../../core/files/classify.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { showToast } from '../../ui/toast.ts';

interface Tool {
  url: string;
  markup: () => Promise<string>;
  open: () => Promise<(files: File[]) => unknown>;
}

const TOOLS: Record<DropTarget, Tool> = {
  pdf: {
    url: '/pdf-zusammenfuegen/',
    markup: async () => (await import('../pdf-zusammenfuegen/main.html?raw')).default,
    open: async () => (await import('../pdf-zusammenfuegen/page.ts')).addFiles,
  },
  images: {
    url: '/fotos-verkleinern/',
    markup: async () => (await import('../fotos-verkleinern/main.html?raw')).default,
    open: async () => (await import('../fotos-verkleinern/page.ts')).addFiles,
  },
  sepa: {
    url: '/sepa-sammelueberweisung/',
    markup: async () => (await import('../sepa-sammelueberweisung/main.html?raw')).default,
    open: async () => (await import('../sepa-sammelueberweisung/page.ts')).openFiles,
  },
};

function updateHead(url: string): void {
  const page = PAGES.find((p) => p.url === url);
  if (!page) return;
  document.title = page.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  // Wie auf der Werkzeugseite selbst (build/html-partials.ts): immer die öffentliche Adresse.
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE_URL + page.url);
}

async function openTool(target: DropTarget, files: File[]): Promise<void> {
  const tool = TOOLS[target];
  let markup: string;
  let open: (files: File[]) => unknown;
  try {
    // Erst den Inhalt laden und einsetzen: Das Werkzeug sucht beim Laden seine Elemente.
    markup = await tool.markup();
    // Festes Markup aus dem eigenen Build, keine Nutzerdaten.
    $('main').innerHTML = markup;
    open = await tool.open();
  } catch {
    showToast(
      'Das Werkzeug konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.',
    );
    return;
  }
  history.pushState({ tool: target }, '', tool.url);
  updateHead(tool.url);
  window.scrollTo(0, 0);
  const heading = $('main h1');
  heading.tabIndex = -1;
  heading.focus();
  await open(files);
}

window.addEventListener('popstate', () => location.reload());

preventAccidentalFileOpen();
wireDropzone($('#home-drop'), $<HTMLInputElement>('#home-input'), (files) => {
  const result = classifyDrop(files);
  if (!result.ok) {
    showToast('Bitte nur eine Dateiart auf einmal: PDFs, Fotos oder eine Excel-/CSV-Liste.');
    return;
  }
  void openTool(result.target, files);
});
