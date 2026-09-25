/**
 * Versteckte Angaben einer PDF anzeigen und entfernen (Werkzeug „PDF-Metadaten entfernen“,
 * plan-phase2.md Werkzeug 8). Ohne DOM, läuft im Worker.
 *
 * Quelle: ISO 32000-2, Abschnitt 14.3 (Metadaten: Info-Wörterbuch im Trailer und
 * Metadatenströme), 7.9.4 (Datumsformat), 7.5.6 (inkrementelle Änderungen).
 *
 * Entfernen heißt: Die Seiten werden in ein neues Dokument übernommen (wie beim
 * Zusammenfügen). Dadurch fehlen im Ergebnis Info-Wörterbuch, XMP des Dokuments, Anhänge,
 * Lesezeichen, Formular-Definitionen, JavaScript und frühere Speicherstände. Von den Seiten
 * werden zusätzlich deren eigene Metadaten (/Metadata, /PieceInfo, /LastModified) entfernt.
 * Kommentare auf den Seiten und Metadaten in eingebetteten Bildern bleiben erhalten.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFStream,
  PDFString,
  type PDFObject,
} from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';

export interface InfoEntry {
  /** Schlüssel ohne Schrägstrich, z. B. „Author“ */
  key: string;
  /** Lesbarer Wert; Datumsangaben als 25.09.2026 14:30 */
  value: string;
}

export interface PdfInspection {
  /** z. B. „1.7“, aus der Kopfzeile */
  version: string | null;
  pages: number;
  info: InfoEntry[];
  /** Größe des XMP-Metadatenstroms des Dokuments in Byte, sonst null */
  xmpBytes: number | null;
  attachments: number;
  /** Kommentare und Markierungen (Anmerkungen außer Verweisen und Formularfeldern) */
  comments: number;
  formFields: number;
  bookmarks: boolean;
  javascript: boolean;
  /** Frühere Speicherstände durch inkrementelle Änderungen */
  earlierVersions: number;
  /** Seiten mit eigenen Metadaten (/Metadata, /PieceInfo, /LastModified) */
  pagesWithMetadata: number;
}

const PAGE_METADATA_KEYS = ['Metadata', 'PieceInfo', 'LastModified'] as const;
const MAX_TREE_DEPTH = 32;

/**
 * PDF-Datum nach ISO 32000-2, 7.9.4: D:JJJJMMTTHHmmSSOHH'mm (alles ab dem Monat optional).
 * Ausgabe in der Ortszeit der Datei, wie sie dort steht: „25.09.2026 14:30“.
 */
export function formatPdfDate(raw: string): string | null {
  const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(raw.trim());
  if (!m) return null;
  const [, year, month = '01', day = '01', hours, minutes = '00'] = m;
  const date = `${day}.${month}.${year}`;
  return hours === undefined ? date : `${date} ${hours}:${minutes}`;
}

function textOf(value: PDFObject | undefined): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  if (value instanceof PDFName) return value.decodeText();
  if (value instanceof PDFNumber) return String(value.asNumber());
  return null;
}

function readInfo(doc: PDFDocument): InfoEntry[] {
  const ref = doc.context.trailerInfo.Info;
  const info = ref ? doc.context.lookup(ref) : undefined;
  if (!(info instanceof PDFDict)) return [];
  const entries: InfoEntry[] = [];
  for (const [key, object] of info.entries()) {
    const text = textOf(doc.context.lookup(object));
    if (text === null || text.trim() === '') continue;
    const name = key.decodeText();
    const value = /Date$/.test(name) ? (formatPdfDate(text) ?? text) : text;
    entries.push({ key: name, value });
  }
  return entries;
}

