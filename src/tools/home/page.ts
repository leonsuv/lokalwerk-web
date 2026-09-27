/**
 * Startseite: Die große Ablagefläche öffnet ein Werkzeug mit der Datei (plan.md Schritt 9).
 * Passen mehrere Werkzeuge zur Dateiart, wählt man zuerst eines aus (plan-phase2.md
 * Abschnitt 3.4); passt genau eines, öffnet es sich sofort. Bei PDFs steht die PDF-Werkstatt
 * zuerst in der Auswahl (W4); PDFs und Bilder gemischt öffnen gleich die Werkstatt (W9).
 *
 * Der Wechsel ohne Neuladen steht in src/ui/tool-switch.ts.
 */

import { TOOL_PAGES, toolById, type ToolPage } from '../../../build/pages.ts';
import { describeDrop, dropKind, isImage, isPdf, toolsForDrop } from '../../core/files/classify.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { showToast } from '../../ui/toast.ts';
import { switchToTool } from '../../ui/tool-switch.ts';
import { LOADERS } from './loaders.ts';

const drop = $('#home-drop');
const choice = $('#home-choice');
const choiceTitle = $('#home-choice-title');
const choiceList = $<HTMLUListElement>('#home-choice-list');

/** Dateien, zu denen gerade die Auswahl angezeigt wird */
let pending: File[] = [];

async function openTool(id: string, files: File[]): Promise<void> {
  const page = toolById(id);
  const loader = LOADERS[id];
  if (!page || !loader) return;
  if (!(await switchToTool(page, loader, files))) {
    showToast(
      'Das Werkzeug konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.',
    );
  }
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

preventAccidentalFileOpen();
wireDropzone(drop, $<HTMLInputElement>('#home-input'), (files) => {
  // PDFs und Bilder zusammen kann nur die PDF-Werkstatt (W9)
  const mixed =
    files.some(isPdf) && files.some(isImage) && files.every((f) => isPdf(f) || isImage(f));
  if (mixed) {
    void openTool('pdf-werkstatt', files);
    return;
  }
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
