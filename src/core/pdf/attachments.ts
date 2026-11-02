/**
 * Eingebettete Dateien („Anhänge“) einer PDF auflisten, entfernen und neue hinzufügen
 * (Werkzeug „Anhänge verwalten“). Ohne DOM, läuft im Worker.
 *
 * pdf-lib kann Anhänge nur hinzufügen (`attach`), nicht lesen oder entfernen. Deshalb liest
 * und schreibt dieses Modul den Namensbaum /EmbeddedFiles selbst (ISO 32000-2, 7.11.4 und 7.9.6).
 *
 * Anhänge werden nie geöffnet oder verändert: Ihre gespeicherten Bytes bleiben unverändert,
 * nur Einträge, die der Nutzer entfernt, verschwinden. Entfernt werden auch die Verweise aus
 * /AF im Katalog und Dateianhang-Anmerkungen auf den Seiten, sonst bliebe die Datei sichtbar
 * oder die PDF enthielte einen ins Leere zeigenden Verweis.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  PDFString,
  type PDFObject,
} from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';

const MAX_TREE_DEPTH = 32;

export type AttachmentErrorCode = 'duplicate-name';

export class AttachmentError extends Error {
  readonly code: AttachmentErrorCode;

  constructor(code: AttachmentErrorCode, name: string) {
    super(`Anhang-Fehler: ${code} (${name})`);
    this.name = 'AttachmentError';
    this.code = code;
  }
}

export interface AttachmentInfo {
  /** Position im Namensbaum; mit dieser Nummer werden Anhänge zum Entfernen gewählt */
  index: number;
  name: string;
  /** Größe in Byte aus /Params /Size, null, wenn die PDF keine angibt oder der Eintrag kaputt ist */
  size: number | null;
  /** false: Der Eintrag ist keine vollständige Dateibeschreibung mit Inhalt. Er bleibt unverändert */
  readable: boolean;
}

export interface NewAttachment {
  name: string;
  bytes: Uint8Array;
  mimeType?: string;
}

export interface AttachmentChanges {
  /** Positionen (AttachmentInfo.index) der Anhänge, die entfernt werden */
  remove: ReadonlySet<number>;
  /** Neue Dateien, die am Ende angehängt werden */
  add: readonly NewAttachment[];
}

/** Ein Eintrag des Namensbaums mit allen Verweisen, die zu ihm gehören */
interface Entry {
  info: AttachmentInfo;
  /** Wert im Namensbaum, meist ein Verweis auf die Dateibeschreibung */
  value: PDFObject;
  /** Verweis auf die Dateibeschreibung, wenn sie als eigenes Objekt steht */
  specRef: PDFRef | undefined;
  /** Verweise auf die Dateiströme unter /EF */
  streamRefs: PDFRef[];
}

interface Tree {
  entries: Entry[];
  /** Verweise auf die Knoten des Namensbaums (Wurzel und Zwischenknoten) */
  nodeRefs: PDFRef[];
}

/** Schlüssel für Verweise, weil pdf-lib dieselbe Nummer in mehreren Instanzen liefern kann */
const refKey = (ref: PDFRef): string => `${ref.objectNumber} ${ref.generationNumber}`;

function resolve(doc: PDFDocument, object: PDFObject | undefined): PDFObject | undefined {
  return object instanceof PDFRef ? doc.context.lookup(object) : object;
}

function textOf(object: PDFObject | undefined): string | null {
  if (object instanceof PDFString || object instanceof PDFHexString) return object.decodeText();
  return null;
}

/** Liest den Namensbaum der Anhänge: Blätter mit Namen und Werten, dazu die Knoten selbst. */
function readTree(doc: PDFDocument): Tree {
  const tree: Tree = { entries: [], nodeRefs: [] };
  const names = doc.catalog.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFDict)) return tree;
  const root = names.get(PDFName.of('EmbeddedFiles'));
  if (root === undefined) return tree;

  const pairs: { key: string; value: PDFObject }[] = [];
  const walk = (node: PDFObject, depth: number): void => {
    if (depth > MAX_TREE_DEPTH) return;
    if (node instanceof PDFRef) tree.nodeRefs.push(node);
    const dict = resolve(doc, node);
    if (!(dict instanceof PDFDict)) return;
    const leaves = dict.lookup(PDFName.of('Names'));
    if (leaves instanceof PDFArray) {
      for (let i = 0; i + 1 < leaves.size(); i += 2) {
        const key = textOf(resolve(doc, leaves.get(i))) ?? '';
        pairs.push({ key, value: leaves.get(i + 1) });
      }
    }
    const kids = dict.lookup(PDFName.of('Kids'));
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) walk(kids.get(i), depth + 1);
    }
  };
  walk(root, 0);

  pairs.forEach((pair, index) => {
    tree.entries.push(describe(doc, pair.key, pair.value, index));
  });
  return tree;
}

