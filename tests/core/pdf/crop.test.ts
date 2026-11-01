import { degrees, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cropBox, POINTS_PER_MM } from '../../../src/core/pdf/crop-geometry.ts';
import { cropPages, CropError } from '../../../src/core/pdf/crop.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe('cropBox', () => {
  const box = { x: 10, y: 20, width: 400, height: 200 };

  it('ungedrehte Seite: Ränder von allen Seiten', () => {
    expect(cropBox(box, 0, { top: 10, right: 20, bottom: 30, left: 40 })).toEqual({
      x: 50,
      y: 50,
      width: 340,
      height: 160,
    });
  });

  it('ohne Ränder bleibt die Seite gleich', () => {
    expect(cropBox(box, 0, none)).toEqual(box);
  });

  it.each([90, 180, 270] as const)(
    'gedrehte Seite (%i Grad): oben ist oben auf dem Bildschirm',
    (rotation) => {
      const m = { top: 10, right: 0, bottom: 0, left: 0 };
      const got = cropBox(box, rotation, m);
      expect(got).not.toBeNull();
      const area = (got?.width ?? 0) * (got?.height ?? 0);
      expect(area).toBe(rotation === 180 ? 400 * 190 : 390 * 200);
    },
  );

  it('90 Grad: oberer Rand der Anzeige liegt am linken Rand des Benutzerraums', () => {
    // Bei /Rotate 90 (im Uhrzeigersinn) wandert die linke Kante der Seite nach oben
    const got = cropBox(box, 90, { top: 50, right: 0, bottom: 0, left: 0 });
    expect(got).toEqual({ x: 60, y: 20, width: 350, height: 200 });
  });

  it('zu großer Rand ergibt null', () => {
    expect(cropBox(box, 0, { top: 0, right: 200, bottom: 0, left: 195 })).toBeNull();
    expect(cropBox(box, 0, { top: 100, right: 0, bottom: 95, left: 0 })).toBeNull();
  });
});

describe('cropPages', () => {
  async function doc(): Promise<Uint8Array> {
    const d = await PDFDocument.create();
    d.addPage([400, 200]);
    const rotated = d.addPage([400, 200]);
    rotated.setRotation(degrees(90));
    d.addPage([400, 200]);
    return d.save();
  }

  it('schneidet nur die gewählten Seiten', async () => {
    const out = await PDFDocument.load(
      await cropPages(await doc(), { top: 0, right: 0, bottom: 0, left: 50 }, [0]),
    );
    const [a, , c] = out.getPages();
    expect(a?.getCropBox()).toMatchObject({ x: 50, width: 350 });
    expect(c?.getCropBox()).toMatchObject({ x: 0, width: 400 });
  });

  it('5 mm Rand auf allen Seiten', async () => {
    const mm = 5 * POINTS_PER_MM;
    const out = await PDFDocument.load(
      await cropPages(await doc(), { top: mm, right: mm, bottom: mm, left: mm }, null),
    );
    for (const p of out.getPages()) {
      const b = p.getCropBox();
      expect(b.width + b.height).toBeCloseTo(600 - 4 * mm, 3);
    }
  });

  it('wirft CropError mit Seitennummer', async () => {
    await expect(
      cropPages(await doc(), { top: 0, right: 0, bottom: 0, left: 395 }, [1]),
    ).rejects.toMatchObject({ code: 'margins-too-large', page: 2 });
    await expect(
      cropPages(await doc(), { top: 0, right: 0, bottom: 0, left: 395 }, null),
    ).rejects.toBeInstanceOf(CropError);
  });
});
