/**
 * Einbacken (plan-phase3.md 7.2, Schritt 2.3): Schwärzen und Formular ausfüllen ersetzen Seiten
 * durch Seiten einer neu erzeugten Quelle. Leon, 27.09.2026: Nach dem Schwärzen darf das
 * exportierte Dokument nichts aus dem Original enthalten, auch nicht nach Rückgängig und
 * Wiederholen, Duplizieren, Teilen, Zusammenführen oder „Auswahl als neue PDF“.
 */

import { readFileSync } from 'node:fs';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { assemblePdfs, type AssembleSource } from '../../../src/core/pdf/assemble.ts';
import { fillForm } from '../../../src/core/pdf/form.ts';
import { buildRasterPdf } from '../../../src/core/pdf/redact.ts';
import {
  bakePages,
  copyPages,
  duplicateDoc,
  mergeDocs,
  rotatePages,
  setSignatures,
  setStamp,
  splitDoc,
  addSources,
  extractToNewDoc,
  renameDoc,
  type BakedPage,
  type Command,
} from '../../../src/core/workshop/commands.ts';
import { exportPlan, selectionPlan } from '../../../src/core/workshop/export-plan.ts';
import {
  createHistory,
  execute,
  redo,
  undo,
  type History,
} from '../../../src/core/workshop/history.ts';
import {
  counterIds,
  formSourceOf,
  NO_FACTS,
  unchangedSource,
  unredactedPages,
  type Source,
  type WorkshopState,
} from '../../../src/core/workshop/model.ts';
import { allBytes, containsSecret, extractText, original, SECRETS } from '../pdf/secrets.ts';
import { pdfSource } from './helpers.ts';

const jpeg = new Uint8Array(
  readFileSync(new URL('../../fixtures/images/ohne-metadaten.jpg', import.meta.url)),
);
const image = { id: 'g1', png: new Uint8Array([1]), width: 10, height: 5 };

/** Geschwärzte Quelle wie aus der Werkstatt: je Seite des Dokuments ein Bild, Drehung 0 */
function rasterSource(
  id: string,
  from: string[],
  pages: { width: number; height: number }[],
): Source {
  return {
    id,
    kind: 'pdf',
    name: 'Vertrag.pdf',
    size: 1000,
    pages: pages.map((box) => ({ box, rotate: 0 })),
    facts: NO_FACTS,
    origin: { kind: 'redacted', from },
  };
}

/** Alle Seiten des Dokuments `doc` auf die gerasterte Quelle, in der Reihenfolge des Dokuments */
function redactAll(state: WorkshopState, doc: number, source: Source): Command {
  const d = state.docs[doc];
  if (!d) throw new Error('Dokument fehlt');
  const pages: BakedPage[] = d.pages.map((page, index) => ({
    key: page.key,
    before: page,
    index,
    rotate: 0,
  }));
  return bakePages(d.id, source, pages, 'Schwärzen', true);
}

describe('bakePages (Befehl)', () => {
  it('ersetzt die Seiten, behält Schlüssel, Stempel und die Lage der Unterschrift', () => {
    const ids = counterIds();
    let state = addSources([pdfSource('a', 2)]).apply(createHistory().present.state, ids).state;
    const [p1, p2] = state.docs[0]?.pages ?? [];
    if (!p1 || !p2) throw new Error('Seiten fehlen');
    for (const c of [
      rotatePages([p2.key], 90),
      setStamp([p1.key], { text: 'KOPIE', placement: 'top', color: 'red', opacity: 1 }),
      setSignatures(p2.key, image, [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1 }]),
    ]) {
      state = c.apply(state, ids).state;
    }
    const raster = rasterSource(
      'r',
      ['a'],
      [
        { width: 612, height: 792 },
        { width: 792, height: 612 },
      ],
    );
    const next = redactAll(state, 0, raster).apply(state, ids).state;
    const pages = next.docs[0]?.pages ?? [];
    expect(
      pages.map((p) => (p.kind === 'source' ? [p.key, p.source, p.index, p.rotate] : [])),
    ).toEqual([
      [p1.key, 'r', 0, 0],
      [p2.key, 'r', 1, 0],
    ]);
    expect(pages[0]?.ops).toEqual(state.docs[0]?.pages[0]?.ops);
    // Gesetzt bei Drehung 90, die Seite steht jetzt mit Drehung 0 genauso da: turn 90 → 0
    expect(pages[1]?.ops).toEqual([
      { type: 'signature', image, rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, turn: 0 },
    ]);
    expect([...next.sources.keys()]).toEqual(['r']);
  });

  it('tut nichts, wenn sich das Dokument seit dem Start geändert hat', () => {
    const ids = counterIds();
    const start = addSources([pdfSource('a', 2)]).apply(createHistory().present.state, ids).state;
    const raster = rasterSource('r', ['a'], [LETTER_BOX, LETTER_BOX]);
    const command = redactAll(start, 0, raster);
    const key = start.docs[0]?.pages[0]?.key ?? '';
    // Gedreht: andere Grundlage
    const turned = rotatePages([key], 90).apply(start, ids).state;
    expect(command.apply(turned, ids).state).toBe(turned);
    // Eine Seite dazugekommen: Schwärzen gilt für das ganze Dokument
    const grown = copyPages([key], start.docs[0]?.id ?? '', 0).apply(start, ids).state;
    expect(command.apply(grown, ids).state).toBe(grown);
    // Stempel dazugekommen: Grundlage gleich, also geht es
    const stamped = setStamp([key], {
      text: 'X',
      placement: 'top',
      color: 'red',
      opacity: 1,
    }).apply(start, ids).state;
    expect(command.apply(stamped, ids).state).not.toBe(stamped);
  });
});

