/**
 * Werkzeugseite „PDF schwärzen“ (plan-phase2.md, Werkzeug 5). pdf.js zeichnet jede Seite, die
 * Bereiche werden ins Bild gemalt, der Worker baut aus den Bildern eine neue PDF. Der Worker
 * bekommt nur die Bilder, nie die Original-PDF (core/pdf/redact.ts).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { rasterSize } from '../../core/pdf/raster.ts';
import type { RasterPage } from '../../core/pdf/redact.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import { RectEditor, type NormRect } from '../../ui/rect-editor.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { RedactRequest } from './redact.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const MESSAGES: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
};
const FAILED =
  'Die geschwärzte PDF konnte nicht erzeugt werden. Wähle eine geringere Auflösung und versuch es noch einmal.';

// pdf.js und pdf-lib sofort laden (plan.md N4, offline).
const pdfjs = import('../../ui/pdfjs/pdfjs.ts');
const worker = new Worker(new URL('./redact.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<RedactRequest>(worker);

/** Breite der Vorschau höchstens, in CSS-Pixeln */
const VIEW_MAX = 720;

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; doc: PDFDocumentProxy; pages: number }
  | { state: 'error'; file: File; error: string };

const fileList = $<HTMLUListElement>('#red-file');
const view = $<HTMLDivElement>('#red-view');
const saveButton = $<HTMLButtonElement>('#red-save');
const saveLabel = $('#red-save-label');
const idleLabel = saveLabel.textContent ?? '';

let current: Current | null = null;
let page = 1;
let busy = false;
let openToken = 0;
let renderToken = 0;
const rects = new Map<number, NormRect[]>();

const editor = new RectEditor({
  layer: $('#red-layer'),
  draw: true,
  label: (i) => `Bereich ${i + 1} auf Seite ${page}`,
  describedBy: 'red-keys',
  home: $('#red-add'),
  onChange: (value) => {
    rects.set(page, [...value]);
    render();
  },
});

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
  toWorkshop(current?.state === 'ok' ? [current.file] : null);
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#red-empty').hidden = current !== null;
  const ok = current?.state === 'ok' ? current : null;
  $('#red-editor').hidden = !ok;
  const all = [...rects.values()];
  const count = all.reduce((sum, list) => sum + list.length, 0);
  $('#red-count').textContent = ok ? String(count) : '–';
  $('#red-pages').textContent = ok ? String(all.filter((l) => l.length > 0).length) : '–';
  if (ok) $('#red-page-label').textContent = `Seite ${page} von ${ok.pages}`;
  $<HTMLButtonElement>('#red-prev').disabled = busy || page <= 1;
  $<HTMLButtonElement>('#red-next').disabled = busy || !ok || page >= ok.pages;
  saveButton.disabled = busy || !ok || count === 0;
  $<HTMLButtonElement>('#red-clear-page').disabled = busy || (rects.get(page) ?? []).length === 0;
  $<HTMLButtonElement>('#red-clear').disabled = busy || current === null;
  $<HTMLButtonElement>('#red-add').disabled = busy || !ok;
}

async function showPage(n: number): Promise<void> {
  if (current?.state !== 'ok') return;
  const token = ++renderToken;
  page = n;
  editor.set(rects.get(n) ?? []);
  render();
  const { renderPage } = await pdfjs;
  const width = Math.min(VIEW_MAX, view.parentElement?.clientWidth ?? VIEW_MAX);
  const canvas = document.createElement('canvas');
  canvas.id = 'red-canvas';
  canvas.setAttribute('aria-label', `Vorschau der Seite ${n}`);
  await renderPage(current.doc, n, width, { canvas });
  if (token !== renderToken) return;
  $('#red-canvas').replaceWith(canvas);
}

async function closeCurrent(): Promise<void> {
  rects.clear();
  editor.set([]);
  page = 1;
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
  const { openPdf, PdfOpenError } = await pdfjs;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await openPdf(bytes);
    if ((await doc.getPermissions()) !== null) {
      void (await pdfjs).closePdf(doc);
      throw new PdfOpenError('encrypted');
    }
    if (token !== openToken) {
      void (await pdfjs).closePdf(doc);
      return;
    }
    current = { state: 'ok', file, doc, pages: doc.numPages };
    await showPage(1);
  } catch (error) {
    if (token !== openToken) return;
    const code =
      error instanceof PdfOpenError
        ? error.code
        : error instanceof DOMException
          ? 'unreadable'
          : 'damaged';
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

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('encode'));
          return;
        }
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      'image/jpeg',
      0.9,
    ),
  );
}

async function save(): Promise<void> {
  if (current?.state !== 'ok') return;
  const { file, doc, pages: total } = current;
  const dpi = Number($<HTMLSelectElement>('#red-dpi').value);
  const { pageSize, renderPageAt } = await pdfjs;
  busy = true;
  render();
  try {
    const pages: RasterPage[] = [];
    for (let n = 1; n <= total; n++) {
      saveLabel.textContent = `Seite ${n} von ${total} …`;
      const size = await pageSize(doc, n);
      const target = rasterSize(size.width, size.height, dpi);
      const canvas = await renderPageAt(doc, n, {
        scale: target.width / size.width,
        background: '#ffffff',
      });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#000000';
      const W = canvas.width;
      const H = canvas.height;
      for (const r of rects.get(n) ?? []) {
        // Nach außen runden, damit kein Pixelrand des Inhalts stehen bleibt
        const x0 = Math.floor(r.x * W);
        const y0 = Math.floor(r.y * H);
        ctx.fillRect(x0, y0, Math.ceil((r.x + r.w) * W) - x0, Math.ceil((r.y + r.h) * H) - y0);
      }
      pages.push({ jpeg: await canvasToJpeg(canvas), width: size.width, height: size.height });
      canvas.width = 0;
      canvas.height = 0;
    }
    saveLabel.textContent = 'PDF wird erstellt …';
    const bytes = await client.request<Uint8Array>({ type: 'build', pages });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-geschwaerzt.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die geschwärzte PDF ist gespeichert. Prüf sie, bevor du sie weitergibst.');
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

$('#red-prev').addEventListener('click', () => void showPage(page - 1));
$('#red-next').addEventListener('click', () => void showPage(page + 1));
$('#red-add').addEventListener('click', () => {
  editor.add({ x: 0.3, y: 0.45, w: 0.4, h: 0.05 });
});
$('#red-clear-page').addEventListener('click', () => {
  editor.set([]);
  rects.set(page, []);
  render();
  $<HTMLButtonElement>('#red-add').focus();
});
saveButton.addEventListener('click', () => {
  void save();
});
$('#red-clear').addEventListener('click', () => {
  openToken++;
  void closeCurrent().then(() => {
    render();
    $<HTMLInputElement>('#red-input').focus();
  });
});

preventAccidentalFileOpen();
wireDropzone($('#red-drop'), $<HTMLInputElement>('#red-input'), openFiles);
render();
