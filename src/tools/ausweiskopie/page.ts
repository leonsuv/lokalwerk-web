/**
 * Werkzeugseite „Ausweiskopie erstellen“ (plan-phase2.md Vorschlag A). Schwärzen und Aufdruck
 * werden fest in die Bildpunkte geschrieben; der Aufdruck „KOPIE“ ist immer an
 * (§ 20 Abs. 2 PAuswG, § 18 Abs. 3 PassG, Wortlaut in docs/ausweiskopie-recht.md).
 * Welche Felder geschwärzt werden, schreibt das Werkzeug nicht vor.
 */

import { isImage } from '../../core/files/classify.ts';
import { turnRect, type NormRect } from '../../core/geometry/norm-rect.ts';
import { copyMarkText, markLines, todayGerman } from '../../core/images/copy-mark.ts';
import { drawMatrix, rotatedSize, turn, type QuarterTurn } from '../../core/images/crop.ts';
import { fill } from '../../core/images/obscure.ts';
import type { IdImage } from '../../core/pdf/id-copy.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import {
  canvasScale,
  drawPreview,
  encodeCanvas,
  ImageEditError,
  imageErrorMessage,
  loadImage,
} from '../../ui/image-edit.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { RectEditor } from '../../ui/rect-editor.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import { zipBlobs } from '../../ui/zip.ts';
import type { IdCopyRequest } from './idcopy.worker.ts';

