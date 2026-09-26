import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { degrees, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { placeImage, placeOnPage } from '../../../src/core/pdf/place-image.ts';
import { toVisible, type PageRotation } from '../../../src/core/pdf/stamp-geometry.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** Kleinstes gültiges PNG, 1 × 1 Pixel, durchsichtig */
function png(): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

describe('placeOnPage', () => {
  const box = { x: 10, y: 20, width: 600, height: 800 };

  it.each([0, 90, 180, 270] as PageRotation[])(
    'die sichtbare Ecke unten links landet an der richtigen Stelle (/Rotate %i)',
    (rotation) => {
      const rect = { x: 0.1, y: 0.7, w: 0.3, h: 0.1 };
      const p = placeOnPage(box, rotation, rect);
      const visible = toVisible(box, rotation, p.x, p.y);
      const W = rotation % 180 === 0 ? 600 : 800;
      const H = rotation % 180 === 0 ? 800 : 600;
      expect(visible.vx).toBeCloseTo(0.1 * W);
      expect(visible.vy).toBeCloseTo((1 - 0.7 - 0.1) * H);
      expect(p.width).toBeCloseTo(0.3 * W);
      expect(p.height).toBeCloseTo(0.1 * H);
      expect(p.rotate).toBe(rotation);
    },
  );
});

describe('placeImage', () => {
  it('setzt das Bild und behält Metadaten und übrige Seiten', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.setTitle('Bleibt');
    doc.addPage([595, 842]);
    doc.addPage([595, 842]).setRotation(degrees(90));
    const out = await placeImage(await doc.save(), png(), [
      { page: 2, rect: { x: 0.5, y: 0.8, w: 0.3, h: 0.1 } },
    ]);
    const result = await PDFDocument.load(out, { updateMetadata: false });
    expect(result.getTitle()).toBe('Bleibt');
    expect(result.getPageCount()).toBe(2);
    // Bild nur auf Seite 2 (pdf-lib benennt eingebettete Bilder /Image-…)
    expect(String(result.getPage(1).node.Resources())).toMatch(/\/Image-\d+/);
    expect(String(result.getPage(0).node.Resources())).not.toMatch(/\/Image-\d+/);
  });

  it('lehnt verschlüsselte PDFs ab', async () => {
    await expect(placeImage(fixture('passwort-zum-oeffnen.pdf'), png(), [])).rejects.toMatchObject({
      code: 'encrypted',
    });
  });
});
