/**
 * Werkzeugseite „PDF-Werkstatt“ (plan-phase3.md). Zustand und Befehle: src/core/workshop/ und
 * store.ts; Spalten: board.ts; Vorschaubilder mit pdf.js: thumbs.ts; Lesen und Export mit
 * pdf-lib im Worker: workshop.worker.ts.
 */

import { isPdf } from '../../core/files/classify.ts';
import { addSources, newDoc, renameDoc } from '../../core/workshop/commands.ts';
import {
  MEMORY_HINT_BYTES,
  totalSourceSize,
  type DocId,
  type Source,
} from '../../core/workshop/model.ts';
import { selectionSummary } from '../../core/workshop/selection.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { Board, SourceBadges } from './board.ts';
import { SourceFiles } from './sources.ts';
import { WorkshopStore } from './store.ts';
import {
  ERRORS,
  FALLBACK_ERROR,
  fileError,
  LEAVE_WARNING,
  loading,
  memoryHint,
  NOT_SUPPORTED,
  pages,
} from './texts.ts';
import { Thumbs } from './thumbs.ts';
import type { AddPdfResult, WorkshopRequest } from './workshop.worker.ts';

// Beides sofort laden: pdf-lib im Worker, pdf.js samt eigenem Worker (plan.md N4, offline).
const worker = new Worker(new URL('./workshop.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<WorkshopRequest>(worker);
const pdfjs = import('../../ui/pdfjs/pdfjs.ts');

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? ERRORS[error.code] : undefined) ?? FALLBACK_ERROR;

const files = new SourceFiles(pdfjs);
const store = new WorkshopStore((ids) => {
  files.release(ids);
  void client.request({ type: 'release', ids }).catch(() => undefined);
});
const thumbs = new Thumbs(files, pdfjs);
const board = new Board($('#ws-board'), thumbs, new SourceBadges());
const input = $<HTMLInputElement>('#ws-input');
const status = $('#ws-status');

function render(): void {
  const { state, selection } = store;
  board.render(state, selection);
  const hasDocs = state.docs.length > 0;
  $('#ws-drop').hidden = hasDocs;
  const pageCount = state.docs.reduce((n, d) => n + d.pages.length, 0);
  $('#ws-docs').textContent = hasDocs ? String(state.docs.length) : '–';
  $('#ws-pages').textContent = hasDocs ? String(pageCount) : '–';
  const summary = selectionSummary(state, selection);
  $('#ws-selected').textContent = summary.pages > 0 ? pages(summary.pages) : '–';
  const size = totalSourceSize(state.sources.values());
  $('#ws-memory').hidden = size < MEMORY_HINT_BYTES;
  if (size >= MEMORY_HINT_BYTES) $('#ws-memory-text').textContent = memoryHint(size);
}

store.subscribe(render);

let loadingCount = 0;

/**
 * Dateien öffnen: ohne Ziel jede PDF als eigenes Dokument, mit Ziel an dieser Stelle im
 * Dokument. Alle Dateien einer Ablage bilden einen Schritt im Verlauf.
 */
async function addFiles(list: File[], target?: { doc: DocId; index: number }): Promise<void> {
  const pdfs = list.filter(isPdf);
  const other = list.filter((f) => !isPdf(f)).map((f) => f.name);
  if (other.length > 0) showToast(NOT_SUPPORTED(other));
  if (pdfs.length === 0) return;
  loadingCount++;
  const added: Source[] = [];
  const failed: string[] = [];
  for (const [i, file] of pdfs.entries()) {
    status.textContent = loading(i + 1, pdfs.length);
    const id = store.ids('s');
    try {
      const info = await client.request<AddPdfResult>({ type: 'add-pdf', id, file });
      files.add(id, file);
      added.push({ id, kind: 'pdf', name: file.name, size: file.size, ...info });
    } catch (error) {
      failed.push(fileError(file.name, messageFor(error)));
    }
  }
  loadingCount--;
  if (loadingCount === 0) status.textContent = '';
  for (const message of failed) showToast(message);
  if (added.length > 0) store.run(addSources(added, target));
}

export function openFiles(list: File[]): void {
  void addFiles(list);
}

// Werkzeugleiste
$('#ws-toolbar').addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-cmd]');
  if (!button || button.disabled) return;
  switch (button.dataset.cmd) {
    case 'add':
      input.click();
      break;
    case 'new-doc':
      store.run(newDoc(`Dokument ${store.state.docs.length + 1}`));
      break;
  }
});

// Umbenennen im Spaltenkopf: übernehmen beim Verlassen oder mit Eingabe, Esc stellt zurück
const boardEl = $('#ws-board');
boardEl.addEventListener('change', (event) => {
  const field = event.target as HTMLInputElement;
  const id = field.dataset.doc;
  if (!field.classList.contains('ws-name') || !id) return;
  store.run(renameDoc(id, field.value));
  // Leerer Name oder ohne Änderung: den gültigen Namen wieder anzeigen
  const doc = store.state.docs.find((d) => d.id === id);
  if (doc) field.value = doc.name;
});
boardEl.addEventListener('keydown', (event) => {
  const field = event.target as HTMLInputElement;
  if (!field.classList.contains('ws-name')) return;
  if (event.key === 'Enter') field.blur();
  if (event.key === 'Escape') {
    field.value = store.state.docs.find((d) => d.id === field.dataset.doc)?.name ?? field.value;
    field.blur();
  }
});

// Dateien auf eine Spalte ziehen: dort anhängen; auf freie Fläche: neue Dokumente
boardEl.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
boardEl.addEventListener('drop', (event) => {
  const dropped = [...(event.dataTransfer?.files ?? [])];
  if (dropped.length === 0) return;
  event.preventDefault();
  const id = (event.target as Element).closest<HTMLElement>('.ws-col')?.dataset.doc;
  const doc = id ? store.state.docs.find((d) => d.id === id) : undefined;
  void addFiles(dropped, doc ? { doc: doc.id, index: doc.pages.length } : undefined);
});

window.addEventListener('beforeunload', (event) => {
  if (!store.dirty) return;
  event.preventDefault();
  // Ältere Browser zeigen die Warnung nur mit gesetztem returnValue (Text zeigen sie nicht).
  event.returnValue = LEAVE_WARNING;
});

preventAccidentalFileOpen();
wireDropzone($('#ws-drop'), input, openFiles);
render();
