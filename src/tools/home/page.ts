/**
 * Startseite: Die große Ablagefläche öffnet ein Werkzeug mit der Datei (plan.md Schritt 9).
 * Passen mehrere Werkzeuge zur Dateiart, wählt man zuerst eines aus (plan-phase2.md
 * Abschnitt 3.4); passt genau eines, öffnet es sich sofort.
 *
 * Eine Datei lässt sich nicht über einen Seitenwechsel mitnehmen, ohne sie im Browser zu
 * speichern (AGENTS.md Regel 5). Deshalb wechselt die Seite ohne Neuladen: Sie setzt den
 * Inhalt des Werkzeugs ein (dieselbe main.html wie die Werkzeugseite), ändert Titel und
 * Adresse und übergibt die Dateien im Arbeitsspeicher. Die Zurück-Taste lädt die Startseite
 * neu. Werkzeug und Bibliotheken werden erst beim Öffnen geladen (plan.md A5).
 */

import { SITE_URL, TOOL_PAGES, toolById, type ToolPage } from '../../../build/pages.ts';
import { renderRelated } from '../../../build/tool-blocks.ts';
import { describeDrop, dropKind, toolsForDrop } from '../../core/files/classify.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { showToast } from '../../ui/toast.ts';
import { LOADERS } from './loaders.ts';

const drop = $('#home-drop');
const choice = $('#home-choice');
const choiceTitle = $('#home-choice-title');
const choiceList = $<HTMLUListElement>('#home-choice-list');

/** Dateien, zu denen gerade die Auswahl angezeigt wird */
let pending: File[] = [];

function updateHead(page: ToolPage): void {
  document.title = page.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  // Wie auf der Werkzeugseite selbst (build/html-partials.ts): immer die öffentliche Adresse.
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE_URL + page.url);
}

async function openTool(id: string, files: File[]): Promise<void> {
  const page = toolById(id);
  const loader = LOADERS[id];
  if (!page || !loader) return;
  let open: (files: File[]) => unknown;
  try {
    // Erst den Inhalt laden und einsetzen: Das Werkzeug sucht beim Laden seine Elemente.
    const markup = await loader.markup();
    // Festes Markup aus dem eigenen Build und dem Register, keine Nutzerdaten.
    $('main').innerHTML = markup + renderRelated(page);
    open = await loader.open();
  } catch {
    showToast(
      'Das Werkzeug konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.',
    );
    return;
  }
  history.pushState({ tool: id }, '', page.url);
  updateHead(page);
  window.scrollTo(0, 0);
  const heading = $('main h1');
  heading.tabIndex = -1;
  heading.focus();
  await open(files);
}

function choiceButton(page: ToolPage): HTMLLIElement {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `choice-btn ${page.tool.category}`;
  button.dataset.tool = page.tool.id;
  // Festes Markup, Symbol-ID aus dem Register; der HTML-Parser setzt den SVG-Namensraum.
  button.innerHTML = `<span class="ic"><svg width="22" height="22" aria-hidden="true"><use href="#${page.tool.icon}" /></svg></span>`;
  const text = document.createElement('span');
  text.className = 'txt';
  const name = document.createElement('b');
  name.textContent = page.tool.name;
  const short = document.createElement('span');
  short.textContent = page.tool.short;
  text.append(name, short);
  button.append(text);
  li.append(button);
  return li;
}

function showChoice(files: File[], title: string, tools: readonly ToolPage[]): void {
  pending = files;
  choiceTitle.textContent = title;
  choiceList.replaceChildren(...tools.map(choiceButton));
  drop.hidden = true;
  choice.hidden = false;
  choiceTitle.focus();
}

function hideChoice(): void {
  pending = [];
  choice.hidden = true;
  drop.hidden = false;
  $<HTMLInputElement>('#home-input').focus();
}

choiceList.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tool]');
  if (button?.dataset.tool) void openTool(button.dataset.tool, pending);
});
$('#home-choice-back').addEventListener('click', hideChoice);

window.addEventListener('popstate', () => location.reload());

preventAccidentalFileOpen();
wireDropzone(drop, $<HTMLInputElement>('#home-input'), (files) => {
  const result = dropKind(files);
  if (!result.ok) {
    showToast('Bitte nur eine Dateiart auf einmal: PDFs, Fotos oder eine Excel-/CSV-Liste.');
    return;
  }
  const described = describeDrop(result.kind, result.count);
  const tools = toolsForDrop(
    TOOL_PAGES.map((p) => p.tool),
    result.kind,
    result.count,
  ).flatMap((t) => toolById(t.id) ?? []);
  const [only] = tools;
  if (!only) {
    showToast(`Für ${described} auf einmal gibt es kein Werkzeug. Lege nur eine Datei ab.`);
    return;
  }
  if (tools.length === 1) {
    void openTool(only.tool.id, files);
    return;
  }
  showChoice(files, `${described} ausgewählt`, tools);
});
