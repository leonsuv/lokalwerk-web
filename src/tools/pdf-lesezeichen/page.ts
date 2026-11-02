/**
 * Werkzeugseite „PDF-Lesezeichen bearbeiten“. Die Liste bearbeitet diese Datei mit den reinen
 * Funktionen aus src/core/pdf/bookmark-model.ts; Lesen und Schreiben der PDF laufen im Worker.
 * Nichts wird gespeichert, bevor der Nutzer „Bearbeitete PDF speichern“ drückt (AGENTS.md Regel 5).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import {
  addEntry,
  BookmarkError,
  type BookmarkEntry,
  canIndent,
  canOutdent,
  deleteEntry,
  indentEntry,
  outdentEntry,
  renameEntry,
  subtreeEnd,
} from '../../core/pdf/bookmark-model.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { BookmarkReadResult, BookmarkRequest } from './bookmarks.worker.ts';

const MESSAGES: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory': 'Nicht genug Arbeitsspeicher für diese PDF.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'empty-title': 'Gib einen Titel ein. Ohne Titel sieht man das Lesezeichen nicht.',
  'title-too-long': 'Der Titel ist zu lang. Erlaubt sind höchstens 255 Zeichen.',
  'invalid-outline': 'Die Liste ist nicht mehr gültig. Lade die Seite neu und fang noch einmal an.',
  'too-large':
    'Die Gliederung ist zu groß für dieses Werkzeug. Es schafft höchstens 5.000 Lesezeichen.',
  'too-deep': 'Die Gliederung ist zu tief verschachtelt für dieses Werkzeug.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageForCode = (code: string | undefined): string =>
  (code !== undefined ? MESSAGES[code] : undefined) ?? FALLBACK;

const codeOf = (error: unknown): string | undefined =>
  error instanceof WorkerError || error instanceof BookmarkError ? error.code : undefined;

// Worker sofort starten: lädt pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./bookmarks.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<BookmarkRequest>(worker);

const fileList = $<HTMLUListElement>('#bm-file');
const panel = $('#bm-panel');
const listEl = $<HTMLOListElement>('#bm-list');
const addForm = $<HTMLFormElement>('#bm-add');
const newTitle = $<HTMLInputElement>('#bm-new-title');
const newPage = $<HTMLInputElement>('#bm-new-page');
const addSubmit = $<HTMLButtonElement>('#bm-add-submit');
const insertHint = $('#bm-insert-hint');
const insertEnd = $<HTMLButtonElement>('#bm-insert-end');
const msg = $('#bm-msg');
const saveButton = $<HTMLButtonElement>('#bm-save');
const saveLabel = $('#bm-save-label');
const clearButton = $<HTMLButtonElement>('#bm-clear');
const idleLabel = saveLabel.textContent ?? '';

interface Loaded {
  state: 'ok';
  file: File;
  pages: number;
  entries: BookmarkEntry[];
}
type Current =
  { state: 'checking'; file: File } | Loaded | { state: 'error'; file: File; error: string };

let current: Current | null = null;
let busy = false;
/** Nach welchem Eintrag das neue Lesezeichen kommt (samt Unterpunkten); null = ans Ende */
let insertAfter: number | null = null;

type Action = 'up' | 'down' | 'insert' | 'delete';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Symbol aus der Sprite-Datei, wie überall im Projekt */
function icon(id: string): HTMLElement {
  const span = el('span');
  span.innerHTML = `<svg width="16" height="16" aria-hidden="true"><use href="#${id}" /></svg>`;
  return span;
}

function showMessage(text: string): void {
  msg.textContent = text;
}

function fileRow(entry: Current): HTMLLIElement {
  const li = el('li');
  const num = el('span', 'num', '1');
  const meta = el('div', 'meta');
  const name = el('b', undefined, entry.file.name);
  const info = el('span');
  const size = formatBytes(entry.file.size);
  if (entry.state === 'checking') info.textContent = `${size}, wird geprüft …`;
  if (entry.state === 'ok') {
    info.textContent = `${entry.pages} ${entry.pages === 1 ? 'Seite' : 'Seiten'}, ${size}`;
  }
  if (entry.state === 'error') {
    const error = el('span', 'err', entry.error);
    info.append(`${size}, `, error);
  }
  meta.append(name, info);
  li.append(num, meta);
  return li;
}