function describe(doc: PDFDocument, key: string, value: PDFObject, index: number): Entry {
  const spec = resolve(doc, value);
  const specRef = value instanceof PDFRef ? value : undefined;
  const streamRefs: PDFRef[] = [];
  let name = key;
  let size: number | null = null;
  let readable = false;

  if (spec instanceof PDFDict) {
    name =
      textOf(resolve(doc, spec.get(PDFName.of('UF')))) ??
      textOf(resolve(doc, spec.get(PDFName.of('F')))) ??
      key;
    const ef = resolve(doc, spec.get(PDFName.of('EF')));
    if (ef instanceof PDFDict) {
      for (const [, object] of ef.entries()) {
        if (object instanceof PDFRef) streamRefs.push(object);
      }
      const stream = resolve(doc, ef.get(PDFName.of('F')));
      if (stream instanceof PDFStream) {
        readable = true;
        const params = resolve(doc, stream.dict.get(PDFName.of('Params')));
        const declared =
          params instanceof PDFDict ? resolve(doc, params.get(PDFName.of('Size'))) : undefined;
        if (declared instanceof PDFNumber) size = declared.asNumber();
      }
    }
  }

  return { info: { index, name, size, readable }, value, specRef, streamRefs };
}

/** Anhänge einer PDF in der Reihenfolge des Namensbaums. Wirft PdfError für unlesbare PDFs. */
export async function listAttachments(bytes: Uint8Array): Promise<AttachmentInfo[]> {
  const doc = await loadPdf(bytes);
  try {
    return readTree(doc).entries.map((entry) => entry.info);
  } catch (error) {
    throw toPdfError(error);
  }
}

/** Entfernt Verweise auf Objekte, die nur die entfernten Anhänge brauchen, und löscht sie. */
function dropObjects(doc: PDFDocument, drop: Entry[], kept: Set<string>): void {
  const seen = new Set<string>();
  const remove = (ref: PDFRef) => {
    const key = refKey(ref);
    if (kept.has(key) || seen.has(key)) return;
    seen.add(key);
    doc.context.delete(ref);
  };
  for (const entry of drop) {
    if (entry.specRef) remove(entry.specRef);
    for (const ref of entry.streamRefs) remove(ref);
  }
}

/**
 * Entfernt die Verweise auf die gelöschten Dateibeschreibungen aus /AF im Katalog und aus den
 * Dateianhang-Anmerkungen der Seiten.
 */
function unlinkSpecs(doc: PDFDocument, specKeys: Set<string>): void {
  const isGone = (object: PDFObject | undefined) =>
    object instanceof PDFRef && specKeys.has(refKey(object));

  const af = doc.catalog.lookup(PDFName.of('AF'));
  if (af instanceof PDFArray) {
    for (let i = af.size() - 1; i >= 0; i--) {
      if (isGone(af.get(i))) af.remove(i);
    }
  }

  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const ref = annots.get(i);
      const annot = resolve(doc, ref);
      if (!(annot instanceof PDFDict)) continue;
      if (annot.lookup(PDFName.of('Subtype')) !== PDFName.of('FileAttachment')) continue;
      if (!isGone(annot.get(PDFName.of('FS')))) continue;
      annots.remove(i);
      if (ref instanceof PDFRef) doc.context.delete(ref);
    }
  }
}

/**
 * Wendet Entfernen und Hinzufügen auf eine PDF an und liefert die neue Datei. Doppelte Namen
 * werden abgelehnt, auch gegen die verbleibenden Anhänge. Wirft PdfError oder AttachmentError.
 */
export async function editAttachments(
  bytes: Uint8Array,
  changes: AttachmentChanges,
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  try {
    const tree = readTree(doc);
    const keep = tree.entries.filter((e) => !changes.remove.has(e.info.index));
    const drop = tree.entries.filter((e) => changes.remove.has(e.info.index));

    const names = new Set(keep.map((e) => e.info.name));
    for (const file of changes.add) {
      if (names.has(file.name)) throw new AttachmentError('duplicate-name', file.name);
      names.add(file.name);
    }

    if (drop.length > 0 || tree.nodeRefs.length > 0) {
      const keptRefs = new Set<string>();
      for (const entry of keep) {
        if (entry.specRef) keptRefs.add(refKey(entry.specRef));
        for (const ref of entry.streamRefs) keptRefs.add(refKey(ref));
      }
      const goneSpecs = new Set(
        drop.flatMap((e) =>
          e.specRef && !keptRefs.has(refKey(e.specRef)) ? [refKey(e.specRef)] : [],
        ),
      );

      // Neuer, flacher Namensbaum mit den verbleibenden Anhängen; die alten Knoten fallen weg.
      const leaves = doc.context.obj([]);
      for (const entry of keep) {
        leaves.push(PDFHexString.fromText(entry.info.name));
        leaves.push(entry.value);
      }
      const embeddedFiles = doc.context.obj({});
      embeddedFiles.set(PDFName.of('Names'), leaves);
      const namesDict = doc.catalog.lookup(PDFName.of('Names'));
      if (namesDict instanceof PDFDict) {
        namesDict.set(PDFName.of('EmbeddedFiles'), embeddedFiles);
      }
      for (const ref of tree.nodeRefs) doc.context.delete(ref);

      dropObjects(doc, drop, keptRefs);
      unlinkSpecs(doc, goneSpecs);
    }

    for (const file of changes.add) {
      await doc.attach(file.bytes, file.name, file.mimeType ? { mimeType: file.mimeType } : {});
    }
    return await doc.save();
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw toPdfError(error);
  }
}
