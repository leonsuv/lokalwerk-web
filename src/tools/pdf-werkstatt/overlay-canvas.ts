/**
 * Stempel und Unterschriften über eine gerenderte Seite zeichnen (core/workshop/overlay.ts),
 * damit Vorschaubilder und große Vorschau zeigen, was beim Speichern entsteht.
 *
 * Schrift: Der Export setzt Helvetica fett (PDF-Standardschrift). Hier zeichnet der Browser mit
 * einer vorhandenen Systemschrift gleicher Maße (Helvetica, Arial oder Liberation Sans), keine
 * nachgeladene Schrift (AGENTS.md Regel 2). Gemessen wird mit derselben Schrift, daher passen
 * Größe und Lage auch dann, wenn keine davon vorhanden ist.
 */

import { pageOverlay, type OverlayOptions } from '../../core/workshop/overlay.ts';
import type { PageBox, PageRef, SignatureImage } from '../../core/workshop/model.ts';

const FONT = 'Helvetica, Arial, "Liberation Sans", sans-serif';

/** Je Unterschriftsbild einmal dekodiert; fällt weg, wenn das Bild nicht mehr gebraucht wird */
const bitmaps = new WeakMap<SignatureImage, Promise<ImageBitmap>>();

function bitmapOf(image: SignatureImage): Promise<ImageBitmap> {
  let bitmap = bitmaps.get(image);
  if (!bitmap) {
    bitmap = createImageBitmap(
      new Blob([image.png as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
    );
    bitmaps.set(image, bitmap);
    bitmap.catch(() => bitmaps.delete(image));
  }
  return bitmap;
}

/** `view`: Größe der angezeigten Seite in Punkt; das Canvas zeigt sie ganz */
export async function drawOverlay(
  canvas: HTMLCanvasElement,
  page: PageRef,
  view: PageBox,
  options: OverlayOptions = {},
): Promise<void> {
  if (!page.ops?.length) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const measure = (text: string, size: number) => {
    // Bei 100 px messen und umrechnen: genauer als bei kleinen Größen
    ctx.font = `bold 100px ${FONT}`;
    return (ctx.measureText(text).width * size) / 100;
  };
  const items = pageOverlay(page, view, measure, options);
  const images = await Promise.all(
    items.map((item) => (item.kind === 'image' ? bitmapOf(item.image) : Promise.resolve(null))),
  );
  const sx = canvas.width / view.width;
  const sy = canvas.height / view.height;
  for (const [i, item] of items.entries()) {
    ctx.save();
    if (item.kind === 'image') {
      const bitmap = images[i];
      if (bitmap) {
        const w = item.rect.w * canvas.width;
        const h = item.rect.h * canvas.height;
        ctx.translate(item.rect.x * canvas.width + w / 2, item.rect.y * canvas.height + h / 2);
        ctx.rotate((item.turn * Math.PI) / 180);
        // Gedreht um 90 oder 270 Grad liegt das Bild quer im Rechteck
        const [iw, ih] = item.turn === 90 || item.turn === 270 ? [h, w] : [w, h];
        ctx.drawImage(bitmap, -iw / 2, -ih / 2, iw, ih);
      }
    } else {
      const [r, g, b] = item.rgb.map((c) => Math.round(c * 255));
      ctx.globalAlpha = item.opacity;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.font = `bold ${item.size * sx}px ${FONT}`;
      ctx.textBaseline = 'alphabetic';
      // Ansicht: Ursprung unten links, Winkel gegen den Uhrzeigersinn; Canvas umgekehrt
      ctx.translate(item.vx * sx, canvas.height - item.vy * sy);
      ctx.rotate((-item.angle * Math.PI) / 180);
      ctx.fillText(item.text, 0, 0);
    }
    ctx.restore();
  }
}