const LETTER_BOX = { width: 612, height: 792 };

describe('unredactedPages (Hinweis: Seiten aus derselben Datei, nicht geschwärzt)', () => {
  it('findet Kopien in anderen Dokumenten, solange die geschwärzte Fassung da ist', () => {
    const ids = counterIds();
    let state = addSources([pdfSource('a', 3)]).apply(createHistory().present.state, ids).state;
    const doc = state.docs[0];
    if (!doc) throw new Error('Dokument fehlt');
    // „Anlagen“: Kopien von Seite 1 und 3, vor dem Schwärzen
    state = extractToNewDoc(
      [doc.pages[0]?.key ?? '', doc.pages[2]?.key ?? ''],
      'Anlagen',
      'copy',
    ).apply(state, ids).state;
    expect(unredactedPages(state)).toEqual([]);
    state = redactAll(
      state,
      0,
      rasterSource('r', ['a'], [LETTER_BOX, LETTER_BOX, LETTER_BOX]),
    ).apply(state, ids).state;
    const found = unredactedPages(state);
    expect(found.map((f) => [f.doc.name, f.keys.length])).toEqual([['Anlagen', 2]]);
    // Nur für bestimmte Dokumente oder Seiten (Export)
    expect(unredactedPages(state, [state.docs[0] ?? doc])).toEqual([]);
    const one = new Set([found[0]?.keys[0] ?? '']);
    expect(unredactedPages(state, state.docs, one)[0]?.keys).toEqual([...one]);
    // Geschwärztes Dokument geschlossen: kein Hinweis mehr
    const closed: WorkshopState = {
      docs: state.docs.slice(1),
      sources: new Map([['a', pdfSource('a', 3)]]),
    };
    expect(unredactedPages(closed)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Ende zu Ende: Export mit assemble.ts, geprüft wie im Einzelwerkzeug (tests/core/pdf/redact.test.ts)

async function expectClean(bytes: Uint8Array, label: string): Promise<void> {
  // Einziger Text: der Stempel „KOPIE“, den der Test selbst setzt (kein Inhalt des Originals)
  expect((await extractText(bytes)).replaceAll('KOPIE', '').trim(), label).toBe('');
  const chunks = await allBytes(bytes);
  for (const secret of SECRETS)
    expect(containsSecret(chunks, `${secret}`), `${label}: ${secret}`).toBe(false);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(doc.getTitle(), label).toBeUndefined();
  expect(doc.getAuthor(), label).toBeUndefined();
}

describe('Schwärzen in der Werkstatt: nichts vom Original im Export', () => {
  it('direkt, nach Rückgängig und Wiederholen, Duplizieren, Teilen, Zusammenführen und als Auswahl', async () => {
    const originalBytes = await original(3);
    const rasterBytes = await buildRasterPdf(
      [0, 1, 2].map(() => ({ jpeg, width: 595, height: 842 })),
    );
    const box = { width: 595, height: 842 };
    const ids = counterIds();
    const secretSource: Source = {
      ...pdfSource('a', 3, 'Vertrag.pdf', box),
      facts: { ...NO_FACTS, form: true },
    };
    const raster = rasterSource('r', ['a'], [box, box, box]);
    const data = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: originalBytes }],
      ['r', { kind: 'pdf', bytes: rasterBytes }],
    ]);

    let h: History = createHistory();
    const run = (c: Command) => {
      h = execute(h, c, ids).history;
      return h.present.state;
    };
    let state = run(addSources([secretSource]));
    const vertrag = state.docs[0]?.id ?? '';
    // Stempel vor dem Schwärzen: bleibt (kein Original-Inhalt)
    state = run(
      setStamp([state.docs[0]?.pages[1]?.key ?? ''], {
        text: 'KOPIE',
        placement: 'top',
        color: 'red',
        opacity: 1,
      }),
    );
    // Gegenprobe: vor dem Schwärzen steckt alles drin
    const [before] = await assemblePdfs(exportPlan(state, [vertrag]), data);
    const beforeChunks = await allBytes(before?.bytes ?? new Uint8Array());
    expect(containsSecret(beforeChunks, 'Max Mustermann')).toBe(true);

    state = run(redactAll(state, 0, raster));
    const exportDoc = async (s: WorkshopState, id: string, label: string) => {
      const [file] = await assemblePdfs(exportPlan(s, [id]), data);
      if (!file) throw new Error(label);
      await expectClean(file.bytes, label);
      return file;
    };
    // Direkt: Dokument ist unverändert die gerasterte Quelle? Nein, eine Seite hat einen Stempel.
    await exportDoc(state, vertrag, 'direkt');

    // Rückgängig: wieder das Original (so gewollt), Wiederholen: wieder sauber
    h = undo(h);
    const [undone] = await assemblePdfs(exportPlan(h.present.state, [vertrag]), data);
    expect(
      containsSecret(await allBytes(undone?.bytes ?? new Uint8Array()), 'Max Mustermann'),
    ).toBe(true);
    h = redo(h);
    state = h.present.state;
    await exportDoc(state, vertrag, 'Wiederholen');

    // Duplizieren
    state = run(duplicateDoc(vertrag, 'Vertrag Kopie'));
    const copy = state.docs[1]?.id ?? '';
    await exportDoc(state, copy, 'Dokument duplizieren');

    // Teilen
    state = run(splitDoc(vertrag, 1, 'Vertrag Teil 2'));
    const tail = state.docs[1]?.id ?? '';
    await exportDoc(state, vertrag, 'Teilen, erster Teil');
    await exportDoc(state, tail, 'Teilen, zweiter Teil');

    // Zusammenführen
    state = run(mergeDocs([vertrag, tail, copy]));
    await exportDoc(state, vertrag, 'Zusammenführen');

    // Auswahl als neue PDF
    const keys = state.docs[0]?.pages.slice(1, 3).map((p) => p.key) ?? [];
    const plan = selectionPlan(state, keys, 'Auswahl');
    if (!plan) throw new Error('Auswahl leer');
    const [selection] = await assemblePdfs([plan], data);
    await expectClean(selection?.bytes ?? new Uint8Array(), 'Auswahl als neue PDF');

    // Alle als ZIP (jedes Dokument einzeln)
    for (const file of await assemblePdfs(
      exportPlan(
        state,
        state.docs.map((d) => d.id),
      ),
      data,
    )) {
      await expectClean(file.bytes, `ZIP: ${file.name}`);
    }
  });

  it('unverändert geschwärztes Dokument: die gerasterte Datei selbst, ohne Original', async () => {
    const rasterBytes = await buildRasterPdf([{ jpeg, width: 595, height: 842 }]);
    const ids = counterIds();
    const box = { width: 595, height: 842 };
    let state = addSources([pdfSource('a', 1, 'Vertrag.pdf', box)]).apply(
      createHistory().present.state,
      ids,
    ).state;
    state = redactAll(state, 0, rasterSource('r', ['a'], [box])).apply(state, ids).state;
    expect(unchangedSource(state, state.docs[0] ?? { id: '', name: '', pages: [] })?.id).toBe('r');
    const data = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await original(1) }],
      ['r', { kind: 'pdf', bytes: rasterBytes }],
    ]);
    const [file] = await assemblePdfs(exportPlan(state, [state.docs[0]?.id ?? '']), data);
    expect(file?.unchanged).toBe(true);
    await expectClean(file?.bytes ?? new Uint8Array(), 'unverändert');
  });
});

