/**
 * Zeichenfläche für eine Unterschrift und Aufbereitung als PNG mit durchsichtigem Hintergrund
 * (Werkzeug „Unterschrift einfügen“). Nichts wird gespeichert (AGENTS.md Regel 5).
 */

import { inkBounds, whiteToTransparent } from '../core/images/signature.ts';

export interface SignatureImage {
  png: Uint8Array;
  width: number;
  height: number;
  /** blob:-Adresse für die Vorschau; mit URL.revokeObjectURL freigeben */
  url: string;
}

/** Längste Kante eines ausgewählten Bildes, bevor es aufbereitet wird */
const MAX_IMAGE_SIDE = 1600;

/** Schneidet auf die Schrift zu und kodiert als PNG; null, wenn nichts zu sehen ist. */
async function cropToPng(source: HTMLCanvasElement): Promise<SignatureImage | null> {
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, source.width, source.height);
  const bounds = inkBounds(data.data, source.width, source.height, 6);
  if (!bounds) return null;
  const out = document.createElement('canvas');
  out.width = bounds.width;
  out.height = bounds.height;
  out.getContext('2d')?.putImageData(data, -bounds.x, -bounds.y);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    width: bounds.width,
    height: bounds.height,
    url: URL.createObjectURL(blob),
  };
}

/** Bild einer Unterschrift (Foto, Scan) laden, optional hellen Hintergrund entfernen */
export async function signatureFromFile(
  file: File,
  removeWhite: boolean,
): Promise<SignatureImage | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  if (removeWhite) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    whiteToTransparent(data.data);
    ctx.putImageData(data, 0, 0);
  }
  return cropToPng(canvas);
}

export class SignaturePad {
  private readonly canvas: HTMLCanvasElement;
  private readonly onChange: () => void;
  private drawing = false;
  private last: { x: number; y: number } | null = null;
  private empty = true;
  color = '#10204a';

  constructor(canvas: HTMLCanvasElement, onChange: () => void) {
    this.canvas = canvas;
    this.onChange = onChange;
    // Der erste Aufruf legt die Eigenschaften fest; die Fläche wird nach jedem Strich gelesen.
    canvas.getContext('2d', { willReadFrequently: true });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', () => this.up());
    canvas.addEventListener('pointercancel', () => this.up());
    new ResizeObserver(() => this.fit()).observe(canvas);
    this.fit();
  }

  get isEmpty(): boolean {
    return this.empty;
  }

  clear(): void {
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.empty = true;
    this.onChange();
  }

  toImage(): Promise<SignatureImage | null> {
    return cropToPng(this.canvas);
  }

  /** Pixelgröße an die angezeigte Größe anpassen; nur solange noch nichts gezeichnet ist. */
  private fit(): void {
    if (!this.empty) return;
    const ratio = globalThis.devicePixelRatio || 1;
    const box = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(box.width * ratio));
    this.canvas.height = Math.max(1, Math.round(box.height * ratio));
  }

  private point(e: PointerEvent): { x: number; y: number } {
    const box = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * this.canvas.width,
      y: ((e.clientY - box.top) / box.height) * this.canvas.height,
    };
  }

  private down(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.drawing = true;
    this.last = this.point(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.stroke(this.last, this.last);
    e.preventDefault();
  }

  private move(e: PointerEvent): void {
    if (!this.drawing || !this.last) return;
    const p = this.point(e);
    this.stroke(this.last, p);
    this.last = p;
  }

  private up(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    this.empty = false;
    this.onChange();
  }

  private stroke(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const ratio = globalThis.devicePixelRatio || 1;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.6 * ratio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
  }
}