/** Zählt die Blätter eines Namensbaums (ISO 32000-2, 7.9.6), mit Tiefenbegrenzung. */
function countNameTree(doc: PDFDocument, node: PDFObject | undefined, depth = 0): number {
  const dict = node ? doc.context.lookup(node) : undefined;
  if (!(dict instanceof PDFDict) || depth > MAX_TREE_DEPTH) return 0;
  let count = 0;
  const names = dict.lookup(PDFName.of('Names'));
  if (names instanceof PDFArray) count += Math.floor(names.size() / 2);
  const kids = dict.lookup(PDFName.of('Kids'));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) count += countNameTree(doc, kids.get(i), depth + 1);
  }
  return count;
}

function hasJavaScriptAction(doc: PDFDocument, action: PDFObject | undefined): boolean {
  const dict = action ? doc.context.lookup(action) : undefined;
  return dict instanceof PDFDict && dict.lookup(PDFName.of('S')) === PDFName.of('JavaScript');
}

/** Wie oft die Datei nachträglich gespeichert wurde, ohne sie neu zu schreiben. */
export function countEarlierVersions(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);
  const eofs = text.match(/%%EOF/g)?.length ?? 0;
  // Linearisierte PDFs („schnelle Webanzeige“) haben am Anfang einen zweiten Abschluss.
  const linearized = /\/Linearized\b/.test(text.slice(0, 2048)) ? 1 : 0;
  return Math.max(0, eofs - 1 - linearized);
}

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const doc = await loadPdf(bytes);
  try {
    const catalog = doc.catalog;
    const metadata = catalog.lookup(PDFName.of('Metadata'));
    const names = catalog.lookup(PDFName.of('Names'));
    const namesDict = names instanceof PDFDict ? names : undefined;

    let comments = 0;
    let pagesWithMetadata = 0;
    let pageJavaScript = false;
    for (const page of doc.getPages()) {
      if (PAGE_METADATA_KEYS.some((key) => page.node.has(PDFName.of(key)))) pagesWithMetadata++;
      const annots = page.node.Annots();
      for (let i = 0; i < (annots?.size() ?? 0); i++) {
        const annot = annots ? doc.context.lookup(annots.get(i)) : undefined;
        if (!(annot instanceof PDFDict)) continue;
        const subtype = annot.lookup(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Link')) {
          if (hasJavaScriptAction(doc, annot.get(PDFName.of('A')))) pageJavaScript = true;
          continue;
        }
        if (subtype !== PDFName.of('Widget') && subtype !== PDFName.of('Popup')) comments++;
      }
    }

    let formFields = 0;
    try {
      formFields = doc.getForm().getFields().length;
    } catch {
      formFields = 0;
    }

    const outlines = catalog.lookup(PDFName.of('Outlines'));
    const header = new TextDecoder('latin1').decode(bytes.subarray(0, 16));
    return {
      version: /%PDF-(\d\.\d)/.exec(header)?.[1] ?? null,
      pages: doc.getPageCount(),
      info: readInfo(doc),
      xmpBytes: metadata instanceof PDFStream ? metadata.getContentsSize() : null,
      attachments: countNameTree(doc, namesDict?.get(PDFName.of('EmbeddedFiles'))),
      comments,
      formFields,
      bookmarks: outlines instanceof PDFDict && outlines.has(PDFName.of('First')),
      javascript:
        pageJavaScript ||
        countNameTree(doc, namesDict?.get(PDFName.of('JavaScript'))) > 0 ||
        hasJavaScriptAction(doc, catalog.get(PDFName.of('OpenAction'))),
      earlierVersions: countEarlierVersions(bytes),
      pagesWithMetadata,
    };
  } catch (error) {
    throw toPdfError(error);
  }
}

/** Neue PDF nur mit den Seiten, ohne Metadaten des Dokuments und der Seiten. */
export async function stripPdfMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const source = await loadPdf(bytes);
  try {
    // Ohne Producer/Creator von pdf-lib, siehe docs/pdf-lib.md Nr. 8 und 9.
    const out = await PDFDocument.create({ updateMetadata: false });
    const pages = await out.copyPages(source, source.getPageIndices());
    for (const page of pages) {
      for (const key of PAGE_METADATA_KEYS) page.node.delete(PDFName.of(key));
      out.addPage(page);
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