describe('Formular ausfüllen in der Werkstatt', () => {
  it('ersetzt die Seiten der Formularquelle; unverändert kommt die ausgefüllte Datei mit Feldern', async () => {
    const form = await PDFDocument.create();
    const page = form.addPage([595, 842]);
    form.addPage([595, 842]);
    form
      .getForm()
      .createTextField('name')
      .addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
    const bytes = await form.save();
    const filled = await fillForm(bytes, { name: 'Erika Musterfrau' }, false);
    const ids = counterIds();
    const box = { width: 595, height: 842 };
    let state = addSources([pdfSource('a', 2, 'Antrag.pdf', box)]).apply(
      createHistory().present.state,
      ids,
    ).state;
    const doc = state.docs[0];
    if (!doc) throw new Error('Dokument fehlt');
    const filledSource: Source = {
      ...pdfSource('f', 2, 'Antrag.pdf', box),
      facts: { ...NO_FACTS, form: true },
      origin: { kind: 'filled', from: ['a'] },
    };
    const pages: BakedPage[] = doc.pages.flatMap((p) =>
      p.kind === 'source' && p.source === 'a'
        ? [{ key: p.key, before: p, index: p.index, rotate: p.rotate }]
        : [],
    );
    state = bakePages(doc.id, filledSource, pages, 'Formular ausfüllen', false).apply(
      state,
      ids,
    ).state;
    expect(unredactedPages(state)).toEqual([]);
    const data = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes }],
      ['f', { kind: 'pdf', bytes: filled }],
    ]);
    const [file] = await assemblePdfs(exportPlan(state, [doc.id]), data);
    expect(file?.unchanged).toBe(true);
    const out = await PDFDocument.load(file?.bytes ?? new Uint8Array());
    const field = out.getForm().getField('name');
    expect(field instanceof PDFTextField ? field.getText() : null).toBe('Erika Musterfrau');
  });
});

