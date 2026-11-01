/**
 * Werkzeugseite „Leere Seiten entfernen“. pdf.js zeichnet jede Seite klein, core/pdf/blank-page.ts
 * zählt die Spur; die Vorschau zeigt jede Seite zur Kontrolle und lässt sie von Hand umstellen.
 * Die behaltenen Seiten übernimmt ein Worker in eine neue PDF. Nichts wird gespeichert
 * (AGENTS.md Regel 5).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { inkRatios, isBlank, LEVEL_ORDER, type BlankLevel } from '../../core/pdf/blank-page.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { LazyRenderer } from '../../ui/lazy-render.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { PDF_MESSAGES, type PdfToolOutput, type PdfToolRequest } from '../../ui/pdf-tool.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import {
  loadPdfjs,
  pdfErrorCode,
  PdfjsUnsupportedError,
  UNSUPPORTED_TOOL,
} from '../../ui/pdfjs/support.ts';
import { unsupportedNote } from '../../ui/pdfjs/unsupported-note.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { BlankOptions } from './blank.worker.ts';

const MESSAGES: Record<string, string> = { ...PDF_MESSAGES, unsupported: UNSUPPORTED_TOOL };
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

/** Längste Seite der Prüfzeichnung in Pixeln */
const ANALYSIS = 400;
const THUMB = 130;

const client = createWorkerClient<PdfToolRequest<BlankOptions>>(
  new Worker(new URL('./blank.worker.ts', import.meta.url), { type: 'module' }),
);

// pdf.js samt Worker sofort laden (plan.md N4, offline).
const pdfjs = loadPdfjs();
const showUnsupported = unsupportedNote('tool');
let unsupported = false;
pdfjs.catch((error: unknown) => {
  if (!(error instanceof PdfjsUnsupportedError)) return;
  unsupported = true;
  render();
});

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; doc: PDFDocumentProxy; pages: number }
  | { state: 'error'; file: File; error: string };

const fileList = $<HTMLUListElement>('#blk-file');
const grid = $<HTMLOListElement>('#blk-pages');
const levelButtons = $$<HTMLButtonElement>('button[data-level]');
const saveButton = $<HTMLButtonElement>('#blk-save');
const saveLabel = $('#blk-save-label');
const clearButton = $<HTMLButtonElement>('#blk-clear');
const idleLabel = saveLabel.textContent ?? '';

let current: Current | null = null;
let level: BlankLevel = 'normal';
/** Spur-Anteile je Seite (Index 0 = Seite 1); null, solange nicht geprüft */
let ratios: (Record<BlankLevel, number> | null)[] = [];
/** Von Hand umgestellt: true = entfernen, false = behalten */
const manual = new Map<number, boolean>();
let analysed = 0;
let busy = false;
let openToken = 0;
const lazy = new LazyRenderer();

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

function removed(page: number): boolean {
  const own = manual.get(page);
  if (own !== undefined) return own;
  const r = ratios[page - 1];
  return r ? isBlank(r, level) : false;
}

function fileRow(entry: Current): HTMLLIElement {
  const li = document.createElement('li');
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = '1';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = entry.file.name;
  const info = document.createElement('span');
  const size = formatBytes(entry.file.size);
  if (entry.state === 'checking') info.textContent = `${size}, wird geprüft …`;
  if (entry.state === 'ok') {
    info.textContent = `${entry.pages} ${entry.pages === 1 ? 'Seite' : 'Seiten'}, ${size}`;
  }
  if (entry.state === 'error') {
    const error = document.createElement('span');
    error.className = 'err';
    error.textContent = entry.error;
    info.append(`${size}, `, error);
  }
  meta.append(name, info);
  li.append(num, meta);
  return li;
}

function render(): void {
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  showUnsupported({ unsupported });
  $('#blk-empty').hidden = current !== null;
  const ok = current?.state === 'ok' ? current : null;
  grid.hidden = !ok;
  for (const b of levelButtons) b.setAttribute('aria-pressed', String(b.dataset.level === level));

  const total = ok?.pages ?? 0;
  const finished = ok !== null && analysed >= total;
  let blank = 0;
  for (let page = 1; page <= total; page++) if (removed(page)) blank += 1;

  for (const li of grid.querySelectorAll<HTMLLIElement>('li[data-page]')) {
    const page = Number(li.dataset.page);
    const checked = ratios[page - 1] !== undefined && ratios[page - 1] !== null;
    const drop = removed(page);
    li.classList.toggle('off', drop);
    const info = li.querySelector('.sz');
    if (info) info.textContent = !checked ? 'wird geprüft …' : drop ? 'Wird entfernt' : 'Bleibt';
    const button = li.querySelector('button');
    if (button) {
      button.disabled = busy || !checked;
      button.textContent = drop ? 'Behalten' : 'Entfernen';
      button.setAttribute(
        'aria-label',
        `Seite ${page}: ${drop ? 'doch behalten' : 'trotzdem entfernen'}`,
      );
    }
  }

  $('#blk-count').textContent = ok ? String(total) : '–';
  $('#blk-blank').textContent = ok && finished ? String(blank) : '–';
  $('#blk-keep').textContent = ok && finished ? String(total - blank) : '–';
  const note = $('#blk-note');
  note.hidden = !ok;
  if (ok && !finished) note.textContent = `Seiten werden geprüft … (${analysed} von ${total})`;
  else if (ok && blank === 0) note.textContent = 'Keine leeren Seiten gefunden.';
  else if (ok && blank === total)
    note.textContent = 'Es bleibt keine Seite übrig. Stelle mindestens eine Seite auf „Behalten“.';
  else note.textContent = '';
  saveButton.disabled = busy || !ok || !finished || blank === 0 || blank === total;
  clearButton.disabled = busy || current === null;
}

