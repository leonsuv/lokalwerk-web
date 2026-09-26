/**
 * QR-Code auf eine Zeichenfläche malen (Vorschau und PNG) und als PNG oder SVG speichern.
 * Schwarz auf Weiß mit Ruhezone von 4 Modulen (core/qr/encode.ts). Auf Wunsch stehen Textzeilen
 * darunter, etwa die Überweisungsdaten im Klartext (EPC069-12, Kap. 1).
 */

import { QUIET_ZONE, type QrMatrix } from '../core/qr/encode.ts';
import { saveBlob } from './download.ts';

const FONT = 'Onest, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

/** Bricht Textzeilen an Wortgrenzen so um, dass sie in `width` passen */
function wrap(ctx: CanvasRenderingContext2D, lines: readonly string[], width: number): string[] {
  const out: string[] = [];
  for (const line of lines) {
    let current = '';
    for (const word of line.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > width) {
        out.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    out.push(current);
  }
  return out;
}

export function drawQr(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  modulePx: number,
  caption: readonly string[] = [],
): void {
  const side = (matrix.size + 2 * QUIET_ZONE) * modulePx;
  const left = QUIET_ZONE * modulePx;
  const fontPx = Math.max(12, Math.round(side / 24));
  const lineHeight = Math.round(fontPx * 1.45);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const font = `500 ${fontPx}px ${FONT}`;
  ctx.font = font;
  const lines = wrap(ctx, caption, side - 2 * left);
  canvas.width = side;
  canvas.height = side + (lines.length > 0 ? lines.length * lineHeight + fontPx : 0);
  // Größenänderung setzt den Zustand der Zeichenfläche zurück
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  matrix.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) {
        ctx.fillRect((x + QUIET_ZONE) * modulePx, (y + QUIET_ZONE) * modulePx, modulePx, modulePx);
      }
    }),
  );
  ctx.font = font;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, left, side + i * lineHeight));
}

export async function savePng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('encode');
  saveBlob(filename, blob);
}

export function saveSvg(svg: string, filename: string): void {
  saveBlob(filename, new Blob([svg], { type: 'image/svg+xml' }));
}
