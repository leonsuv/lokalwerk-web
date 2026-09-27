/**
 * Werkzeugseite „Dokument scannen“ (plan-phase2.md Vorschlag C). Die Kamera öffnet sich nur über
 * die Dateiauswahl (`capture`), ohne getUserMedia; die Permissions-Policy `camera=()` bleibt.
 * Ecken setzt der Nutzer selbst; Entzerren, Verbessern und PDF laufen im Worker.
 */

import { isImage } from '../../core/files/classify.ts';
import {
  isConvexQuad,
  outputSize,
  turnCorners,
  type Point,
} from '../../core/images/perspective.ts';
import type { PageImage } from '../../core/pdf/from-images.ts';
import { $, $$ } from '../../ui/dom.ts';
import { CornerEditor } from '../../ui/corner-editor.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import {
  canvasScale,
  encodeCanvas,
  ImageEditError,
  imageErrorMessage,
  loadImage,
} from '../../ui/image-edit.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { ScanMode, ScanRequest, Warped } from './scan.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const worker = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<ScanRequest>(worker);

const VIEW_MAX = 720;
/** Längere Seite des Vorschaubildes in Pixeln; gespeichert wird aus dem Original */
const PREVIEW_SIDE = 1400;
/** Längere Seite der Ergebnis-Vorschau */
const RESULT_SIDE = 900;
/** Startecken: knapp innerhalb des Fotos */
const INSET = 0.04;
const START: readonly Point[] = [
  { x: INSET, y: INSET },
  { x: 1 - INSET, y: INSET },
  { x: 1 - INSET, y: 1 - INSET },
  { x: INSET, y: 1 - INSET },
];
const FAILED =
  'Die Seite konnte nicht erzeugt werden. Lade die Seite neu und versuch es noch einmal.';

interface ScanPage {
  file: File;
  preview: ImageBitmap;
  /** Größe des Originals (nach der Ausrichtung laut Exif) */
  width: number;
  height: number;
  corners: Point[];
  /** Vierteldrehungen rechts herum für das Ergebnis */
  turns: number;
}

const canvas = $<HTMLCanvasElement>('#scan-canvas');
const result = $<HTMLCanvasElement>('#scan-result');
const modeButtons = $$<HTMLButtonElement>('button[data-mode]');
const saveButton = $<HTMLButtonElement>('#scan-save');
const saveLabel = $('#scan-save-label');
const idleLabel = saveLabel.textContent ?? '';

let pages: ScanPage[] = [];
let active = 0;
let mode: ScanMode = 'gray';
let busy = false;
/** Bildpunkte der Vorschau der aktiven Seite, für die Ergebnis-Vorschau */
let previewPixels: ImageData | null = null;
let previewRun = 0;
let previewTimer = 0;

const editor = new CornerEditor({
  layer: $('#scan-layer'),
  describedBy: 'scan-keys',
  onChange: (value) => {
    const page = pages[active];
    if (page) page.corners = value.map((p) => ({ ...p }));
    schedulePreview();
    render();
  },
});

/** Ecken in Pixeln eines Bildes der Größe width × height, gedreht wie das Ergebnis */
const pixelCorners = (page: ScanPage, width: number, height: number): Point[] =>
  turnCorners(
    page.corners.map((p) => ({ x: p.x * width, y: p.y * height })),
    page.turns,
  );

const fits = (size: { width: number; height: number }, side: number) => {
  const s = Math.min(1, side / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * s)),
    height: Math.max(1, Math.round(size.height * s)),
  };
};

function paint(): void {
  const page = pages[active];
  if (!page) return;
  const area = $('#scan-editor');
  area.hidden = false;
  const ratio = globalThis.devicePixelRatio || 1;
  const maxCss = Math.min(VIEW_MAX, area.clientWidth || VIEW_MAX);
  const scale = Math.min(1, (maxCss * ratio) / page.preview.width);
  canvas.width = Math.max(1, Math.round(page.preview.width * scale));
  canvas.height = Math.max(1, Math.round(page.preview.height * scale));
  canvas.style.width = `${Math.min(maxCss, page.preview.width / ratio)}px`;
  canvas.getContext('2d')?.drawImage(page.preview, 0, 0, canvas.width, canvas.height);
}

