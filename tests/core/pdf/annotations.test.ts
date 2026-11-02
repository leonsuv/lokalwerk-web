import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  classifyAnnotation,
  defaultSelection,
  listAnnotations,
  planRemoval,
  removeAnnotations,
  shortText,
  summarizeTypes,
  type AnnotEntry,
  type AnnotationItem,
} from '../../../src/core/pdf/annotations.ts';
import { PdfError } from '../../../src/core/pdf/merge.ts';

interface Spec {
  subtype: string;
  text?: string;
  /** Popup-Fenster, das zur Anmerkung gehört */
  popup?: boolean;
}

/** PDF mit je einer Seite pro Liste; jede Anmerkung steht im /Annots ihrer Seite */
async function pdfWith(pages: Spec[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  for (const specs of pages) {
    const page = doc.addPage([200, 200]);
    for (const spec of specs) {
      const dict = PDFDict.withContext(doc.context);
      dict.set(PDFName.of('Type'), PDFName.of('Annot'));
      dict.set(PDFName.of('Subtype'), PDFName.of(spec.subtype));
      dict.set(PDFName.of('Rect'), doc.context.obj([0, 0, 10, 10]));
      if (spec.text !== undefined) dict.set(PDFName.of('Contents'), PDFString.of(spec.text));
      if (spec.popup) {
        const popup = PDFDict.withContext(doc.context);
        popup.set(PDFName.of('Type'), PDFName.of('Annot'));
        popup.set(PDFName.of('Subtype'), PDFName.of('Popup'));
        popup.set(PDFName.of('Rect'), doc.context.obj([0, 0, 10, 10]));
        const popupRef = doc.context.register(popup);
        dict.set(PDFName.of('Popup'), popupRef);
        page.node.addAnnot(doc.context.register(dict));
        page.node.addAnnot(popupRef);
        continue;
      }
      page.node.addAnnot(doc.context.register(dict));
    }
  }
  return doc.save();
}

/** Untertypen je Seite, in der Reihenfolge von /Annots, aus der fertigen Datei gelesen */
async function subtypesByPage(bytes: Uint8Array): Promise<string[][]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map((page) => {
    const annots = page.node.Annots();
    const names: string[] = [];
    for (let i = 0; i < (annots?.size() ?? 0); i++) {
      const annot = doc.context.lookup(annots!.get(i));
      if (annot instanceof PDFDict) {
        const sub = annot.lookup(PDFName.of('Subtype'));
        names.push(sub instanceof PDFName ? sub.decodeText() : '');
      }
    }
    return names;
  });
}

describe('classifyAnnotation', () => {
  it('ordnet Notizen und Markierungen den Kommentaren zu', () => {
    expect(classifyAnnotation('Highlight')).toEqual({ label: 'Markierung', group: 'comment' });
    expect(classifyAnnotation('Text')).toEqual({ label: 'Notiz', group: 'comment' });
    expect(classifyAnnotation('Ink')).toEqual({ label: 'Freihandzeichnung', group: 'comment' });
  });

  it('trennt Links, Formularfelder und Popup-Fenster', () => {
    expect(classifyAnnotation('Link').group).toBe('link');
    expect(classifyAnnotation('Widget').group).toBe('form');
    expect(classifyAnnotation('Popup').group).toBe('popup');
  });

  it('behandelt unbekannte und fehlende Untertypen', () => {
    expect(classifyAnnotation('Movie')).toEqual({ label: 'Sonstige (Movie)', group: 'other' });
    expect(classifyAnnotation('')).toEqual({ label: 'Unbekannte Art', group: 'other' });
  });
});

describe('shortText', () => {
  it('fasst Zeilenumbrüche und Leerraum zu einer Zeile zusammen', () => {
    expect(shortText('  Bitte\n prüfen   \r\n  ')).toBe('Bitte prüfen');
  });

  it('gibt bei leerem Text null zurück', () => {
    expect(shortText(null)).toBeNull();
    expect(shortText(' \n ')).toBeNull();
  });

  it('kürzt auf die Länge mit Auslassungszeichen', () => {
    const cut = shortText('a'.repeat(200));
    expect(cut).toHaveLength(80);
    expect(cut?.endsWith('…')).toBe(true);
  });
});

describe('planRemoval', () => {
  const entry = (subtype: string, ref: string | null = null, popup: string | null = null) => ({
    subtype,
    ref,
    popup,
  });

  it('wählt genau die Positionen der gewählten Untertypen', () => {
    const entries = [entry('Highlight'), entry('Link'), entry('Highlight'), entry('Text')];
    expect([...planRemoval(entries, new Set(['Highlight']))]).toEqual([0, 2]);
  });

  it('entfernt Formularfelder auch dann nicht, wenn sie gewählt sind', () => {
    const entries = [entry('Widget'), entry('Text')];
    expect([...planRemoval(entries, new Set(['Widget', 'Text']))]).toEqual([1]);
  });

  it('entfernt ein Popup-Fenster mit seiner Anmerkung', () => {
    const entries = [entry('Text', '5 0', '6 0'), entry('Popup', '6 0')];
    expect([...planRemoval(entries, new Set(['Text']))].sort()).toEqual([0, 1]);
  });

  it('lässt ein Popup-Fenster stehen, wenn seine Anmerkung bleibt', () => {
    const entries: AnnotEntry[] = [entry('Text', '5 0', '6 0'), entry('Popup', '6 0')];
    expect([...planRemoval(entries, new Set(['Popup']))]).toEqual([]);
    expect([...planRemoval(entries, new Set(['Highlight']))]).toEqual([]);
  });

  it('bleibt ohne Auswahl ohne Ergebnis', () => {
    expect(planRemoval([entry('Text')], new Set()).size).toBe(0);
  });
});

