/**
 * Werkzeugseite „Unterschrift einfügen“ (plan-phase2.md, Werkzeug 10). pdf.js zeigt die Seite,
 * die Unterschrift entsteht als PNG im Browser, pdf-lib setzt sie im Worker ein. Die Unterschrift
 * wird nicht gespeichert (AGENTS.md Regel 5). Rechtliche Einordnung: docs/unterschrift-recht.md.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { NormRect } from '../../core/geometry/norm-rect.ts';
import type { PdfFacts } from '../../core/pdf/stamp.ts';
import { $, $$ } from '../../ui/dom.ts';
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
import { RectEditor } from '../../ui/rect-editor.ts';
import { SignaturePad, signatureFromFile, type SignatureImage } from '../../ui/signature-pad.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { SignRequest } from './sign.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const MESSAGES: Record<string, string> = {
  unsupported: UNSUPPORTED_TOOL,
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory': 'Nicht genug Arbeitsspeicher für diese PDF.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// pdf-lib im Worker und pdf.js sofort laden (plan.md N4, offline).
const worker = new Worker(new URL('./sign.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<SignRequest>(worker);
const pdfjs = loadPdfjs();
// Zu alter Browser (docs/pdfjs-kompatibilitaet.md 5): Hinweis oben statt „beschädigt“
const showUnsupported = unsupportedNote('tool');
let unsupported = false;
pdfjs.catch((error: unknown) => {
  if (!(error instanceof PdfjsUnsupportedError)) return;
  unsupported = true;
  render();
});

const VIEW_MAX = 720;

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; doc: PDFDocumentProxy; facts: PdfFacts }
  | { state: 'error'; file: File; error: string };

const fileList = $<HTMLUListElement>('#sig-file');
const view = $<HTMLDivElement>('#sig-view');
const saveButton = $<HTMLButtonElement>('#sig-save');
const saveLabel = $('#sig-save-label');
const idleLabel = saveLabel.textContent ?? '';
const sourceButtons = $$<HTMLButtonElement>('button[data-source]');
const colorButtons = $$<HTMLButtonElement>('button[data-color]');
const whiteButtons = $$<HTMLButtonElement>('button[data-white]');

let current: Current | null = null;
let page = 1;
let busy = false;
let openToken = 0;
let renderToken = 0;
let source: 'draw' | 'image' = 'draw';
let removeWhite = true;
let signature: SignatureImage | null = null;
let chosenImage: SignatureImage | null = null;
const placements = new Map<number, NormRect[]>();

const editor = new RectEditor({
  layer: $('#sig-layer'),
  draw: false,
  aspect: () => (signature ? signature.width / signature.height : undefined),
  label: (i) => `Unterschrift ${i + 1} auf Seite ${page}`,
  describedBy: 'sig-keys',
  home: $('#sig-place'),
  decorate: (el) => {
    if (!signature) return;
    const img = document.createElement('img');
    img.src = signature.url;
    img.alt = '';
    el.append(img);
  },
  onChange: (value) => {
    placements.set(page, [...value]);
    render();
  },
});

const pad = new SignaturePad($<HTMLCanvasElement>('#sig-pad'), () => {
  void updateSignature();
});

/** Unterschrift aus der gewählten Quelle neu erzeugen und in allen Platzierungen zeigen */
async function updateSignature(): Promise<void> {
  const next = source === 'draw' ? (pad.isEmpty ? null : await pad.toImage()) : chosenImage;
  if (signature && signature !== chosenImage && signature !== next)
    URL.revokeObjectURL(signature.url);
  signature = next;
  if (!signature) {
    placements.clear();
    editor.set([]);
  } else {
    await fitAspect();
  }
  render();
}