function updateInsertHint(entries: BookmarkEntry[]): void {
  const target = insertAfter !== null ? entries[insertAfter] : undefined;
  insertEnd.hidden = target === undefined;
  insertHint.textContent =
    target === undefined
      ? 'Es kommt ans Ende der Liste.'
      : `Es kommt nach „${target.title || 'ohne Titel'}“, auf dieselbe Ebene.`;
}

function summary(loaded: Loaded): string {
  const count = loaded.entries.length;
  const unresolved = loaded.entries.filter((e) => e.page === null).length;
  const parts = [`${count} Lesezeichen`];
  if (unresolved > 0) parts.push(`${unresolved} ohne gefundenes Ziel`);
  return `${parts.join(', ')}. ${loaded.pages} ${loaded.pages === 1 ? 'Seite' : 'Seiten'}.`;
}

/** Eine Zeile der Liste mit Titel, Ebene, Ziel und den vier Aktionen. */
function row(entries: BookmarkEntry[], entry: BookmarkEntry, index: number): HTMLLIElement {
  const li = el('li', 'bm-row');
  li.style.paddingInlineStart = `${entry.level * 1.5}rem`;

  const main = el('div', 'bm-main');
  const input = el('input');
  input.type = 'text';
  input.maxLength = 255;
  input.value = entry.title;
  input.placeholder = 'ohne Titel';
  input.dataset.index = String(index);
  input.setAttribute('aria-label', `Titel von Lesezeichen ${index + 1}`);
  input.addEventListener('change', () => onRename(index, input.value));

  const info = el('span', 'bm-info');
  const level = `Ebene ${entry.level + 1}`;
  if (entry.page === null) {
    info.classList.add('err');
    info.textContent = `${level} · Ziel nicht gefunden`;
  } else {
    info.textContent = `${level} · Seite ${entry.page + 1}`;
  }
  main.append(input, info);

  const actions = el('div', 'bm-actions');
  const name = entry.title || 'ohne Titel';
  const button = (action: Action, iconId: string, label: string, enabled: boolean) => {
    const b = el('button', 'btn icon sm');
    b.type = 'button';
    b.dataset.action = action;
    b.dataset.index = String(index);
    b.title = label;
    b.setAttribute('aria-label', `${label}: ${name}`);
    b.disabled = !enabled;
    b.append(icon(iconId));
    b.addEventListener('click', () => onAction(action, index));
    return b;
  };
  actions.append(
    button('up', 'i-left', 'Eine Ebene höher', canOutdent(entries, index)),
    button('down', 'i-right', 'Eine Ebene tiefer', canIndent(entries, index)),
    button('insert', 'i-plus', 'Neues Lesezeichen darunter einfügen', true),
    button('delete', 'i-x', 'Lesezeichen löschen', true),
  );
  li.append(main, actions);
  return li;
}

/** Liste neu aufbauen; `focus` setzt den Fokus danach wieder auf dieselbe Aktion. */
function renderList(focus?: { index: number; action: Action | 'title' }): void {
  if (current?.state !== 'ok') return;
  const { entries } = current;
  listEl.replaceChildren(...entries.map((entry, i) => row(entries, entry, i)));
  $('#bm-none').hidden = entries.length > 0;
  $('#bm-unresolved').hidden = !entries.some((e) => e.page === null);
  updateInsertHint(entries);
  if (!focus) return;
  const index = Math.min(focus.index, entries.length - 1);
  if (index < 0) {
    newTitle.focus();
    return;
  }
  const target =
    focus.action === 'title'
      ? listEl.querySelector<HTMLElement>(`input[data-index="${index}"]`)
      : (listEl.querySelector<HTMLButtonElement>(
          `button[data-action="${focus.action}"][data-index="${index}"]`,
        ) ?? listEl.querySelector<HTMLElement>(`input[data-index="${index}"]`));
  target?.focus();
}

