/**
 * Werkzeugseite „PDF in Graustufen“. pdf.js zeichnet jede Seite in ein Canvas, die Pixel werden
 * nach Helligkeit grau gerechnet (core/pdf/grayscale.ts) und als JPEG an den Worker gegeben, der
 * daraus die neue PDF baut. Text und Vektoren werden dabei zu Bildern; das sagt der Erklärtext.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { grayscaleRgba } from '../../core/pdf/grayscale.ts';
import { rasterSize } from '../../core/pdf/raster.ts';
import type { RasterPage } from '../../core/pdf/redact.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import {
  loadPdfjs,
  pdfErrorCode,
  PdfjsUnsupportedError,
  UNSUPPORTED_TOOL,
} from '../../ui/pdfjs/support.ts';
import { unsupportedNote } from '../../ui/pdfjs/unsupported-note.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { GrayRequest } from './gray.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const MESSAGES: Record<string, string> = {
  unsupported: UNSUPPORTED_TOOL,
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
};
const FAILED =
  'Die PDF konnte nicht in Graustufen umgewandelt werden. Wähle eine geringere Auflösung und versuch es noch einmal.';

// pdf.js samt Worker sofort laden (plan.md N4, offline).
const pdfjs = loadPdfjs();
// Zu alter Browser (docs/pdfjs-kompatibilitaet.md 5): Hinweis oben statt „beschädigt“
const showUnsupported = unsupportedNote('tool');
let unsupported = false;
pdfjs.catch((error: unknown) => {
  if (!(error instanceof PdfjsUnsupportedError)) return;
  unsupported = true;
  render();
});

const worker = new Worker(new URL('./gray.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<GrayRequest>(worker);

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

const fileList = $<HTMLUListElement>('#gry-file');
const dpiSelect = $<HTMLSelectElement>('#gry-dpi');
const saveButton = $<HTMLButtonElement>('#gry-save');
const saveLabel = $('#gry-save-label');
const idleLabel = saveLabel.textContent ?? '';

let current: Current | null = null;
let busy = false;
let openToken = 0;

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
  const ok = current?.state === 'ok' ? current : null;
  toWorkshop(ok ? [ok.file] : null);
  showUnsupported({ unsupported });
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#gry-empty').hidden = current !== null;
  $('#gry-settings').hidden = ok === null;

  const dpi = Number(dpiSelect.value);
  $('#gry-count').textContent = ok ? String(ok.pages) : '–';
  if (ok) {
    const size = rasterSize(ok.first.w, ok.first.h, dpi);
    $('#gry-size').textContent = `${size.width} × ${size.height} Pixel`;
  } else {
    $('#gry-size').textContent = '–';
  }
  saveButton.disabled = busy || ok === null;
  $<HTMLButtonElement>('#gry-clear').disabled = busy || current === null;
}

async function closeCurrent(): Promise<void> {
  $('#gry-reduced').hidden = true;
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
    const { openPdf, pageSize, PdfOpenError } = await pdfjs;
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
  } catch (error) {
    if (token !== openToken) return;
    // Unlesbar gab es hier nur beim Einlesen der Datei (oben), nicht beim Öffnen
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
  if (files.length > 1) showToast('Es wird eine PDF auf einmal umgewandelt: die erste.');
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
  const dpi = Number(dpiSelect.value);
  const { pageSize, renderPageAt } = await pdfjs;
  busy = true;
  render();
  const reduced: { page: number; dpi: number }[] = [];
  try {
    const pages: RasterPage[] = [];
    for (let n = 1; n <= total; n++) {
      saveLabel.textContent = `Seite ${n} von ${total} …`;
      const size = await pageSize(doc, n);
      const target = rasterSize(size.width, size.height, dpi);
      if (target.reduced) reduced.push({ page: n, dpi: target.dpi });
      const canvas = await renderPageAt(doc, n, {
        scale: target.width / size.width,
        background: '#ffffff',
      });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      grayscaleRgba(image.data);
      ctx.putImageData(image, 0, 0);
      pages.push({ jpeg: await canvasToJpeg(canvas), width: size.width, height: size.height });
      // Speicher des Canvas sofort freigeben, bevor die nächste Seite kommt.
      canvas.width = 0;
      canvas.height = 0;
    }
    saveLabel.textContent = 'PDF wird erstellt …';
    const bytes = await client.request<Uint8Array>({ type: 'build', pages });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-graustufen.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die PDF in Graustufen ist gespeichert.');
    const note = $('#gry-reduced');
    note.hidden = reduced.length === 0;
    note.textContent = reduced
      .slice(0, 5)
      .map(
        (r) => `Seite ${r.page} ist sehr groß und wurde mit ${r.dpi} statt ${dpi} dpi gespeichert.`,
      )
      .join(' ');
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

dpiSelect.addEventListener('change', render);
saveButton.addEventListener('click', () => {
  void save();
});
$('#gry-clear').addEventListener('click', () => {
  openToken++;
  void closeCurrent().then(() => {
    render();
    $<HTMLInputElement>('#gry-input').focus();
  });
});

preventAccidentalFileOpen();
wireDropzone($('#gry-drop'), $<HTMLInputElement>('#gry-input'), openFiles);
render();
