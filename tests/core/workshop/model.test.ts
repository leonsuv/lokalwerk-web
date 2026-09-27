import { describe, expect, it } from 'vitest';
import {
  addSources,
  copyPages,
  deletePages,
  duplicatePages,
  insertBlank,
  movePages,
  rotatePages,
  setPageNumbers,
  setSignatures,
  setStamp,
  shiftPages,
} from '../../../src/core/workshop/commands.ts';
import {
  exportPlan,
  imagePageBox,
  lossFacts,
  pdfFileName,
  selectionPlan,
} from '../../../src/core/workshop/export-plan.ts';
import {
  A4_LANDSCAPE,
  A4_PORTRAIT,
  blankBoxFor,
  counterIds,
  docNameFromFile,
  EMPTY_STATE,
  picksFromPlan,
  totalSourceSize,
  unchangedSource,
  visiblePageSize,
  type Source,
} from '../../../src/core/workshop/model.ts';
import { bench, keysOf, pdfSource } from './helpers.ts';

describe('Namen', () => {
  it('Dokumentname ohne Endung, Dateiname mit genau einer .pdf', () => {
    expect(docNameFromFile('Vertrag.PDF')).toBe('Vertrag');
    expect(docNameFromFile('Scan.jpeg')).toBe('Scan');
    expect(docNameFromFile('.pdf')).toBe('.pdf');
    expect(pdfFileName('Vertrag')).toBe('Vertrag.pdf');
    expect(pdfFileName('Vertrag.pdf ')).toBe('Vertrag.pdf');
    expect(pdfFileName('  ')).toBe('Dokument.pdf');
  });
});

describe('Seitengrößen', () => {
  const rotated: Source = {
    ...pdfSource('q', 2),
    pages: [
      { box: { width: 600, height: 800 }, rotate: 90 },
      { box: { width: 600, height: 800 }, rotate: 0 },
    ],
  };

  it('berücksichtigt die eigene Drehung der Seite und die zusätzliche', () => {
    const b = bench(rotated);
    const [p1, p2] = b.state.docs[0]?.pages ?? [];
    if (!p1 || !p2) throw new Error('Seiten fehlen');
    expect(visiblePageSize(b.state, p1)).toEqual({ width: 800, height: 600 });
    expect(visiblePageSize(b.state, p2)).toEqual({ width: 600, height: 800 });
    b.run(rotatePages([p1.key], 90));
    const turned = b.state.docs[0]?.pages[0];
    if (!turned) throw new Error('Seite fehlt');
    expect(visiblePageSize(b.state, turned)).toEqual({ width: 600, height: 800 });
  });

  it('Leerseite: wie die Nachbarseite davor, sonst danach, sonst DIN A4 hoch (W14)', () => {
    const b = bench(rotated);
    const doc = b.state.docs[0];
    if (!doc) throw new Error('Dokument fehlt');
    expect(blankBoxFor(b.state, doc, 1)).toEqual({ width: 800, height: 600 });
    expect(blankBoxFor(b.state, doc, 0)).toEqual({ width: 800, height: 600 });
    expect(blankBoxFor(b.state, doc, 2)).toEqual({ width: 600, height: 800 });
    expect(blankBoxFor(b.state, { id: 'x', name: 'x', pages: [] }, 0)).toEqual(A4_PORTRAIT);
    expect(A4_LANDSCAPE.width).toBeCloseTo(841.89, 2);
  });

  it('Bildseite: DIN A4 nach Ausrichtung des Bilds', () => {
    expect(imagePageBox(4000, 3000)).toEqual(A4_LANDSCAPE);
    expect(imagePageBox(3000, 4000)).toEqual(A4_PORTRAIT);
  });
});

describe('unverändertes Dokument (W12)', () => {
  it('erkennt nur eine vollständige Quelle in Originalreihenfolge ohne Drehung', () => {
    const b = bench(pdfSource('a', 3), pdfSource('b', 1));
    const doc = () => b.state.docs[0] ?? { id: '', name: '', pages: [] };
    expect(unchangedSource(b.state, doc())?.id).toBe('a');
    const id = doc().id;
    const variants = [
      rotatePages(keysOf(b.state, 0, 1), 90),
      shiftPages(keysOf(b.state, 0, 1), -1),
      deletePages(keysOf(b.state, 0, 2)),
      duplicatePages(keysOf(b.state, 0, 0)),
      insertBlank(id, 3, { width: 1, height: 1 }),
      copyPages(keysOf(b.state, 1, 0), id, 3),
    ];
    for (const command of variants) {
      const changed = command.apply(b.state, b.ids).state;
      expect(unchangedSource(changed, changed.docs[0] ?? doc())).toBeNull();
    }
    // Zweimal gedreht um 180 Grad ist wieder unverändert.
    const twice = rotatePages(keysOf(b.state, 0, 0), 180).apply(b.state, b.ids).state;
    const back = rotatePages(keysOf(twice, 0, 0), 180).apply(twice, b.ids).state;
    expect(unchangedSource(back, back.docs[0] ?? doc())?.id).toBe('a');
    // Bilder werden nie „unverändert“ ausgegeben.
    const image = addSources([{ ...pdfSource('i', 1, 'Foto.jpg'), kind: 'image' }]).apply(
      EMPTY_STATE,
      counterIds(),
    ).state;
    expect(unchangedSource(image, image.docs[0] ?? doc())).toBeNull();
  });
});

