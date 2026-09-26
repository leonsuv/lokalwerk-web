/**
 * Werkzeugseite „Gesichter und Kennzeichen verpixeln“ (plan-phase2.md, Werkzeug 14). Große Blöcke
 * oder Schwarz, kein Weichzeichnen (core/images/obscure.ts). Metadaten fallen beim Neu-Kodieren
 * immer weg und werden geprüft.
 */

import { isImage } from '../../core/files/classify.ts';
import type { NormRect } from '../../core/geometry/norm-rect.ts';
import { fill, pixelate, type PixelRect } from '../../core/images/obscure.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import {
  canvasScale,
  drawPreview,
  encodeCanvas,
  imageErrorMessage,
  loadImage,
  outputFormat,
  outputName,
} from '../../ui/image-edit.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { RectEditor } from '../../ui/rect-editor.ts';
import { showToast } from '../../ui/toast.ts';

const VIEW_MAX = 720;
const NO_TRANSFORM = { rotate: 0, flip: false } as const;
const canvas = $<HTMLCanvasElement>('#pix-canvas');
// Die Vorschau wird nach jeder Änderung ausgelesen: Kontext gleich passend anlegen.
canvas.getContext('2d', { willReadFrequently: true });
const modeButtons = $$<HTMLButtonElement>('button[data-mode]');
const saveButton = $<HTMLButtonElement>('#pix-save');
const saveLabel = $('#pix-save-label');
const idleLabel = saveLabel.textContent ?? '';

let file: File | null = null;
let bitmap: ImageBitmap | null = null;
let mode: 'pixel' | 'black' = 'pixel';
let rects: readonly NormRect[] = [];
let busy = false;

const editor = new RectEditor({
  layer: $('#pix-layer'),
  draw: true,
  label: (i) => `Bereich ${i + 1}`,
  describedBy: 'pix-keys',
  home: $('#pix-add'),
  onChange: (value) => {
    rects = [...value];
    paint();
    render();
  },
});

const toPixels = (r: NormRect, width: number, height: number): PixelRect => ({
  x: r.x * width,
  y: r.y * height,
  width: r.w * width,
  height: r.h * height,
});

/** Wendet die Bereiche auf ein Canvas an, das das ganze Bild zeigt */
function obscure(target: HTMLCanvasElement): void {
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx || rects.length === 0) return;
  const image = ctx.getImageData(0, 0, target.width, target.height);
  for (const r of rects) {
    const area = toPixels(r, target.width, target.height);
    if (mode === 'black') fill(image.data, target.width, target.height, area);
    else pixelate(image.data, target.width, target.height, area);
  }
  ctx.putImageData(image, 0, 0);
}

function paint(): void {
  if (!bitmap) return;
  const area = $('#pix-editor');
  area.hidden = false;
  drawPreview(canvas, bitmap, NO_TRANSFORM, Math.min(VIEW_MAX, area.clientWidth || VIEW_MAX));
  obscure(canvas);
}

function render(): void {
  $('#pix-empty').hidden = bitmap !== null;
  $('#pix-editor').hidden = bitmap === null;
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  $('#pix-count').textContent = bitmap ? String(rects.length) : '–';
  const scale = bitmap ? canvasScale(bitmap.width, bitmap.height) : 1;
  const reduced = $('#pix-reduced');
  reduced.hidden = scale >= 1;
  reduced.textContent =
    'Das Foto ist sehr groß und wird verkleinert gespeichert, damit jeder Browser es verarbeiten kann.';
  saveButton.disabled = busy || !bitmap || rects.length === 0;
  $<HTMLButtonElement>('#pix-clear').disabled = busy || !bitmap;
  $<HTMLButtonElement>('#pix-add').disabled = busy || !bitmap;
}

async function open(next: File): Promise<void> {
  try {
    const loaded = await loadImage(next);
    bitmap?.close();
    bitmap = loaded;
    file = next;
    rects = [];
    editor.set([]);
    countLocalBytes(next.size);
    paint();
    render();
  } catch (error) {
    showToast(imageErrorMessage(error));
  }
}

export function openFiles(files: File[]): void {
  const [first] = files.filter(isImage);
  if (!first) {
    showToast('Nur Bilder (JPEG, PNG, WebP) werden übernommen.');
    return;
  }
  if (files.length > 1) showToast('Es wird ein Foto auf einmal bearbeitet: das erste.');
  void open(first);
}

async function save(): Promise<void> {
  if (!bitmap || !file) return;
  const scale = canvasScale(bitmap.width, bitmap.height);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(bitmap.width * scale));
  out.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const format = outputFormat(file);
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(bitmap, 0, 0, out.width, out.height);
    obscure(out);
    saveBlob(outputName(file.name, 'unkenntlich', format), await encodeCanvas(out, format));
    showToast('Fertig: Das Foto ist gespeichert. Prüf es, bevor du es veröffentlichst.');
  } catch (error) {
    showToast(imageErrorMessage(error));
  } finally {
    out.width = 0;
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

for (const b of modeButtons) {
  b.addEventListener('click', () => {
    mode = b.dataset.mode === 'black' ? 'black' : 'pixel';
    paint();
    render();
  });
}
$('#pix-add').addEventListener('click', () => editor.add({ x: 0.35, y: 0.35, w: 0.3, h: 0.2 }));
saveButton.addEventListener('click', () => void save());
$('#pix-clear').addEventListener('click', () => {
  bitmap?.close();
  bitmap = null;
  file = null;
  rects = [];
  editor.set([]);
  render();
  $<HTMLInputElement>('#pix-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#pix-drop'), $<HTMLInputElement>('#pix-input'), openFiles);
render();
