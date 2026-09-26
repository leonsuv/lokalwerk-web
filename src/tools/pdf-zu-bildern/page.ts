/**
 * Werkzeugseite „PDF zu Bildern“ (plan-phase2.md, Werkzeug 4). pdf.js zeichnet jede Seite in ein
 * Canvas, der Browser kodiert es als JPEG oder PNG. Die Bilder enthalten keine Metadaten der PDF.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { pageIndices, parsePageRanges } from '../../core/pdf/page-ranges.ts';
import { pageImageName, rasterSize } from '../../core/pdf/raster.ts';
import { ZipError } from '../../core/zip/write.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { LazyRenderer } from '../../ui/lazy-render.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import { showToast } from '../../ui/toast.ts';
import { zipBlobs } from '../../ui/zip.ts';

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
  'Die Bilder konnten nicht erzeugt werden. Wähle eine geringere Auflösung oder weniger Seiten auf einmal.';

// pdf.js samt Worker sofort laden (plan.md N4, offline).
const pdfjs = import('../../ui/pdfjs/pdfjs.ts');

const THUMB = 130;
const TYPES = { jpeg: { mime: 'image/jpeg', ext: 'jpg' }, png: { mime: 'image/png', ext: 'png' } };
type Format = keyof typeof TYPES;

type Current =
  | { state: 'checking'; file: File }
  | {
      state: 'ok';
      file: File;
      doc: PDFDocumentProxy;
      pages: number;
      first: { w: number; h: number };
    }
  | { state: 'error'; file: File; error: string };

const fileList = $<HTMLUListElement>('#img-file');
const grid = $<HTMLOListElement>('#img-pages');
const pagesInput = $<HTMLInputElement>('#img-pages-input');
const dpiSelect = $<HTMLSelectElement>('#img-dpi');
const formatButtons = $$<HTMLButtonElement>('button[data-format]');
const saveButton = $<HTMLButtonElement>('#img-save');
const saveLabel = $('#img-save-label');
const idleLabel = saveLabel.textContent ?? '';

let current: Current | null = null;
let format: Format = 'jpeg';
let busy = false;
let openToken = 0;
const lazy = new LazyRenderer();

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

/** Gewählte Seiten (ab 1) oder eine Fehlermeldung */
function selection(): { pages: number[] } | { error: string } {
  if (current?.state !== 'ok') return { pages: [] };
  const total = current.pages;
  if (pagesInput.value.trim() === '')
    return { pages: Array.from({ length: total }, (_, i) => i + 1) };
  const parsed = parsePageRanges(pagesInput.value, total);
  if (parsed.ok) return { pages: parsed.ranges.flatMap(pageIndices).map((i) => i + 1) };
  const e = parsed.error;
  switch (e.code) {
    case 'syntax':
      return {
        error: `„${e.part}“ ist keine Seitenangabe. Schreib Seiten wie 5 oder Bereiche wie 1-3.`,
      };
    case 'out-of-range':
      return {
        error: `„${e.part}“ gibt es nicht: Die PDF hat ${total} ${total === 1 ? 'Seite' : 'Seiten'}.`,
      };
    case 'reversed':
      return { error: `Bei „${e.part}“ muss die erste Seite vor der letzten stehen.` };
    default:
      return { pages: [] };
  }
}