describe('Übergabe aus „PDF-Seiten bearbeiten“', () => {
  it('rechnet Seiten ab 1 in Seiten ab 0 um und normalisiert die Drehung', () => {
    expect(
      picksFromPlan([
        { source: 3, rotate: 90 },
        { source: 1, rotate: -90 },
        { source: 2, rotate: 360 },
      ]),
    ).toEqual([
      { index: 2, rotate: 90 },
      { index: 0, rotate: 270 },
      { index: 1, rotate: 0 },
    ]);
  });

  it('zeigt das Dokument bearbeitet und gibt es beim Export so aus', () => {
    // Gelöscht: Seite 2; umsortiert: 4 vor 1; gedreht: Seite 3
    const plan = [
      { source: 4, rotate: 0 },
      { source: 1, rotate: 0 },
      { source: 3, rotate: 90 },
    ];
    const state = addSources(
      [pdfSource('a', 4, 'Vertrag.pdf')],
      undefined,
      new Map([['a', picksFromPlan(plan)]]),
    ).apply(EMPTY_STATE, counterIds()).state;
    const doc = state.docs[0];
    expect(doc && unchangedSource(state, doc)).toBeNull();
    expect(exportPlan(state, [doc?.id ?? ''])).toEqual([
      {
        name: 'Vertrag.pdf',
        pages: [
          { kind: 'source', source: 'a', index: 3, rotate: 0 },
          { kind: 'source', source: 'a', index: 0, rotate: 0 },
          { kind: 'source', source: 'a', index: 2, rotate: 90 },
        ],
      },
    ]);
  });

  it('bleibt ohne Änderungen die Originaldatei (W12)', () => {
    const plan = [1, 2, 3].map((source) => ({ source, rotate: 0 }));
    const state = addSources(
      [pdfSource('a', 3)],
      undefined,
      new Map([['a', picksFromPlan(plan)]]),
    ).apply(EMPTY_STATE, counterIds()).state;
    const doc = state.docs[0];
    expect(doc && unchangedSource(state, doc)?.id).toBe('a');
  });
});

describe('Seitenzahlen im Export (Stufe 2.1)', () => {
  const numbers = {
    format: 'n',
    anchor: 'bottom-right',
    fromPage: 1,
    startAt: 1,
    fontSize: 10,
    marginMm: 10,
  } as const;

  it('ein Dokument mit Seitenzahlen ist nie unverändert und nimmt sie in den Plan mit', () => {
    const b = bench(pdfSource('a', 2));
    const id = b.state.docs[0]?.id ?? '';
    b.run(setPageNumbers(id, numbers));
    const doc = b.state.docs[0];
    expect(doc && unchangedSource(b.state, doc)).toBeNull();
    expect(exportPlan(b.state, [id])).toEqual([
      {
        name: 'a.pdf',
        pages: [
          { kind: 'source', source: 'a', index: 0, rotate: 0 },
          { kind: 'source', source: 'a', index: 1, rotate: 0 },
        ],
        numbers,
      },
    ]);
  });

  it('„Auswahl als neue PDF“ ist ein neues Dokument ohne Seitenzahlen', () => {
    const b = bench(pdfSource('a', 2));
    b.run(setPageNumbers(b.state.docs[0]?.id ?? '', numbers));
    expect(selectionPlan(b.state, keysOf(b.state, 0, 1), 'Auswahl')).not.toHaveProperty('numbers');
  });

  it('Hinweise vor dem Export zählen ein Dokument mit Seitenzahlen als neu zusammengesetzt', () => {
    const b = bench({ ...pdfSource('a', 1), facts: { ...pdfSource('a', 1).facts, form: true } });
    const id = b.state.docs[0]?.id ?? '';
    expect(lossFacts(b.state, [id]).form).toBe(false);
    b.run(setPageNumbers(id, numbers));
    expect(lossFacts(b.state, [id]).form).toBe(true);
  });
});