const worker = new Worker(new URL('./idcopy.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<IdCopyRequest>(worker);

const VIEW_MAX = 720;
const MAX_SIDES = 2;
/** Aufdruck: Winkel, Schriftgröße als Anteil der kürzeren Bildseite, Deckkraft */
const MARK_ANGLE = -Math.PI / 6;
const MARK_SIZE = 1 / 13;
const MARK_ALPHA = 0.42;
const MARK_FONT = 'Onest, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

interface Side {
  bitmap: ImageBitmap;
  rotate: QuarterTurn;
  rects: NormRect[];
}

const canvas = $<HTMLCanvasElement>('#idc-canvas');
// Die Vorschau wird nach jeder Änderung ausgelesen: Kontext gleich passend anlegen.
canvas.getContext('2d', { willReadFrequently: true });
const sideButtons = $$<HTMLButtonElement>('button[data-side]');
const formatButtons = $$<HTMLButtonElement>('button[data-format]');
const purposeInput = $<HTMLInputElement>('#idc-purpose');
const dateInput = $<HTMLInputElement>('#idc-date');
const saveButton = $<HTMLButtonElement>('#idc-save');
const saveLabel = $('#idc-save-label');
const idleLabel = saveLabel.textContent ?? '';

let sides: Side[] = [];
let active = 0;
let format: 'pdf' | 'jpg' = 'pdf';
let busy = false;

dateInput.value = todayGerman(new Date());

const editor = new RectEditor({
  layer: $('#idc-layer'),
  draw: true,
  label: (i) => `Geschwärzter Bereich ${i + 1}`,
  describedBy: 'idc-keys',
  home: $('#idc-add'),
  onChange: (value) => {
    const side = sides[active];
    if (side) side.rects = [...value];
    paint();
    render();
  },
});

const markText = () => copyMarkText({ purpose: purposeInput.value, date: dateInput.value });

/** Schwarze Flächen und Aufdruck auf ein Canvas, das die ganze gedrehte Seite zeigt */
function finish(target: HTMLCanvasElement, side: Side): void {
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const { width, height } = target;
  if (side.rects.length > 0) {
    const image = ctx.getImageData(0, 0, width, height);
    for (const r of side.rects) {
      fill(image.data, width, height, {
        x: r.x * width,
        y: r.y * height,
        width: r.w * width,
        height: r.h * height,
      });
    }
    ctx.putImageData(image, 0, 0);
  }

  const size = Math.max(10, Math.min(width, height) * MARK_SIZE);
  const text = markText();
  ctx.save();
  ctx.font = `700 ${size}px ${MARK_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(MARK_ANGLE);
  const unit = ctx.measureText(text).width + size * 2;
  const reach = Math.hypot(width, height) / 2;
  ctx.globalAlpha = MARK_ALPHA;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size / 8);
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#0e1530';
  for (const [i, line] of markLines(width, height, size * 2.6).entries()) {
    // Jede zweite Zeile versetzt, damit die Wörter nicht untereinander stehen
    const shift = i % 2 === 0 ? 0 : unit / 2;
    for (let x = -reach - unit + shift; x < reach; x += unit) {
      ctx.strokeText(text, x, line.offset);
      ctx.fillText(text, x, line.offset);
    }
  }
  ctx.restore();
}

function paint(): void {
  const side = sides[active];
  if (!side) return;
  const area = $('#idc-editor');
  area.hidden = false;
  drawPreview(
    canvas,
    side.bitmap,
    { rotate: side.rotate, flip: false },
    Math.min(VIEW_MAX, area.clientWidth || VIEW_MAX),
  );
  finish(canvas, side);
}

function render(): void {
  const side = sides[active];
  $('#idc-empty').hidden = sides.length > 0;
  $('#idc-editor').hidden = sides.length === 0;
  $('#idc-sides').hidden = sides.length < 2;
  for (const b of sideButtons)
    b.setAttribute('aria-pressed', String(Number(b.dataset.side) === active));
  for (const b of formatButtons)
    b.setAttribute('aria-pressed', String(b.dataset.format === format));
  $('#idc-mark').textContent = markText();
  $('#idc-format-hint').textContent =
    format === 'pdf'
      ? 'Eine PDF mit allen Seiten untereinander auf einem DIN-A4-Blatt.'
      : sides.length > 1
        ? 'Ein JPG-Bild je Seite, zusammen in einer ZIP-Datei.'
        : 'Ein JPG-Bild.';
  $('#idc-count').textContent = sides.length ? String(sides.length) : '–';
  $('#idc-rects').textContent = sides.length
    ? String(sides.reduce((sum, s) => sum + s.rects.length, 0))
    : '–';
  const reduced = $('#idc-reduced');
  reduced.hidden = !sides.some((s) => canvasScale(s.bitmap.width, s.bitmap.height) < 1);
  reduced.textContent =
    'Ein Bild ist sehr groß und wird verkleinert gespeichert, damit jeder Browser es verarbeiten kann.';
  saveButton.disabled = busy || !side;
  for (const id of ['#idc-add', '#idc-left', '#idc-right', '#idc-remove', '#idc-clear']) {
    $<HTMLButtonElement>(id).disabled = busy || !side;
  }
}

function select(index: number): void {
  active = index;
  editor.set(sides[active]?.rects ?? []);
  paint();
  render();
}

async function add(files: File[]): Promise<void> {
  const room = MAX_SIDES - sides.length;
  if (files.length > room) {
    showToast(
      room === 0
        ? 'Es sind schon zwei Seiten da. Entferne erst eine Seite.'
        : 'Eine Ausweiskopie hat höchstens zwei Seiten: Die ersten werden übernommen.',
    );
  }
  let added = false;
  for (const file of files.slice(0, room)) {
    try {
      sides.push({ bitmap: await loadImage(file), rotate: 0, rects: [] });
      countLocalBytes(file.size);
      added = true;
    } catch (error) {
      showToast(imageErrorMessage(error));
    }
  }
  // Aufdruck in der eigenen Schrift, sobald sie geladen ist (lokal, public/fonts/)
  await document.fonts.load(`700 16px ${MARK_FONT}`).catch(() => undefined);
  if (added) select(sides.length - 1);
  else render();
}

export function openFiles(files: File[]): void {
  const images = files.filter(isImage);
  if (images.length < files.length) showToast('Nur Bilder (JPEG, PNG, WebP) werden übernommen.');
  if (images.length > 0) void add(images);
}

function rotateActive(by: 90 | -90): void {
  const side = sides[active];
  if (!side) return;
  side.rotate = turn(side.rotate, by);
  side.rects = side.rects.map((r) => turnRect(r, by));
  select(active);
}

/** Eine Seite in voller Größe, geschwärzt und gekennzeichnet, als JPEG */
async function renderSide(side: Side): Promise<{ blob: Blob; width: number; height: number }> {
  const transform = { rotate: side.rotate, flip: false };
  const size = rotatedSize(side.bitmap.width, side.bitmap.height, side.rotate);
  const scale = canvasScale(size.width, size.height);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(size.width * scale));
  out.height = Math.max(1, Math.round(size.height * scale));
  try {
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new ImageEditError('too-large');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.transform(...drawMatrix(side.bitmap.width, side.bitmap.height, transform));
    ctx.drawImage(side.bitmap, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    finish(out, side);
    return { blob: await encodeCanvas(out, 'image/jpeg'), width: out.width, height: out.height };
  } finally {
    out.width = 0;
  }
}

async function save(): Promise<void> {
  if (sides.length === 0) return;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const rendered = [];
    for (const side of sides) rendered.push(await renderSide(side));
    if (format === 'pdf') {
      const images: IdImage[] = [];
      for (const r of rendered) {
        images.push({
          jpeg: new Uint8Array(await r.blob.arrayBuffer()),
          width: r.width,
          height: r.height,
        });
      }
      const bytes = await client.request<Uint8Array>({ type: 'build', images });
      saveBlob(
        'ausweiskopie.pdf',
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      );
    } else if (rendered.length === 1 && rendered[0]) {
      saveBlob('ausweiskopie.jpg', rendered[0].blob);
    } else {
      saveBlob(
        'ausweiskopie.zip',
        await zipBlobs(
          rendered.map((r, i) => ({ name: `ausweiskopie-seite-${i + 1}.jpg`, blob: r.blob })),
        ),
      );
    }
    showToast('Fertig: Die Ausweiskopie ist gespeichert. Prüf sie, bevor du sie weitergibst.');
  } catch (error) {
    showToast(imageErrorMessage(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

for (const b of sideButtons) b.addEventListener('click', () => select(Number(b.dataset.side)));
for (const b of formatButtons) {
  b.addEventListener('click', () => {
    format = b.dataset.format === 'jpg' ? 'jpg' : 'pdf';
    render();
  });
}
for (const input of [purposeInput, dateInput]) {
  input.addEventListener('input', () => {
    paint();
    render();
  });
}
$('#idc-add').addEventListener('click', () => editor.add({ x: 0.1, y: 0.4, w: 0.3, h: 0.12 }));
$('#idc-left').addEventListener('click', () => rotateActive(-90));
$('#idc-right').addEventListener('click', () => rotateActive(90));
$('#idc-remove').addEventListener('click', () => {
  sides[active]?.bitmap.close();
  sides.splice(active, 1);
  select(Math.max(0, active - 1));
  if (sides.length === 0) $<HTMLInputElement>('#idc-input').focus();
});
saveButton.addEventListener('click', () => void save());
$('#idc-clear').addEventListener('click', () => {
  for (const s of sides) s.bitmap.close();
  sides = [];
  select(0);
  $<HTMLInputElement>('#idc-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#idc-drop'), $<HTMLInputElement>('#idc-input'), openFiles);
render();