describe('summarizeTypes und defaultSelection', () => {
  const item = (
    subtype: string,
    label: string,
    group: AnnotationItem['group'],
  ): AnnotationItem => ({
    page: 1,
    subtype,
    label,
    group,
    text: null,
  });

  it('zählt je Untertyp und sortiert Kommentare vor Links und sonstigen', () => {
    const types = summarizeTypes([
      item('Link', 'Link', 'link'),
      item('Highlight', 'Markierung', 'comment'),
      item('Movie', 'Sonstige (Movie)', 'other'),
      item('Highlight', 'Markierung', 'comment'),
      item('Text', 'Notiz', 'comment'),
    ]);
    expect(types.map((t) => [t.subtype, t.count])).toEqual([
      ['Highlight', 2],
      ['Text', 1],
      ['Link', 1],
      ['Movie', 1],
    ]);
  });

  it('wählt nur Kommentare vor', () => {
    const types = summarizeTypes([
      item('Link', 'Link', 'link'),
      item('Ink', 'Freihandzeichnung', 'comment'),
    ]);
    expect([...defaultSelection(types)]).toEqual(['Ink']);
  });
});

describe('listAnnotations', () => {
  it('listet jede Anmerkung mit Seite, Art und Text', async () => {
    const bytes = await pdfWith([
      [{ subtype: 'Highlight', text: 'Wichtig' }],
      [{ subtype: 'Text', text: 'Frage an\n Max' }, { subtype: 'Ink' }],
    ]);
    const listing = await listAnnotations(bytes);
    expect(listing.pages).toBe(2);
    expect(listing.items).toEqual([
      { page: 1, subtype: 'Highlight', label: 'Markierung', group: 'comment', text: 'Wichtig' },
      { page: 2, subtype: 'Text', label: 'Notiz', group: 'comment', text: 'Frage an Max' },
      { page: 2, subtype: 'Ink', label: 'Freihandzeichnung', group: 'comment', text: null },
    ]);
    expect(listing.formFields).toBe(0);
  });

  it('zählt Formularfelder, führt sie aber nicht in der Liste', async () => {
    const bytes = await pdfWith([
      [{ subtype: 'Widget' }, { subtype: 'Popup' }, { subtype: 'Link' }],
    ]);
    const listing = await listAnnotations(bytes);
    expect(listing.formFields).toBe(1);
    expect(listing.items.map((i) => i.subtype)).toEqual(['Link']);
  });

  it('meldet Seiten ohne Anmerkungen als leere Liste', async () => {
    const listing = await listAnnotations(await pdfWith([[], []]));
    expect(listing).toEqual({ pages: 2, items: [], formFields: 0 });
  });

  it('weist Verschlüsselung und Beschädigung mit PdfError ab', async () => {
    await expect(listAnnotations(new Uint8Array())).rejects.toBeInstanceOf(PdfError);
    await expect(listAnnotations(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(PdfError);
  });
});

describe('removeAnnotations', () => {
  it('entfernt die gewählten Arten aus allen Seiten und lässt den Rest', async () => {
    const bytes = await pdfWith([
      [{ subtype: 'Highlight' }, { subtype: 'Link' }],
      [{ subtype: 'Text', text: 'weg' }, { subtype: 'Widget' }],
    ]);
    const { bytes: out, removed } = await removeAnnotations(bytes, new Set(['Highlight', 'Text']));
    expect(removed).toBe(2);
    expect(await subtypesByPage(out)).toEqual([['Link'], ['Widget']]);
  });

  it('entfernt Popup-Fenster mit ihrer Notiz und löscht die Objekte', async () => {
    const bytes = await pdfWith([[{ subtype: 'Text', popup: true, text: 'geheim' }]]);
    const { bytes: out } = await removeAnnotations(bytes, new Set(['Text']));
    expect(await subtypesByPage(out)).toEqual([[]]);

    const doc = await PDFDocument.load(out, { updateMetadata: false });
    const dicts = [...doc.context.enumerateIndirectObjects()]
      .map(([, obj]) => obj)
      .filter((obj): obj is PDFDict => obj instanceof PDFDict);
    const left = dicts.filter((d) => d.lookup(PDFName.of('Subtype')) === PDFName.of('Popup'));
    expect(left).toHaveLength(0);
    const notes = dicts.filter((d) => d.lookup(PDFName.of('Subtype')) === PDFName.of('Text'));
    expect(notes).toHaveLength(0);
  });

  it('ändert nichts, wenn keine Art gewählt ist', async () => {
    const bytes = await pdfWith([[{ subtype: 'Highlight' }, { subtype: 'Widget' }]]);
    const { removed, bytes: out } = await removeAnnotations(bytes, new Set());
    expect(removed).toBe(0);
    expect(await subtypesByPage(out)).toEqual([['Highlight', 'Widget']]);
  });

  it('entfernt auch Einträge ohne Untertyp, wenn „Unbekannte Art“ gewählt ist', async () => {
    const bytes = await pdfWith([[{ subtype: 'Highlight' }]]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const page = doc.getPages()[0]!;
    const annots = page.node.Annots() as PDFArray;
    annots.push(PDFDict.withContext(doc.context));
    const withBroken = await doc.save();

    const { removed, bytes: out } = await removeAnnotations(withBroken, new Set(['']));
    expect(removed).toBe(1);
    expect(await subtypesByPage(out)).toEqual([['Highlight']]);
  });
});