describe('formSourceOf (Formular ausfüllen …)', () => {
  it('nimmt die Formularquelle der Seite mit dem Fokus, sonst die erste im Dokument', () => {
    const ids = counterIds();
    const withForm = (id: string): Source => ({
      ...pdfSource(id, 1),
      facts: { ...NO_FACTS, form: true },
    });
    let state = addSources([pdfSource('a', 1), withForm('b'), withForm('c')]).apply(
      createHistory().present.state,
      ids,
    ).state;
    const [a, b, c] = state.docs;
    if (!a || !b || !c) throw new Error('Dokumente fehlen');
    state = mergeDocs([a.id, b.id, c.id]).apply(state, ids).state;
    const doc = state.docs[0];
    if (!doc) throw new Error('Dokument fehlt');
    expect(formSourceOf(state, doc)?.id).toBe('b');
    expect(formSourceOf(state, doc, doc.pages[2]?.key)?.id).toBe('c');
    expect(formSourceOf(state, doc, doc.pages[0]?.key)?.id).toBe('b');
    const plain = addSources([pdfSource('x', 2)]).apply(createHistory().present.state, ids).state;
    expect(formSourceOf(plain, plain.docs[0] ?? doc)).toBeNull();
  });
});

describe('Dateiname geschwärzter Dokumente (Leon, 27.09.2026)', () => {
  it('„<Name> (geschwärzt).pdf“, auch im ZIP, bis der Nutzer umbenennt', () => {
    const ids = counterIds();
    const box = LETTER_BOX;
    let h: History = createHistory();
    const run = (c: Command) => (h = execute(h, c, ids).history).present.state;
    let state = run(addSources([pdfSource('a', 2, 'Vertrag.pdf')]));
    const names = (s: WorkshopState) =>
      exportPlan(
        s,
        s.docs.map((d) => d.id),
      ).map((d) => d.name);
    // Vor dem Schwärzen umbenannt: zählt nicht
    state = run(renameDoc(state.docs[0]?.id ?? '', 'Mietvertrag'));
    expect(names(state)).toEqual(['Mietvertrag.pdf']);
    state = run(redactAll(state, 0, rasterSource('r', ['a'], [box, box])));
    expect(names(state)).toEqual(['Mietvertrag (geschwärzt).pdf']);
    // Duplizieren und Teilen: beide Teile geschwärzt, im ZIP unterschieden
    state = run(duplicateDoc(state.docs[0]?.id ?? '', 'Mietvertrag'));
    state = run(splitDoc(state.docs[1]?.id ?? '', 1, 'Anhang'));
    expect(names(state)).toEqual([
      'Mietvertrag (geschwärzt).pdf',
      'Mietvertrag (geschwärzt) (2).pdf',
      'Anhang (geschwärzt).pdf',
    ]);
    // Rückgängig bis vor das Schwärzen: wieder ohne Zusatz
    h = undo(undo(undo(h)));
    expect(names(h.present.state)).toEqual(['Mietvertrag.pdf']);
    h = redo(h);
    state = h.present.state;
    expect(names(state)).toEqual(['Mietvertrag (geschwärzt).pdf']);
    // Eine ungeschwärzte Seite dazu: kein Zusatz, solange sie drin ist
    const other = run(addSources([pdfSource('b', 1, 'Anlage.pdf')]));
    const withCopy = run(
      copyPages([other.docs[1]?.pages[0]?.key ?? ''], other.docs[0]?.id ?? '', 0),
    );
    expect(names(withCopy)[0]).toBe('Mietvertrag.pdf');
    h = undo(h);
    // Selbst umbenannt: kein Zusatz mehr
    state = run(renameDoc(h.present.state.docs[0]?.id ?? '', 'Für Anwalt'));
    expect(names(state)[0]).toBe('Für Anwalt.pdf');
  });
});
