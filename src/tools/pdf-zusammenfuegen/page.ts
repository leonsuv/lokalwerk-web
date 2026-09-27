/**
 * Werkzeugseite „PDFs zusammenfügen“. Die Arbeit mit pdf-lib läuft im Worker, diese Datei
 * kümmert sich nur um Liste, Reihenfolge und Meldungen.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { MergeProgress, MergeRequest, MergeResult } from './merge.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const MESSAGES: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory':
    'Nicht genug Arbeitsspeicher. Füge weniger oder kleinere PDFs auf einmal zusammen.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

interface Entry {
  id: number;
  file: File;
  state: 'checking' | 'ok' | 'error';
  pages: number;
  error: string;
}

// Worker sofort starten: lädt pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./merge.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<MergeRequest>(worker);

const list = $<HTMLUListElement>('#pdf-list');
const mergeButton = $<HTMLButtonElement>('#pdf-merge');
const mergeLabel = $('#pdf-merge-label');
const clearButton = $<HTMLButtonElement>('#pdf-clear');
const idleLabel = mergeLabel.textContent ?? '';

let entries: Entry[] = [];
let nextId = 1;
let merging = false;
let inspectQueue = Promise.resolve();

const validEntries = () => entries.filter((e) => e.state === 'ok');

function actionButton(
  entry: Entry,
  action: string,
  label: string,
  iconName: 'i-up' | 'i-down' | 'i-x',
  disabled: boolean,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn icon';
  button.dataset.action = action;
  button.dataset.id = String(entry.id);
  button.disabled = disabled || merging;
  button.setAttribute('aria-label', `${entry.file.name}: ${label}`);
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  button.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#${iconName}" /></svg>`;
  return button;
}

function row(entry: Entry, index: number): HTMLLIElement {
  const li = document.createElement('li');

  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(index + 1);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = entry.file.name;
  const info = document.createElement('span');
  const size = formatBytes(entry.file.size);
  if (entry.state === 'checking') info.textContent = `${size}, wird geprüft …`;
  if (entry.state === 'ok')
    info.textContent = `${entry.pages} ${entry.pages === 1 ? 'Seite' : 'Seiten'}, ${size}`;
  if (entry.state === 'error') {
    const error = document.createElement('span');
    error.className = 'err';
    error.textContent = entry.error;
    info.append(`${size}, `, error);
  }
  meta.append(name, info);

  li.append(
    num,
    meta,
    actionButton(entry, 'up', 'nach oben', 'i-up', index === 0),
    actionButton(entry, 'down', 'nach unten', 'i-down', index === entries.length - 1),
    actionButton(entry, 'remove', 'entfernen', 'i-x', false),
  );
  return li;
}

function render(): void {
  toWorkshop(validEntries().map((e) => e.file));
  list.replaceChildren(...entries.map(row));
  $('#pdf-empty').hidden = entries.length > 0;
  $('#pdf-count').textContent = String(entries.length);
  $('#pdf-pages').textContent = String(validEntries().reduce((sum, e) => sum + e.pages, 0));
  $('#pdf-size').textContent = formatBytes(entries.reduce((sum, e) => sum + e.file.size, 0));

  const checking = entries.some((e) => e.state === 'checking');
  mergeButton.disabled = merging || checking || validEntries().length < 2;
  clearButton.disabled = merging || entries.length === 0;
}

/** Nach dem Neuzeichnen den Tastaturfokus an derselben Stelle lassen. */
function restoreFocus(id: number, action: string): void {
  const buttons = [...list.querySelectorAll<HTMLButtonElement>(`button[data-id="${id}"]`)];
  const same = buttons.find((b) => b.dataset.action === action && !b.disabled);
  const fallback = buttons.find((b) => !b.disabled);
  (same ?? fallback)?.focus();
}

list.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button || merging) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action ?? '';
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return;

  if (action === 'remove') {
    entries.splice(i, 1);
    render();
    const next = entries[i] ?? entries[i - 1];
    if (next) restoreFocus(next.id, 'remove');
    else $<HTMLInputElement>('#pdf-input').focus();
    return;
  }
  const j = action === 'up' ? i - 1 : i + 1;
  const a = entries[i];
  const b = entries[j];
  if (!a || !b) return;
  entries[i] = b;
  entries[j] = a;
  render();
  restoreFocus(id, action);
});

async function inspect(entry: Entry): Promise<void> {
  try {
    entry.pages = await client.request<number>({ type: 'inspect', file: entry.file });
    entry.state = 'ok';
  } catch (error) {
    entry.state = 'error';
    entry.error = messageFor(error);
  }
  render();
}

export function addFiles(files: File[]): void {
  const pdfs = files.filter(isPdf);
  if (pdfs.length < files.length) showToast('Nur PDF-Dateien werden übernommen.');
  for (const file of pdfs) {
    const entry: Entry = { id: nextId++, file, state: 'checking', pages: 0, error: '' };
    entries.push(entry);
    inspectQueue = inspectQueue.then(() => inspect(entry));
  }
  render();
}

mergeButton.addEventListener('click', () => {
  void merge();
});

async function merge(): Promise<void> {
  const sources = validEntries();
  merging = true;
  mergeLabel.textContent = 'Wird zusammengefügt …';
  render();
  try {
    const result = await client.request<MergeResult>(
      { type: 'merge', files: sources.map((e) => e.file) },
      (progress) => {
        const { done, total } = progress as MergeProgress;
        mergeLabel.textContent = `Wird zusammengefügt … (${done} von ${total})`;
      },
    );
    countLocalBytes(sources.reduce((sum, e) => sum + e.file.size, 0));
    saveBlob(
      'zusammengefuegt.pdf',
      new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    showToast(`Fertig: ${result.pages} Seiten in einer PDF.`);
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    merging = false;
    mergeLabel.textContent = idleLabel;
    render();
  }
}

clearButton.addEventListener('click', () => {
  entries = [];
  render();
});

preventAccidentalFileOpen();
wireDropzone($('#pdf-drop'), $<HTMLInputElement>('#pdf-input'), addFiles);
render();