function readPreviewPixels(page: ScanPage): ImageData | null {
  const c = document.createElement('canvas');
  c.width = page.preview.width;
  c.height = page.preview.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(page.preview, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function schedulePreview(): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => void updatePreview(), 120);
}

async function updatePreview(): Promise<void> {
  const page = pages[active];
  const pixels = previewPixels;
  if (!page || !pixels || !isConvexQuad(page.corners)) return;
  const run = ++previewRun;
  const corners = pixelCorners(page, pixels.width, pixels.height);
  try {
    const warped = await client.request<Warped>({
      type: 'warp',
      rgba: pixels.data,
      width: pixels.width,
      height: pixels.height,
      corners,
      out: fits(outputSize(corners), RESULT_SIDE),
      mode,
    });
    if (run !== previewRun) return;
    result.width = warped.width;
    result.height = warped.height;
    result
      .getContext('2d')
      ?.putImageData(
        new ImageData(warped.rgba as Uint8ClampedArray<ArrayBuffer>, warped.width, warped.height),
        0,
        0,
      );
  } catch {
    if (run === previewRun) showToast(FAILED);
  }
}

function renderPageButtons(): void {
  const group = $('#scan-pages');
  group.hidden = pages.length < 2;
  group.replaceChildren(
    ...pages.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.page = String(i);
      b.textContent = `Seite ${i + 1}`;
      b.setAttribute('aria-pressed', String(i === active));
      return b;
    }),
  );
}

function render(): void {
  const page = pages[active];
  const convex = page ? isConvexQuad(page.corners) : true;
  $('#scan-empty').hidden = pages.length > 0;
  $('#scan-editor').hidden = pages.length === 0;
  $('#scan-bad').hidden = convex;
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  $('#scan-count').textContent = pages.length ? String(pages.length) : '–';
  const reduced = $('#scan-reduced');
  reduced.hidden = !pages.some((p) => canvasScale(p.width, p.height) < 1);
  reduced.textContent =
    'Ein Foto ist sehr groß und wird verkleinert verarbeitet, damit jeder Browser es schafft.';
  saveButton.disabled = busy || pages.length === 0 || !pages.every((p) => isConvexQuad(p.corners));
  for (const id of ['#scan-left', '#scan-right', '#scan-reset', '#scan-remove', '#scan-clear']) {
    $<HTMLButtonElement>(id).disabled = busy || !page;
  }
}

function select(index: number): void {
  active = Math.max(0, Math.min(index, pages.length - 1));
  const page = pages[active];
  previewPixels = page ? readPreviewPixels(page) : null;
  if (page) {
    editor.set(page.corners);
    paint();
    schedulePreview();
  } else {
    editor.set([]);
  }
  renderPageButtons();
  render();
}

async function add(files: File[]): Promise<void> {
  let added = false;
  for (const file of files) {
    try {
      const full = await loadImage(file);
      const size = fits(full, PREVIEW_SIDE);
      const preview = await createImageBitmap(full, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        resizeQuality: 'high',
      });
      pages.push({
        file,
        preview,
        width: full.width,
        height: full.height,
        corners: START.map((p) => ({ ...p })),
        turns: 0,
      });
      full.close();
      countLocalBytes(file.size);
      added = true;
    } catch (error) {
      showToast(imageErrorMessage(error));
    }
  }
  if (added) select(pages.length - 1);
}

export function openFiles(files: File[]): void {
  const images = files.filter(isImage);
  if (images.length < files.length) showToast('Nur Bilder (JPEG, PNG, WebP) werden übernommen.');
  if (images.length > 0) void add(images);
}

