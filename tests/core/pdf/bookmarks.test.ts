import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
} from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  addEntry,
  BookmarkError,
  type BookmarkEntry,
  deleteEntry,
  indentEntry,
  renameEntry,
} from '../../../src/core/pdf/bookmark-model.ts';
import { readBookmarks, writeBookmarks } from '../../../src/core/pdf/bookmarks.ts';
import { PdfError } from '../../../src/core/pdf/merge.ts';

/**
 * Gliederung für die Tests. `page` ist die Seite (0-basiert), `named` ein benannter Eintrag,
 * `uri` eine Web-Aktion ohne Seitenziel.
 */
interface Spec {
  title: string;
  page?: number;
  named?: string;
  uri?: string;
  children?: Spec[];
}

/** Eine PDF mit `pages` Seiten und der Gliederung `tree`. Benannte Ziele stehen in /Dests. */
async function outlinePdf(tree: Spec[], pages = 4, named: Record<string, number> = {}) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const ctx = doc.context;
  const pageRefs = Array.from({ length: pages }, () => doc.addPage([200, 200]).ref);
  const pageRef = (n: number): PDFRef => {
    const ref = pageRefs[n];
    if (!ref) throw new Error(`Seite ${n} fehlt im Test`);
    return ref;
  };
  if (Object.keys(named).length > 0) {
    const dests = PDFDict.withContext(ctx);
    for (const [name, page] of Object.entries(named)) {
      dests.set(PDFName.of(name), ctx.obj([pageRef(page), PDFName.of('Fit')]));
    }
    doc.catalog.set(PDFName.of('Dests'), ctx.register(dests));
  }

  const root = PDFDict.withContext(ctx);
  const rootRef = ctx.register(root);
  const addLevel = (specs: Spec[], parent: PDFRef): PDFRef[] => {
    const refs: PDFRef[] = [];
    const dicts = specs.map((spec) => {
      const dict = PDFDict.withContext(ctx);
      dict.set(PDFName.of('Title'), PDFString.of(spec.title));
      dict.set(PDFName.of('Parent'), parent);
      if (spec.named !== undefined) dict.set(PDFName.of('Dest'), PDFString.of(spec.named));
      else if (spec.uri !== undefined) {
        dict.set(PDFName.of('A'), ctx.obj({ S: PDFName.of('URI'), URI: PDFString.of(spec.uri) }));
      } else {
        dict.set(PDFName.of('Dest'), ctx.obj([pageRef(spec.page ?? 0), PDFName.of('Fit')]));
      }
      refs.push(ctx.register(dict));
      return dict;
    });
    specs.forEach((spec, i) => {
      const dict = dicts[i];
      const ref = refs[i];
      const prev = refs[i - 1];
      const next = refs[i + 1];
      if (!dict || !ref) return;
      if (prev) dict.set(PDFName.of('Prev'), prev);
      if (next) dict.set(PDFName.of('Next'), next);
      const kids = spec.children?.length ? addLevel(spec.children, ref) : [];
      const first = kids[0];
      const last = kids.at(-1);
      if (first && last) {
        dict.set(PDFName.of('First'), first);
        dict.set(PDFName.of('Last'), last);
        dict.set(PDFName.of('Count'), PDFNumber.of(-kids.length));
      }
    });
    return refs;
  };
  const top = addLevel(tree, rootRef);
  const topFirst = top[0];
  const topLast = top.at(-1);
  if (topFirst && topLast) {
    root.set(PDFName.of('Type'), PDFName.of('Outlines'));
    root.set(PDFName.of('First'), topFirst);
    root.set(PDFName.of('Last'), topLast);
    root.set(PDFName.of('Count'), PDFNumber.of(top.length));
    doc.catalog.set(PDFName.of('Outlines'), rootRef);
  }
  return doc.save();
}

const SAMPLE: Spec[] = [
  { title: 'Einleitung', page: 0 },
  {
    title: 'Kapitel 1',
    page: 1,
    children: [
      { title: 'Abschnitt 1.1', page: 1 },
      { title: 'Abschnitt 1.2', page: 2 },
    ],
  },
  { title: 'Anhang', page: 3 },
];

/** Titel, Ebene und Seite als Zeilen, zum Vergleichen. */
const rows = (entries: BookmarkEntry[]) =>
  entries.map((e) => `${e.level}|${e.title}|${e.page === null ? '-' : e.page}`);

/** Alle Zeichenketten-Objekte der Datei, zum Prüfen, ob ein Titel noch irgendwo steht. */
async function stringsIn(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const found: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    for (const value of object.values()) {
      if (value instanceof PDFString || value instanceof PDFHexString) {
        found.push(value.decodeText());
      }
    }
  }
  return found;
}