/** Nach einer neuen Unterschrift die Höhe aller Platzierungen an ihr Seitenverhältnis anpassen */
async function fitAspect(): Promise<void> {
  if (!signature || current?.state !== 'ok') return;
  const { pageSize } = await pdfjs;
  const aspect = signature.width / signature.height;
  for (const [n, list] of placements) {
    const size = await pageSize(current.doc, n);
    placements.set(
      n,
      list.map((r) => ({
        ...r,
        h: Math.min(1 - r.y, (r.w * size.width) / (size.height * aspect)),
      })),
    );
  }
  editor.set(placements.get(page) ?? []);
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
    const { pages, signed } = entry.facts;
    info.textContent = `${pages} ${pages === 1 ? 'Seite' : 'Seiten'}, ${size}${signed ? ', digital signiert' : ''}`;
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

function allPlacements(): { page: number; rect: NormRect }[] {
  return [...placements].flatMap(([n, list]) => list.map((rect) => ({ page: n, rect })));
}

function render(): void {
  toWorkshop(current?.state === 'ok' ? [current.file] : null);
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  showUnsupported({ unsupported });
  $('#sig-empty').hidden = current !== null;
  const ok = current?.state === 'ok' ? current : null;
  $('#sig-editor').hidden = !ok;
  $('#sig-signed').hidden = !ok?.facts.signed;
  if (ok) $('#sig-page-label').textContent = `Seite ${page} von ${ok.facts.pages}`;
  for (const b of sourceButtons)
    b.setAttribute('aria-pressed', String(b.dataset.source === source));
  for (const b of colorButtons)
    b.setAttribute('aria-pressed', String(b.dataset.color === pad.color));
  for (const b of whiteButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.white === 'remove') === removeWhite));
  }
  $('#sig-draw-panel').hidden = source !== 'draw';
  $('#sig-image-panel').hidden = source !== 'image';
  const count = allPlacements().length;
  $('#sig-ready').textContent = signature ? 'ja' : 'nein';
  $('#sig-count').textContent = ok ? String(new Set(allPlacements().map((p) => p.page)).size) : '–';
  $<HTMLButtonElement>('#sig-prev').disabled = busy || page <= 1;
  $<HTMLButtonElement>('#sig-next').disabled = busy || !ok || page >= ok.facts.pages;
  $<HTMLButtonElement>('#sig-place').disabled = busy || !ok || !signature;
  saveButton.disabled = busy || !ok || !signature || count === 0;
  $<HTMLButtonElement>('#sig-clear').disabled = busy || current === null;
}

async function showPage(n: number): Promise<void> {
  if (current?.state !== 'ok') return;
  const token = ++renderToken;
  page = n;
  editor.set(placements.get(n) ?? []);
  render();
  const { renderPage } = await pdfjs;
  const width = Math.min(VIEW_MAX, view.parentElement?.clientWidth ?? VIEW_MAX);
  const canvas = document.createElement('canvas');
  canvas.id = 'sig-canvas';
  canvas.setAttribute('aria-label', `Vorschau der Seite ${n}`);
  await renderPage(current.doc, n, width, { canvas });
  if (token !== renderToken) return;
  $('#sig-canvas').replaceWith(canvas);
}

async function closeCurrent(): Promise<void> {
  placements.clear();
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
  let facts: PdfFacts;
  try {
    facts = await client.request<PdfFacts>({ type: 'inspect', file });
  } catch (error) {
    if (token === openToken) current = { state: 'error', file, error: messageFor(error) };
    render();
    return;
  }
  try {
    const doc = await (await pdfjs).openPdf(new Uint8Array(await file.arrayBuffer()));
    if (token !== openToken) {
      void (await pdfjs).closePdf(doc);
      return;
    }
    current = { state: 'ok', file, doc, facts };
    await showPage(1);
  } catch (error) {
    // Wie bisher „beschädigt“, außer der Browser ist zu alt für pdf.js
    const code = pdfErrorCode(error) === 'unsupported' ? 'unsupported' : 'damaged';
    if (token === openToken) current = { state: 'error', file, error: MESSAGES[code] ?? '' };
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
  if (current?.state !== 'ok' || !signature) return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({
      type: 'sign',
      file,
      png: signature.png,
      placements: allPlacements(),
    });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-unterschrieben.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die PDF mit Unterschrift ist gespeichert.');
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

for (const b of sourceButtons) {
  b.addEventListener('click', () => {
    source = b.dataset.source === 'image' ? 'image' : 'draw';
    void updateSignature();
  });
}
for (const b of colorButtons) {
  b.addEventListener('click', () => {
    pad.color = b.dataset.color ?? pad.color;
    render();
  });
}
for (const b of whiteButtons) {
  b.addEventListener('click', () => {
    removeWhite = b.dataset.white === 'remove';
    render();
  });
}
$('#sig-pad-clear').addEventListener('click', () => pad.clear());
$<HTMLInputElement>('#sig-image').addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const [file] = [...(input.files ?? [])];
  input.value = '';
  if (!file) return;
  signatureFromFile(file, removeWhite).then(
    (image) => {
      if (!image) {
        showToast('Auf dem Bild ist keine Unterschrift zu erkennen. Wähle ein anderes Bild.');
        return;
      }
      if (chosenImage) URL.revokeObjectURL(chosenImage.url);
      chosenImage = image;
      void updateSignature();
    },
    () => showToast('Das Bild konnte nicht gelesen werden. Wähle ein PNG- oder JPEG-Bild.'),
  );
});
$('#sig-prev').addEventListener('click', () => void showPage(page - 1));
$('#sig-next').addEventListener('click', () => void showPage(page + 1));
$('#sig-place').addEventListener('click', () => {
  editor.add({ x: 0.55, y: 0.78, w: 0.3, h: 0.08 });
});
saveButton.addEventListener('click', () => {
  void save();
});
$('#sig-clear').addEventListener('click', () => {
  openToken++;
  void closeCurrent().then(() => {
    render();
    $<HTMLInputElement>('#sig-input').focus();
  });
});

preventAccidentalFileOpen();
wireDropzone($('#sig-drop'), $<HTMLInputElement>('#sig-input'), openFiles);
render();