/** Eine Seite aus dem Original: entzerrt, verbessert, kodiert (Schwarzweiß als PNG) */
async function renderPage(page: ScanPage): Promise<PageImage> {
  const full = await loadImage(page.file);
  const scale = canvasScale(full.width, full.height);
  const source = document.createElement('canvas');
  const out = document.createElement('canvas');
  try {
    source.width = Math.max(1, Math.round(full.width * scale));
    source.height = Math.max(1, Math.round(full.height * scale));
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new ImageEditError('too-large');
    ctx.drawImage(full, 0, 0, source.width, source.height);
    const pixels = ctx.getImageData(0, 0, source.width, source.height);
    source.width = 0;
    const corners = pixelCorners(page, pixels.width, pixels.height);
    const size = outputSize(corners);
    const shrink = canvasScale(size.width, size.height);
    const warped = await client.request<Warped>({
      type: 'warp',
      rgba: pixels.data,
      width: pixels.width,
      height: pixels.height,
      corners,
      out: {
        width: Math.max(1, Math.round(size.width * shrink)),
        height: Math.max(1, Math.round(size.height * shrink)),
      },
      mode,
    });
    out.width = warped.width;
    out.height = warped.height;
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new ImageEditError('too-large');
    outCtx.putImageData(
      new ImageData(warped.rgba as Uint8ClampedArray<ArrayBuffer>, warped.width, warped.height),
      0,
      0,
    );
    const type = mode === 'bw' ? 'image/png' : 'image/jpeg';
    const blob = await encodeCanvas(out, type, 0.85);
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      type,
      width: warped.width,
      height: warped.height,
    };
  } finally {
    full.close();
    source.width = 0;
    out.width = 0;
  }
}

async function save(): Promise<void> {
  if (pages.length === 0) return;
  busy = true;
  render();
  try {
    const images: PageImage[] = [];
    for (const [i, page] of pages.entries()) {
      saveLabel.textContent =
        pages.length > 1 ? `Seite ${i + 1} von ${pages.length} …` : 'Wird erstellt …';
      images.push(await renderPage(page));
    }
    saveLabel.textContent = 'PDF wird erstellt …';
    const bytes = await client.request<Uint8Array>({ type: 'build', pages: images });
    saveBlob('scan.pdf', new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
    toWorkshop([
      new File([bytes as Uint8Array<ArrayBuffer>], 'scan.pdf', { type: 'application/pdf' }),
    ]);
    showToast(
      pages.length === 1
        ? 'Fertig: Der Scan ist als PDF gespeichert.'
        : `Fertig: ${pages.length} Seiten sind als PDF gespeichert.`,
    );
  } catch (error) {
    showToast(error instanceof ImageEditError ? imageErrorMessage(error) : FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

function turnActive(by: 1 | -1): void {
  const page = pages[active];
  if (!page) return;
  page.turns = (page.turns + by + 4) % 4;
  schedulePreview();
}

$('#scan-pages').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('button[data-page]');
  if (b) select(Number(b.dataset.page));
});
for (const b of modeButtons) {
  b.addEventListener('click', () => {
    mode = (b.dataset.mode as ScanMode | undefined) ?? 'gray';
    schedulePreview();
    render();
  });
}
$('#scan-left').addEventListener('click', () => turnActive(-1));
$('#scan-right').addEventListener('click', () => turnActive(1));
$('#scan-reset').addEventListener('click', () => {
  const page = pages[active];
  if (!page) return;
  page.corners = START.map((p) => ({ ...p }));
  editor.set(page.corners);
  schedulePreview();
  render();
});
$('#scan-remove').addEventListener('click', () => {
  pages[active]?.preview.close();
  pages.splice(active, 1);
  select(active - 1 < 0 ? 0 : active - 1);
  if (pages.length === 0) $<HTMLInputElement>('#scan-input').focus();
});
saveButton.addEventListener('click', () => void save());
$('#scan-clear').addEventListener('click', () => {
  for (const p of pages) p.preview.close();
  pages = [];
  select(0);
  $<HTMLInputElement>('#scan-input').focus();
});
const camera = $<HTMLInputElement>('#scan-camera');
camera.addEventListener('change', () => {
  const files = [...(camera.files ?? [])];
  camera.value = '';
  openFiles(files);
});

preventAccidentalFileOpen();
wireDropzone($('#scan-drop'), $<HTMLInputElement>('#scan-input'), openFiles);
render();
