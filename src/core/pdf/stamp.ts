/**
 * Seitenzahlen und Stempel in eine bestehende PDF schreiben (plan-phase2.md Werkzeuge 6 und 7).
 * Ohne DOM, läuft im Worker.
 *
 * Die PDF wird geladen, bemalt und neu gespeichert; Formulare, Lesezeichen und Metadaten
 * bleiben erhalten. Digitale Signaturen werden dadurch ungültig (isSigned erkennt sie vorher).
 * Schrift: Helvetica aus den 14 PDF-Standardschriften, Zeichensatz WinAnsi. Zeichen außerhalb
 * davon werden vorher gemeldet statt ersetzt (Entscheidung E8a).
 */

import {
  degrees,
  PDFDict,
  PDFDocument,
  type PDFFont,
  type PDFPage,
  PDFName,
  PDFNumber,
  PDFSignature,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
export { unsupportedChars } from './winansi.ts';
import { pageIndices, type PageRange } from './page-ranges.ts';
import { pageNumberFor, pageNumberInView, type PageNumberOptions } from './page-numbers.ts';
export { pageNumberText, type NumberFormat, type PageNumberOptions } from './page-numbers.ts';
import { normalizeRotation, toUserSpace, visibleSize } from './stamp-geometry.ts';
import { stampInView, type StampLookOptions } from './stamp-layout.ts';
export { diagonalFontSize, type StampColor, type StampPlacement } from './stamp-layout.ts';

/** Zeichenvorrat von Helvetica (WinAnsi), aus der in pdf-lib eingebauten Schrift gelesen */
export async function standardFontCharset(): Promise<number[]> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  return font.getCharacterSet();
}

/**
 * Hat die PDF eine digitale Signatur? ISO 32000-2, 12.8: Signaturfelder mit Wert (/V), das
 * Kennzeichen SignaturesExist in /SigFlags des Formulars, oder ein Signaturwörterbuch mit
 * /ByteRange in der Datei.
 */
export function isSigned(doc: PDFDocument, bytes: Uint8Array): boolean {
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'));
  if (acroForm instanceof PDFDict) {
    const flags = acroForm.lookup(PDFName.of('SigFlags'));
    if (flags instanceof PDFNumber && (flags.asNumber() & 1) === 1) return true;
  }
  try {
    const signed = doc
      .getForm()
      .getFields()
      .some((f) => f instanceof PDFSignature && f.acroField.dict.has(PDFName.of('V')));
    if (signed) return true;
  } catch {
    // Beschädigtes Formular: dann entscheidet der Blick in die Datei unten.
  }
  const text = new TextDecoder('latin1').decode(bytes);
  return /\/ByteRange\s*\[/.test(text) && /\/Type\s*\/Sig\b/.test(text);
}

export interface PdfFacts {
  pages: number;
  signed: boolean;
}

export async function inspectForStamp(bytes: Uint8Array): Promise<PdfFacts> {
  const doc = await loadPdf(bytes);
  return { pages: doc.getPageCount(), signed: isSigned(doc, bytes) };
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  try {
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}

export async function addPageNumbers(
  bytes: Uint8Array,
  options: PageNumberOptions,
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  await drawPageNumbers(doc, options);
  return save(doc);
}

/**
 * Setzt die Seitenzahlen auf die Seiten des Dokuments, so wie der Leser jede Seite sieht
 * (eigene Drehung berücksichtigt). Liegt „Ab Seite“ hinter der letzten Seite, bekommt keine
 * Seite eine Zahl. Genutzt vom Werkzeug und beim Export der Werkstatt (assemble.ts).
 */
export async function drawPageNumbers(doc: PDFDocument, options: PageNumberOptions): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const text = pageNumberFor(options, index, pages.length);
    if (text === null) return;
    const size = options.fontSize;
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    const { width, height } = visibleSize(box, rotation);
    const at = pageNumberInView(width, height, options, font.widthOfTextAtSize(text, size));
    const place = toUserSpace(box, rotation, at.vx, at.vy);
    page.drawText(text, {
      x: place.x,
      y: place.y,
      size,
      font,
      color: rgb(0, 0, 0),
      rotate: degrees(rotation),
    });
  });
}

export interface StampOptions extends StampLookOptions {
  /** Seiten; leer heißt alle */
  pages: PageRange[];
}

export async function addStamp(bytes: Uint8Array, options: StampOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await stampFont(doc);
  const pages = doc.getPages();
  const chosen = new Set(
    options.pages.length === 0 ? pages.map((_, i) => i) : options.pages.flatMap(pageIndices),
  );
  pages.forEach((page, index) => {
    if (chosen.has(index)) drawStamp(page, font, options);
  });
  return save(doc);
}

/** Schrift des Stempels (Helvetica fett); einmal je Dokument einbetten */
export function stampFont(doc: PDFDocument): Promise<PDFFont> {
  return doc.embedFont(StandardFonts.HelveticaBold);
}

/**
 * Setzt den Stempel auf die Seite, so wie der Leser sie sieht (eigene Drehung berücksichtigt).
 * Genutzt vom Werkzeug und beim Export der Werkstatt (assemble.ts).
 */
export function drawStamp(
  page: PDFPage,
  font: PDFFont,
  options: Omit<StampOptions, 'pages'>,
): void {
  const box = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const { width, height } = visibleSize(box, rotation);
  const stamp = stampInView(width, height, options, (size) =>
    font.widthOfTextAtSize(options.text, size),
  );
  const [r, g, b] = stamp.rgb;
  const at = toUserSpace(box, rotation, stamp.vx, stamp.vy);
  page.drawText(options.text, {
    x: at.x,
    y: at.y,
    size: stamp.size,
    font,
    color: rgb(r, g, b),
    opacity: stamp.opacity,
    rotate: degrees((stamp.angle + rotation) % 360),
  });
}