describe('Lesezeichen lesen', () => {
  it('liest die Gliederung in Lesereihenfolge mit Ebenen und Seiten', async () => {
    const result = await readBookmarks(await outlinePdf(SAMPLE));
    expect(result.pages).toBe(4);
    expect(rows(result.entries)).toEqual([
      '0|Einleitung|0',
      '0|Kapitel 1|1',
      '1|Abschnitt 1.1|1',
      '1|Abschnitt 1.2|2',
      '0|Anhang|3',
    ]);
    expect(result.entries.map((e) => e.origin)).toEqual([0, 1, 2, 3, 4]);
  });

  it('löst benannte Ziele über /Dests auf', async () => {
    const bytes = await outlinePdf(
      [
        { title: 'Über Name', named: 'kapitel-2' },
        { title: 'Fehlt', named: 'gibt-es-nicht' },
      ],
      4,
      { 'kapitel-2': 2 },
    );
    const result = await readBookmarks(bytes);
    expect(rows(result.entries)).toEqual(['0|Über Name|2', '0|Fehlt|-']);
  });

  it('markiert Ziele ohne Seite und Web-Adressen, ohne sie zu verwerfen', async () => {
    const bytes = await outlinePdf([
      { title: 'Web', uri: 'https://example.org/' },
      { title: 'Unbekannt', named: 'nichts' },
      { title: 'Seite', page: 1 },
    ]);
    const result = await readBookmarks(bytes);
    expect(result.entries.map((e) => e.page)).toEqual([null, null, 1]);
    expect(result.entries.map((e) => e.title)).toEqual(['Web', 'Unbekannt', 'Seite']);
  });

  it('meldet eine PDF ohne Lesezeichen als leere Liste', async () => {
    const result = await readBookmarks(await outlinePdf([]));
    expect(result.entries).toEqual([]);
  });

  it('weist beschädigte Dateien mit einem PDF-Fehler ab', async () => {
    await expect(readBookmarks(new TextEncoder().encode('kein pdf'))).rejects.toBeInstanceOf(
      PdfError,
    );
    await expect(readBookmarks(new Uint8Array())).rejects.toBeInstanceOf(PdfError);
  });
});

describe('Lesezeichen schreiben', () => {
  it('speichert Umbenennen, Löschen, Hinzufügen und Ebenen', async () => {
    const bytes = await outlinePdf(SAMPLE);
    const { entries } = await readBookmarks(bytes);
    let edited = renameEntry(entries, 0, 'Vorwort');
    edited = indentEntry(edited, 4);
    edited = deleteEntry(edited, 1);
    edited = addEntry(edited, edited.length - 1, { title: 'Neu', page: 2 }, 4);

    const out = await writeBookmarks(bytes, edited);
    const back = await readBookmarks(out);
    expect(rows(back.entries)).toEqual([
      '0|Vorwort|0',
      '0|Abschnitt 1.1|1',
      '0|Abschnitt 1.2|2',
      '0|Anhang|3',
      '0|Neu|2',
    ]);
    expect(back.pages).toBe(4);
  });

  it('behält unbekannte Ziele beim Speichern bei', async () => {
    const bytes = await outlinePdf([
      { title: 'Web', uri: 'https://example.org/' },
      { title: 'Unbekannt', named: 'nichts' },
      { title: 'Seite', page: 1 },
    ]);
    const { entries } = await readBookmarks(bytes);
    const out = await writeBookmarks(bytes, renameEntry(entries, 2, 'Seite neu'));
    const back = await readBookmarks(out);
    expect(rows(back.entries)).toEqual(['0|Web|-', '0|Unbekannt|-', '0|Seite neu|1']);
  });

  it('entfernt gelöschte Einträge aus der Datei, nicht nur aus der Gliederung', async () => {
    const bytes = await outlinePdf([
      { title: 'Behalten', page: 0 },
      { title: 'Geheimer Titel XYZ', page: 1 },
    ]);
    const { entries } = await readBookmarks(bytes);
    expect(await stringsIn(bytes)).toContain('Geheimer Titel XYZ');
    const out = await writeBookmarks(bytes, deleteEntry(entries, 1));
    expect(await stringsIn(out)).not.toContain('Geheimer Titel XYZ');
    expect(rows((await readBookmarks(out)).entries)).toEqual(['0|Behalten|0']);
  });

  it('entfernt die Gliederung, wenn keine Einträge mehr übrig sind', async () => {
    const bytes = await outlinePdf(SAMPLE);
    const out = await writeBookmarks(bytes, []);
    expect((await readBookmarks(out)).entries).toEqual([]);
    expect((await PDFDocument.load(out)).catalog.has(PDFName.of('Outlines'))).toBe(false);
  });

  it('legt eine Gliederung an, wenn die PDF keine hatte', async () => {
    const bytes = await outlinePdf([]);
    const entries = addEntry([], null, { title: 'Erstes', page: 2 }, 4);
    const out = await writeBookmarks(bytes, entries);
    expect(rows((await readBookmarks(out)).entries)).toEqual(['0|Erstes|2']);
  });

  it('weist eine ungültige Liste ab, bevor etwas geschrieben wird', async () => {
    const bytes = await outlinePdf(SAMPLE);
    const broken: BookmarkEntry[] = [{ title: 'X', level: 2, page: 0, origin: null }];
    await expect(writeBookmarks(bytes, broken)).rejects.toBeInstanceOf(BookmarkError);
  });

  it('hält die Seiten und den Rest der Datei unverändert', async () => {
    const bytes = await outlinePdf(SAMPLE);
    const { entries } = await readBookmarks(bytes);
    const out = await writeBookmarks(bytes, renameEntry(entries, 0, 'Neu'));
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(4);
    const outlines = doc.catalog.lookup(PDFName.of('Outlines'));
    expect(outlines).toBeInstanceOf(PDFDict);
    const first = (outlines as PDFDict).lookup(PDFName.of('First'));
    expect(first).toBeInstanceOf(PDFDict);
    expect((first as PDFDict).lookup(PDFName.of('Dest'))).toBeInstanceOf(PDFArray);
  });
});
