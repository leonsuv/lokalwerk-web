import { describe, expect, it } from 'vitest';
import { turnRect } from '../../../src/core/geometry/norm-rect.ts';
import { CAP_HEIGHT, MM, stampInView } from '../../../src/core/pdf/stamp-layout.ts';
import { toUserSpace, toVisible } from '../../../src/core/pdf/stamp-geometry.ts';
import type { PageRef, SignatureImage } from '../../../src/core/workshop/model.ts';
import { hasOverlay, pageOverlay } from '../../../src/core/workshop/overlay.ts';
import type { PageNumberOptions } from '../../../src/core/pdf/page-numbers.ts';

/** Feste Zeichenbreite: 0,5 × Schriftgröße je Zeichen */
const width = (text: string, size: number) => text.length * size * 0.5;
const image: SignatureImage = { id: 'g1', png: new Uint8Array([1]), width: 300, height: 100 };
const A4 = { width: 595, height: 842 };

function page(extra: Partial<Extract<PageRef, { kind: 'source' }>> = {}): PageRef {
  return { key: 'p1', kind: 'source', source: 's1', index: 0, rotate: 0, ...extra };
}

describe('pageOverlay (Vorschau von Stempel und Unterschrift)', () => {
  it('ohne Operationen nichts', () => {
    expect(pageOverlay(page(), A4, width)).toEqual([]);
    expect(hasOverlay(page())).toBe(false);
  });

  it('Stempel oben: mittig, Oberkante der Großbuchstaben 12 mm unter dem Rand, aufrecht', () => {
    const p = page({
      ops: [
        { type: 'stamp', stamp: { text: 'KOPIE', placement: 'top', color: 'red', opacity: 1 } },
      ],
    });
    const [item] = pageOverlay(p, A4, width);
    if (item?.kind !== 'text') throw new Error('Stempel fehlt');
    expect(item.angle).toBe(0);
    expect(item.size).toBe(28);
    expect(item.vx + width('KOPIE', 28) / 2).toBeCloseTo(A4.width / 2);
    expect(item.vy + 28 * CAP_HEIGHT).toBeCloseTo(A4.height - 12 * MM);
    expect(item.rgb).toEqual([0.8, 0.1, 0.1]);
  });

  it('Stempel quer: entlang der Diagonale der angezeigten Seite, Mitte in der Seitenmitte', () => {
    const view = { width: 842, height: 595 };
    const p = page({
      rotate: 90,
      ops: [
        {
          type: 'stamp',
          stamp: { text: 'ENTWURF', placement: 'diagonal', color: 'gray', opacity: 0.3 },
        },
      ],
    });
    const [item] = pageOverlay(p, view, width);
    if (item?.kind !== 'text') throw new Error('Stempel fehlt');
    expect(item.angle).toBeCloseTo((Math.atan2(595, 842) * 180) / Math.PI);
    expect(item.opacity).toBe(0.3);
    const rad = (item.angle * Math.PI) / 180;
    const w = width('ENTWURF', item.size);
    const h = item.size * CAP_HEIGHT;
    // Mitte der Zeile, zurückgerechnet vom Anfang der Grundlinie
    expect(item.vx + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad)).toBeCloseTo(421);
    expect(item.vy + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad)).toBeCloseTo(297.5);
  });

  it('Stempel in der Vorschau an derselben Stelle wie im Export (gleiche Rechnung)', () => {
    // Export: stampInView auf der sichtbaren Seite, dann in den Benutzerraum (drawStamp).
    const box = { x: 0, y: 0, width: 595, height: 842 };
    const look = { text: 'KOPIE', placement: 'bottom', color: 'blue', opacity: 1 } as const;
    const view = { width: 842, height: 595 };
    const inView = stampInView(view.width, view.height, look, (s) => width('KOPIE', s));
    const user = toUserSpace(box, 270, inView.vx, inView.vy);
    const back = toVisible(box, 270, user.x, user.y);
    const [item] = pageOverlay(
      page({ rotate: 270, ops: [{ type: 'stamp', stamp: look }] }),
      view,
      width,
    );
    if (item?.kind !== 'text') throw new Error('Stempel fehlt');
    expect(item.vx).toBeCloseTo(back.vx);
    expect(item.vy).toBeCloseTo(back.vy);
  });

  it('Stempel ohne Text zeichnet nichts', () => {
    const p = page({
      ops: [{ type: 'stamp', stamp: { text: '', placement: 'top', color: 'red', opacity: 1 } }],
    });
    expect(pageOverlay(p, A4, width)).toEqual([]);
  });

  it('Unterschrift: dreht mit der Seite, wenn diese seit dem Setzen gedreht wurde', () => {
    const rect = { x: 0.6, y: 0.8, w: 0.3, h: 0.1 };
    const placedUpright = page({
      rotate: 0,
      ops: [{ type: 'signature', image, rect, turn: 0 }],
    });
    expect(pageOverlay(placedUpright, A4, width)).toEqual([
      { kind: 'image', image, rect, turn: 0 },
    ]);
    const turnedLater = page({ rotate: 90, ops: [{ type: 'signature', image, rect, turn: 0 }] });
    expect(pageOverlay(turnedLater, A4, width)).toEqual([
      { kind: 'image', image, rect: turnRect(rect, 90), turn: 90 },
    ]);
    // Gesetzt, als die Seite schon um 90 Grad gedreht war: dort aufrecht
    const placedTurned = page({ rotate: 90, ops: [{ type: 'signature', image, rect, turn: 90 }] });
    expect(pageOverlay(placedTurned, A4, width)).toEqual([{ kind: 'image', image, rect, turn: 0 }]);
  });

  it('erst Unterschriften, dann Stempel (wie beim Export); Unterschriften lassen sich weglassen', () => {
    const p = page({
      ops: [
        { type: 'stamp', stamp: { text: 'KOPIE', placement: 'top', color: 'red', opacity: 1 } },
        { type: 'signature', image, rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, turn: 0 },
      ],
    });
    expect(pageOverlay(p, A4, width).map((i) => i.kind)).toEqual(['image', 'text']);
    expect(pageOverlay(p, A4, width, { signatures: false }).map((i) => i.kind)).toEqual(['text']);
    expect(hasOverlay(p)).toBe(true);
  });

  it('Seitenzahl: Text und Lage wie beim Speichern, zuletzt gezeichnet, vor „Ab Seite“ keine', () => {
    const options: PageNumberOptions = {
      format: 'seite-n-von-m',
      anchor: 'bottom-right',
      fromPage: 2,
      startAt: 1,
      fontSize: 10,
      marginMm: 10,
    };
    const p = page({
      ops: [
        { type: 'stamp', stamp: { text: 'KOPIE', placement: 'top', color: 'red', opacity: 1 } },
      ],
    });
    // Deckblatt (Seite 1) ohne Zahl
    expect(
      pageOverlay(p, A4, width, { numbers: { options, index: 0, count: 4 } }).map((i) => i.kind),
    ).toEqual(['text']);
    const items = pageOverlay(p, A4, width, { numbers: { options, index: 2, count: 4 } });
    const last = items.at(-1);
    if (last?.kind !== 'text') throw new Error('Seitenzahl fehlt');
    expect(last.text).toBe('Seite 2 von 3');
    expect(last.bold).toBe(false);
    expect(items[0]?.kind === 'text' && items[0].bold).toBe(true);
    // Rechts unten: Ende des Texts 10 mm vom rechten Rand, Grundlinie 10 mm über dem unteren
    expect(last.vx + width('Seite 2 von 3', 10)).toBeCloseTo(A4.width - 10 * MM);
    expect(last.vy).toBeCloseTo(10 * MM);
    expect(last.rgb).toEqual([0, 0, 0]);
    expect(hasOverlay(page(), { numbers: { options, index: 0, count: 1 } })).toBe(true);
  });
});