function render(): void {
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#img-empty').hidden = current !== null;
  const ok = current?.state === 'ok' ? current : null;
  grid.hidden = !ok;
  for (const b of formatButtons)
    b.setAttribute('aria-pressed', String(b.dataset.format === format));

  const sel = selection();
  const error = 'error' in sel ? sel.error : '';
  $('#img-pages-error').textContent = error;
  pagesInput.setAttribute('aria-invalid', String(error !== ''));
  const chosen = new Set('pages' in sel ? sel.pages : []);
  for (const li of grid.querySelectorAll<HTMLLIElement>('li[data-page]')) {
    li.classList.toggle('off', !chosen.has(Number(li.dataset.page)));
  }

  const dpi = Number(dpiSelect.value);
  $('#img-count').textContent = ok ? String(ok.pages) : '–';
  $('#img-images').textContent = ok && !error ? String(chosen.size) : '–';
  if (ok) {
    const size = rasterSize(ok.first.w, ok.first.h, dpi);
    $('#img-size').textContent = `${size.width} × ${size.height} Pixel`;
  } else {
    $('#img-size').textContent = '–';
  }
  saveButton.disabled = busy || !ok || error !== '' || chosen.size === 0;
  $<HTMLButtonElement>('#img-clear').disabled = busy || current === null;
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
    body.append(name);
    li.append(thumb, body);
    lazy.observe(li, async () => {
      const { pageSize, renderPageAt } = await pdfjs;
      try {
        const size = await pageSize(doc, page);
        const scale =
          (THUMB * (globalThis.devicePixelRatio || 1)) / Math.max(size.width, size.height);
        const canvas = await renderPageAt(doc, page, { scale });
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

async function closeCurrent(): Promise<void> {
  lazy.clear();
  grid.replaceChildren();
  $('#img-reduced').hidden = true;
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
  const { openPdf, pageSize, PdfOpenError } = await pdfjs;
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
    const doc = await openPdf(bytes);
    // Wie die anderen PDF-Werkzeuge: keine Dateien mit Kopier- oder Rechteschutz umwandeln.
    if ((await doc.getPermissions()) !== null) {
      void (await pdfjs).closePdf(doc);
      throw new PdfOpenError('encrypted');
    }
    const size = await pageSize(doc, 1);
    if (token !== openToken) {
      void (await pdfjs).closePdf(doc);
      return;
    }
    current = {
      state: 'ok',
      file,
      doc,
      pages: doc.numPages,
      first: { w: size.width, h: size.height },
    };
    showThumbnails(doc, doc.numPages);
  } catch (error) {
    if (token !== openToken) return;
    const code = error instanceof PdfOpenError ? error.code : 'damaged';
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
  if (files.length > 1) showToast('Es wird eine PDF auf einmal umgewandelt: die erste.');
  void open(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), mime, 0.92),
  );
}

async function save(): Promise<void> {
  const sel = selection();
  if (current?.state !== 'ok' || !('pages' in sel) || sel.pages.length === 0) return;
  const { file, doc, pages: total } = current;
  const { mime, ext } = TYPES[format];
  const dpi = Number(dpiSelect.value);
  const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
  const { pageSize, renderPageAt } = await pdfjs;
  busy = true;
  render();
  const reduced: { page: number; dpi: number }[] = [];
  try {
    const images: { name: string; blob: Blob }[] = [];
    for (const [i, page] of sel.pages.entries()) {
      saveLabel.textContent = `Wird erstellt … (${i + 1} von ${sel.pages.length})`;
      const size = await pageSize(doc, page);
      const target = rasterSize(size.width, size.height, dpi);
      if (target.reduced) reduced.push({ page, dpi: target.dpi });
      const canvas = await renderPageAt(doc, page, {
        scale: target.width / size.width,
        background: '#ffffff',
      });
      images.push({
        name: pageImageName(base, page, total, ext),
        blob: await canvasToBlob(canvas, mime),
      });
      // Speicher des Canvas sofort freigeben, bevor die nächste Seite kommt.
      canvas.width = 0;
      canvas.height = 0;
    }
    const [single] = images;
    if (images.length === 1 && single) {
      saveBlob(single.name, single.blob);
    } else {
      saveLabel.textContent = 'ZIP wird erstellt …';
      saveBlob(`${base}-bilder.zip`, await zipBlobs(images));
    }
    countLocalBytes(file.size);
    showToast(
      images.length === 1
        ? 'Fertig: Das Bild ist gespeichert.'
        : `Fertig: ${images.length} Bilder als ZIP gespeichert.`,
    );
    const note = $('#img-reduced');
    note.hidden = reduced.length === 0;
    note.textContent = reduced
      .slice(0, 5)
      .map(
        (r) => `Seite ${r.page} ist sehr groß und wurde mit ${r.dpi} statt ${dpi} dpi gespeichert.`,
      )
      .join(' ');
  } catch (error) {
    showToast(
      error instanceof ZipError
        ? 'Die ZIP-Datei wäre zu groß. Wähle weniger Seiten oder eine geringere Auflösung.'
        : FAILED,
    );
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

for (const b of formatButtons) {
  b.addEventListener('click', () => {
    format = b.dataset.format === 'png' ? 'png' : 'jpeg';
    render();
  });
}
pagesInput.addEventListener('input', render);
dpiSelect.addEventListener('change', render);
saveButton.addEventListener('click', () => {
  void save();
});
$('#img-clear').addEventListener('click', () => {
  openToken++;
  void closeCurrent().then(() => {
    render();
    $<HTMLInputElement>('#img-input').focus();
  });
});

preventAccidentalFileOpen();
wireDropzone($('#img-drop'), $<HTMLInputElement>('#img-input'), openFiles);
render();
