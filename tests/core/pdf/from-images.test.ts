import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { A4, imagesToPdf, MM, placeImage } from '../../../src/core/pdf/from-images.ts';

describe('A4 in Punkt', () => {
  it('entspricht 210 × 297 mm bei 72 pt je Zoll', () => {
    expect(A4.width).toBeCloseTo(595.276, 3);
    expect(A4.height).toBeCloseTo(841.89, 2);
    expect(MM * 25.4).toBeCloseTo(72, 10);
  });
});

describe('placeImage', () => {
  it('stellt Querformate bei „auto“ quer und Hochformate hoch', () => {
    expect(placeImage(4000, 3000, 'a4-auto', 0).pageWidth).toBeCloseTo(A4.height, 5);
    expect(placeImage(3000, 4000, 'a4-auto', 0).pageWidth).toBeCloseTo(A4.width, 5);
    expect(placeImage(1000, 1000, 'a4-auto', 0).pageWidth).toBeCloseTo(A4.width, 5);
    expect(placeImage(4000, 3000, 'a4-portrait', 0).pageWidth).toBeCloseTo(A4.width, 5);
    expect(placeImage(3000, 4000, 'a4-landscape', 0).pageWidth).toBeCloseTo(A4.height, 5);
  });

  it('passt das Bild mit gleichem Seitenverhältnis in den Bereich innerhalb des Rands und zentriert es', () => {
    const p = placeImage(2000, 1000, 'a4-portrait', 10);
    const area = A4.width - 20 * MM;
    expect(p.width).toBeCloseTo(area, 5);
    expect(p.height).toBeCloseTo(area / 2, 5);
    expect(p.x).toBeCloseTo(10 * MM, 5);
    expect(p.y).toBeCloseTo((A4.height - area / 2) / 2, 5);
  });

  it('vergrößert kleine Bilder ebenfalls auf die verfügbare Fläche', () => {
    const p = placeImage(100, 141, 'a4-portrait', 0);
    expect(p.width).toBeCloseTo(A4.width, 0);
  });
});

/** Kleinste gültige PNG-Datei: 1 × 1 Pixel, von pdf-lib selbst nicht erzeugbar, daher von Hand. */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

describe('imagesToPdf', () => {
  it('erzeugt eine Seite je Bild, ohne Metadaten', async () => {
    const png = { bytes: PNG_1X1, type: 'image/png' as const, width: 1, height: 1 };
    const bytes = await imagesToPdf([png, { ...png, width: 2 }], 'a4-auto', 10);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(1).getWidth()).toBeCloseTo(A4.height, 3);
    expect(new TextDecoder('latin1').decode(bytes)).not.toMatch(/pdf-lib|Producer|Creator/);
  });

  it('meldet beschädigte Bilddaten als Fehler', async () => {
    await expect(
      imagesToPdf(
        [{ bytes: new Uint8Array([1, 2, 3]), type: 'image/jpeg', width: 1, height: 1 }],
        'a4-auto',
        0,
      ),
    ).rejects.toMatchObject({ name: 'PdfError' });
  });
});