function render(): void {
  const ok = current?.state === 'ok' ? current : null;
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#bm-empty').hidden = current !== null;
  panel.hidden = ok === null;
  $('#bm-summary').textContent = ok
    ? summary(ok)
    : 'Lade eine PDF, dann siehst du hier die Anzahl.';
  if (ok) newPage.max = String(ok.pages);
  saveButton.disabled = busy || ok === null;
  addSubmit.disabled = busy || ok === null;
  clearButton.disabled = busy || current === null;
  if (ok) renderList();
}

/** Ändert die Liste; bei Fehler bleibt sie unverändert und die Meldung erscheint. */
function apply(next: () => BookmarkEntry[]): boolean {
  if (current?.state !== 'ok') return false;
  try {
    const entries = next();
    current = { ...current, entries };
    return true;
  } catch (error) {
    showMessage(messageForCode(codeOf(error)));
    return false;
  }
}

function onRename(index: number, raw: string): void {
  if (current?.state !== 'ok') return;
  const { entries } = current;
  if (!apply(() => renameEntry(entries, index, raw))) {
    // Titel zurücksetzen, damit das Feld wieder zeigt, was gespeichert ist
    renderList({ index, action: 'title' });
    return;
  }
  showMessage('');
  if (current?.state === 'ok') updateInsertHint(current.entries);
}

function onAction(action: Action, index: number): void {
  if (current?.state !== 'ok') return;
  const { entries } = current;
  showMessage('');
  if (action === 'insert') {
    insertAfter = index;
    updateInsertHint(entries);
    newTitle.focus();
    return;
  }
  if (action === 'delete') {
    insertAfter = null;
    apply(() => deleteEntry(entries, index));
    renderList({ index, action: 'title' });
    return;
  }
  insertAfter = null;
  const next = action === 'up' ? outdentEntry(entries, index) : indentEntry(entries, index);
  current = { ...current, entries: next };
  renderList({ index, action });
}

addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (current?.state !== 'ok') return;
  const { entries, pages } = current;
  const page = Number(newPage.value);
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    showMessage(`Die Seite gibt es nicht. Die PDF hat ${pages} Seiten.`);
    return;
  }
  const after = insertAfter;
  if (!apply(() => addEntry(entries, after, { title: newTitle.value, page: page - 1 }, pages))) {
    return;
  }
  const at =
    after === null || after >= entries.length - 1 ? entries.length : subtreeEnd(entries, after);
  insertAfter = null;
  newTitle.value = '';
  showMessage('');
  renderList({ index: at, action: 'title' });
});

insertEnd.addEventListener('click', () => {
  insertAfter = null;
  if (current?.state === 'ok') updateInsertHint(current.entries);
  newTitle.focus();
});

async function inspect(file: File): Promise<void> {
  current = { state: 'checking', file };
  insertAfter = null;
  showMessage('');
  render();
  try {
    const result = await client.request<BookmarkReadResult>({ type: 'inspect', file });
    if (current?.file !== file) return;
    current = { state: 'ok', file, pages: result.pages, entries: result.entries };
  } catch (error) {
    if (current?.file !== file) return;
    current = { state: 'error', file, error: messageForCode(codeOf(error)) };
  }
  render();
}

export function openFiles(files: File[]): void {
  const [file] = files.filter(isPdf);
  if (!file) {
    showToast('Nur PDF-Dateien werden übernommen.');
    return;
  }
  if (files.length > 1) showToast('Es wird eine PDF auf einmal bearbeitet: die erste.');
  void inspect(file);
}

async function save(): Promise<void> {
  if (current?.state !== 'ok') return;
  const { file, entries } = current;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({ type: 'save', file, entries });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-lesezeichen.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die neue PDF mit den bearbeiteten Lesezeichen ist gespeichert.');
  } catch (error) {
    showToast(messageForCode(codeOf(error)));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  current = null;
  insertAfter = null;
  showMessage('');
  render();
  $<HTMLInputElement>('#bm-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#bm-drop'), $<HTMLInputElement>('#bm-input'), openFiles);
render();
