/**
 * Werkzeugseite „Foto zuschneiden und drehen“ (plan-phase2.md, Werkzeug 13). Keine
 * Passbild-Voreinstellung (Leon, 26.09.2026). Läuft auf der Seite: ein Canvas im Zuschnittsmaß.
 */

import { isImage } from '../../core/files/classify.ts';
import {
  centeredRect,
  cropPixelsExact,
  drawMatrix,
  rotatedSize,
  turn,
  type Transform,
} from '../../core/images/crop.ts';
import type { NormRect } from '../../core/geometry/norm-rect.ts';
import { $ } from '../../ui/dom.ts';
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
const canvas = $<HTMLCanvasElement>('#crop-canvas');
const ratioSelect = $<HTMLSelectElement>('#crop-ratio');
const saveButton = $<HTMLButtonElement>('#crop-save');
const saveLabel = $('#crop-save-label');
const idleLabel = saveLabel.textContent ?? '';

let file: File | null = null;
let bitmap: ImageBitmap | null = null;
let transform: Transform = { rotate: 0, flip: false };
let rect: NormRect = { x: 0, y: 0, w: 1, h: 1 };
let busy = false;

/** Seitenverhältnis Breite/Höhe in Pixeln, oder null für frei */
function ratio(): number | null {
  const v = ratioSelect.value;
  if (v === 'free') return null;
  if (v === 'original' && bitmap) {
    const s = rotatedSize(bitmap.width, bitmap.height, transform.rotate);
    return s.width / s.height;
  }
  return Number(v);
}

const editor = new RectEditor({
  layer: $('#crop-layer'),
  draw: false,
  deletable: false,
  aspect: () => ratio() ?? undefined,
  label: () => 'Ausschnitt',
  describedBy: 'crop-keys',
  onChange: (value) => {
    rect = value[0] ?? rect;
    render();
  },
});

function size(): { width: number; height: number } {
  return bitmap
    ? rotatedSize(bitmap.width, bitmap.height, transform.rotate)
    : { width: 0, height: 0 };
}

function render(): void {
  $('#crop-empty').hidden = bitmap !== null;
  $('#crop-editor').hidden = bitmap === null;
  $('#crop-flip').setAttribute('aria-pressed', String(transform.flip));
  const s = size();
  const out = cropPixelsExact(rect, s.width, s.height, ratio());
  const scale = canvasScale(out.width, out.height);
  $('#crop-size').textContent = bitmap ? `${s.width} × ${s.height} Pixel` : '–';
  $('#crop-out').textContent = bitmap
    ? `${Math.round(out.width * scale)} × ${Math.round(out.height * scale)} Pixel`
    : '–';
  const reduced = $('#crop-reduced');
  reduced.hidden = scale >= 1;
  reduced.textContent =
    'Der Ausschnitt ist sehr groß und wird verkleinert gespeichert, damit jeder Browser ihn verarbeiten kann.';
  for (const id of ['#crop-save', '#crop-reset', '#crop-clear']) {
    $<HTMLButtonElement>(id).disabled = busy || bitmap === null;
  }
}

function redraw(resetRect: boolean): void {
  if (!bitmap) return;
  // Erst einblenden, dann messen: ein versteckter Bereich ist 0 Pixel breit.
  const area = $('#crop-editor');
  area.hidden = false;
  const s = drawPreview(
    canvas,
    bitmap,
    transform,
    Math.min(VIEW_MAX, area.clientWidth || VIEW_MAX),
  );
  if (resetRect) rect = centeredRect(ratio(), s.width, s.height);
  editor.set([rect]);
  render();
}

async function open(next: File): Promise<void> {
  try {
    const loaded = await loadImage(next);
    bitmap?.close();
    bitmap = loaded;
    file = next;
    transform = { rotate: 0, flip: false };
    ratioSelect.value = 'free';
    countLocalBytes(next.size);
    redraw(true);
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
  const s = size();
  const area = cropPixelsExact(rect, s.width, s.height, ratio());
  const scale = canvasScale(area.width, area.height);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(area.width * scale));
  out.height = Math.max(1, Math.round(area.height * scale));
  const ctx = out.getContext('2d');
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
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(-area.x, -area.y);
    ctx.transform(...drawMatrix(bitmap.width, bitmap.height, transform));
    ctx.drawImage(bitmap, 0, 0);
    const blob = await encodeCanvas(out, format);
    saveBlob(outputName(file.name, 'zugeschnitten', format), blob);
    showToast('Fertig: Das zugeschnittene Foto ist gespeichert.');
  } catch (error) {
    showToast(imageErrorMessage(error));
  } finally {
    out.width = 0;
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

ratioSelect.addEventListener('change', () => redraw(true));
$('#crop-left').addEventListener('click', () => {
  transform = { ...transform, rotate: turn(transform.rotate, -90) };
  redraw(true);
});
$('#crop-right').addEventListener('click', () => {
  transform = { ...transform, rotate: turn(transform.rotate, 90) };
  redraw(true);
});
$('#crop-flip').addEventListener('click', () => {
  transform = { ...transform, flip: !transform.flip };
  redraw(false);
});
$('#crop-reset').addEventListener('click', () => {
  transform = { rotate: 0, flip: false };
  ratioSelect.value = 'free';
  redraw(true);
});
saveButton.addEventListener('click', () => void save());
$('#crop-clear').addEventListener('click', () => {
  bitmap?.close();
  bitmap = null;
  file = null;
  render();
  $<HTMLInputElement>('#crop-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#crop-drop'), $<HTMLInputElement>('#crop-input'), openFiles);
render();