describe('Seiten-Operationen im Export (Stufe 2.2)', () => {
  const stamp = { text: 'KOPIE', placement: 'top', color: 'red', opacity: 0.5 } as const;
  const image = { id: 'g7', png: new Uint8Array([9]), width: 3, height: 1 };

  it('nimmt Stempel und Unterschriften je Seite mit; unverändert ist das Dokument dann nicht', () => {
    const b = bench(pdfSource('a', 2));
    const id = b.state.docs[0]?.id ?? '';
    const [first, second] = keysOf(b.state, 0, 0, 1);
    b.run(setStamp([first ?? ''], stamp));
    expect(unchangedSource(b.state, b.state.docs[0] ?? { id: '', name: '', pages: [] })).toBeNull();
    b.run(setSignatures(second ?? '', image, [{ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }]));
    expect(exportPlan(b.state, [id])[0]?.pages).toEqual([
      { kind: 'source', source: 'a', index: 0, rotate: 0, stamp },
      {
        kind: 'source',
        source: 'a',
        index: 1,
        rotate: 0,
        signatures: [
          { id: 'g7', png: image.png, rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, turn: 0 },
        ],
      },
    ]);
    // Auch „Auswahl als neue PDF“ behält die Operationen der Seiten
    expect(selectionPlan(b.state, [first ?? ''], 'Auswahl')?.pages[0]).toMatchObject({ stamp });
  });
});

describe('exportPlan', () => {
  it('Dokumente in Spaltenreihenfolge, gleiche Namen mit (2), leere übersprungen (W11)', () => {
    const b = bench(
      pdfSource('a', 2, 'Vertrag.pdf'),
      pdfSource('b', 1, 'vertrag.pdf'),
      pdfSource('c', 1, 'Vertrag.pdf'),
    );
    const [a, bb, c] = b.state.docs.map((d) => d.id);
    b.run(movePages(keysOf(b.state, 2, 0), a ?? '', 0));
    b.run(rotatePages(keysOf(b.state, 1, 0), 90));
    const plan = exportPlan(b.state, [c ?? '', bb ?? '', a ?? '']);
    expect(plan).toEqual([
      {
        name: 'Vertrag.pdf',
        pages: [
          { kind: 'source', source: 'c', index: 0, rotate: 0 },
          { kind: 'source', source: 'a', index: 0, rotate: 0 },
          { kind: 'source', source: 'a', index: 1, rotate: 0 },
        ],
      },
      { name: 'vertrag (2).pdf', pages: [{ kind: 'source', source: 'b', index: 0, rotate: 90 }] },
    ]);
  });

  it('markiert unveränderte Dokumente mit der Originalquelle', () => {
    const b = bench(pdfSource('a', 2, 'Vertrag.pdf'));
    b.run(insertBlank(b.state.docs[0]?.id ?? '', 2, { width: 10, height: 20 }));
    b.run(addSources([pdfSource('b', 1, 'Anlage.pdf')]));
    const [a, bb] = b.state.docs.map((d) => d.id);
    const plan = exportPlan(b.state, [a ?? '', bb ?? '']);
    expect(plan[0]?.original).toBeUndefined();
    expect(plan[0]?.pages[2]).toEqual({ kind: 'blank', width: 10, height: 20, rotate: 0 });
    expect(plan[1]?.original).toBe('b');
  });

  it('Auswahl als neue PDF in der Reihenfolge der Spalten', () => {
    const b = bench(pdfSource('a', 3), pdfSource('b', 1));
    const plan = selectionPlan(
      b.state,
      [...keysOf(b.state, 1, 0), ...keysOf(b.state, 0, 2)],
      'Auswahl',
    );
    expect(plan?.name).toBe('Auswahl.pdf');
    expect(plan?.pages.map((p) => (p.kind === 'source' ? p.source + p.index : ''))).toEqual([
      'a2',
      'b0',
    ]);
    expect(selectionPlan(b.state, [], 'x')).toBeNull();
    // Alle Seiten einer Quelle in Reihenfolge: Originaldatei
    expect(selectionPlan(b.state, keysOf(b.state, 1, 0), 'x')?.original).toBe('b');
  });

  it('Hinweise nur für Quellen, deren Dokument neu zusammengesetzt wird', () => {
    const form: Source = {
      ...pdfSource('f', 2),
      facts: { form: true, xfa: false, outline: true, signed: false },
    };
    const b = bench(form, pdfSource('s', 1));
    const [f, s] = b.state.docs.map((d) => d.id);
    expect(lossFacts(b.state, [f ?? '', s ?? ''])).toEqual({
      form: false,
      xfa: false,
      outline: false,
      signed: false,
    });
    b.run(movePages(keysOf(b.state, 0, 1), s ?? '', 0));
    expect(lossFacts(b.state, [s ?? ''])).toEqual({
      form: true,
      xfa: false,
      outline: true,
      signed: false,
    });
    expect(totalSourceSize(b.state.sources.values())).toBe(3000);
  });
});