function showThumbnails(doc: PDFDocumentProxy, pages: number): void {
  lazy.clear();
  const tiles = Array.from({ length: pages }, (_, i) => {
    const page = i + 1;
    const li = document.createElement('li');
    li.className = 'page-tile';
    li.dataset.page = String(page);
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb';
    const body = document.createElement('div');
    body.className = 'body';
    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = `Seite ${page}`;
    const info = document.createElement('span');
    info.className = 'sz';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn ghost';
    toggle.addEventListener('click', () => {
      manual.set(page, !removed(page));
      render();
    });
    body.append(name, info, toggle);
    li.append(thumb, body);
    lazy.observe(li, async () => {
      const { pageSize, renderPageAt } = await pdfjs;
      try {
        const size = await pageSize(doc, page);
        const scale =
          (THUMB * (globalThis.devicePixelRatio || 1)) / Math.max(size.width, size.height);
        const canvas = await renderPageAt(doc, page, { scale, background: '#ffffff' });
        canvas.setAttribute('aria-hidden', 'true');
        thumb.replaceChildren(canvas);
      } catch {
        const err = document.createElement('span');
        err.className = 'err';
        err.textContent = 'Keine Vorschau möglich';
        thumb.replaceChildren(err);
      }
    });
    return li;
  });
  grid.replaceChildren(...tiles);
}

/** Zeichnet jede Seite klein, zählt die Spur und gibt den Speicher sofort wieder frei */
async function analyse(doc: PDFDocumentProxy, pages: number, token: number): Promise<void> {
  const { pageSize, renderPageAt } = await pdfjs;
  for (let page = 1; page <= pages; page++) {
    if (token !== openToken) return;
    try {
      const size = await pageSize(doc, page);
      const canvas = await renderPageAt(doc, page, {
        scale: ANALYSIS / Math.max(size.width, size.height),
        background: '#ffffff',
      });
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const data = context?.getImageData(0, 0, canvas.width, canvas.height);
      if (data) ratios[page - 1] = inkRatios(data.data, data.width, data.height);
      canvas.width = 0;
      canvas.height = 0;
    } catch {
      // Nicht lesbare Seite: bleibt sicherheitshalber erhalten
      ratios[page - 1] = { strict: 1, normal: 1, loose: 1 };
    }
    if (token !== openToken) return;
    analysed = page;
    render();
  }
}

async function closeCurrent(): Promise<void> {
  lazy.clear();
  grid.replaceChildren();
  ratios = [];
  manual.clear();
  analysed = 0;
  if (current?.state === 'ok') {
    const { doc } = current;
    current = null;
    await (await pdfjs).closePdf(doc);
  }
  current = null;
}

async function open(file: File): Promise<void> {
  const token = ++openToken;
  await closeCurrent();
  current = { state: 'checking', file };
  render();
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    if (token === openToken)
      current = { state: 'error', file, error: MESSAGES['unreadable'] ?? '' };
    render();
    return;
  }
  try {
    const { openPdf, PdfOpenError } = await pdfjs;
    const doc = await openPdf(bytes);
    if ((await doc.getPermissions()) !== null) {
      void (await pdfjs).closePdf(doc);
      throw new PdfOpenError('encrypted');
    }
    if (token !== openToken) {
      void (await pdfjs).closePdf(doc);
      return;
    }
    ratios = Array.from({ length: doc.numPages }, () => null);
    current = { state: 'ok', file, doc, pages: doc.numPages };
    showThumbnails(doc, doc.numPages);
    render();
    void analyse(doc, doc.numPages, token);
    return;
  } catch (error) {
    if (token !== openToken) return;
    const code = pdfErrorCode(error) === 'unreadable' ? 'damaged' : pdfErrorCode(error);
    current = { state: 'error', file, error: MESSAGES[code] ?? MESSAGES['damaged'] ?? '' };
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
  void open(file);
}

async function save(): Promise<void> {
  if (current?.state !== 'ok') return;
  const { file, pages } = current;
  const keep = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => !removed(p));
  if (keep.length === 0 || keep.length === pages) return;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const output = await client.request<PdfToolOutput>({ type: 'run', file, options: { keep } });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    for (const out of output.files) {
      saveBlob(
        `${base}-ohne-leere-seiten.pdf`,
        new Blob([out.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      );
    }
    countLocalBytes(file.size);
    const gone = pages - keep.length;
    showToast(
      `Fertig: ${gone} ${gone === 1 ? 'leere Seite' : 'leere Seiten'} entfernt und die neue PDF gespeichert.`,
    );
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

preventAccidentalFileOpen();
wireDropzone($('#blk-drop'), $<HTMLInputElement>('#blk-input'), openFiles);
for (const b of levelButtons) {
  b.addEventListener('click', () => {
    const next = LEVEL_ORDER.find((l) => l === b.dataset.level);
    if (next) level = next;
    render();
  });
}
saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  openToken += 1;
  void closeCurrent().then(() => {
    render();
    $<HTMLInputElement>('#blk-input').focus();
  });
});
render();
