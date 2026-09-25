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
  PDFName,
  PDFNumber,
  PDFSignature,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
import { pageIndices, type PageRange } from './page-ranges.ts';
import {
  diagonalAngle,
  normalizeRotation,
  placeAtEdge,
  placeCentered,
  visibleSize,
  type Anchor,
} from './stamp-geometry.ts';

/** Zeichen des Texts, die die Schrift nicht darstellen kann, jedes einmal */
export function unsupportedChars(text: string, charset: ReadonlySet<number>): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    if (!charset.has(char.codePointAt(0) ?? 0)) missing.add(char);
  }
  return [...missing];
}

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

export type NumberFormat = 'n' | 'seite-n' | 'seite-n-von-m' | 'n-von-m' | 'strich';

export function pageNumberText(format: NumberFormat, n: number, last: number): string {
  switch (format) {
    case 'n':
      return String(n);
    case 'seite-n':
      return `Seite ${n}`;
    case 'seite-n-von-m':
      return `Seite ${n} von ${last}`;
    case 'n-von-m':
      return `${n} / ${last}`;
    case 'strich':
      return `– ${n} –`;
  }
}

export interface PageNumberOptions {
  format: NumberFormat;
  anchor: Anchor;
  /** Erste Seite (ab 1), die eine Zahl bekommt; davor bleibt frei (z. B. Deckblatt) */
  fromPage: number;
  /** Zahl auf der ersten nummerierten Seite */
  startAt: number;
  fontSize: number;
  /** Abstand vom Seitenrand in Millimetern */
  marginMm: number;
}

const MM = 72 / 25.4;

/**
 * Versalhöhe von Helvetica und Helvetica-Bold: 718/1000 der Schriftgröße (CapHeight in den Adobe
 * Core 14 AFM, wie sie @pdf-lib/standard-fonts mitbringt; geprüft am 25.09.2026).
 */
const CAP_HEIGHT = 0.718;

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
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const first = Math.max(1, Math.floor(options.fromPage));
  const last = options.startAt + (pages.length - first);
  pages.forEach((page, index) => {
    if (index + 1 < first) return;
    const text = pageNumberText(options.format, options.startAt + index + 1 - first, last);
    const size = options.fontSize;
    const place = placeAtEdge(
      page.getCropBox(),
      normalizeRotation(page.getRotation().angle),
      options.anchor,
      font.widthOfTextAtSize(text, size),
      size * CAP_HEIGHT,
      options.marginMm * MM,
    );
    page.drawText(text, {
      x: place.x,
      y: place.y,
      size,
      font,
      color: rgb(0, 0, 0),
      rotate: degrees(place.rotate),
    });
  });
  return save(doc);
}

export type StampPlacement = 'diagonal' | 'top' | 'bottom';
export type StampColor = 'gray' | 'red' | 'blue';

const COLORS: Record<StampColor, [number, number, number]> = {
  gray: [0.45, 0.45, 0.45],
  red: [0.8, 0.1, 0.1],
  blue: [0.15, 0.3, 0.8],
};

export interface StampOptions {
  text: string;
  placement: StampPlacement;
  color: StampColor;
  /** 0 bis 1 */
  opacity: number;
  /** Seiten; leer heißt alle */
  pages: PageRange[];
}

/** Schriftgröße für den diagonalen Stempel: Zeile etwa 70 % der Diagonale, 12 bis 150 Punkt */
export function diagonalFontSize(diagonal: number, widthAtOnePoint: number): number {
  if (widthAtOnePoint <= 0) return 12;
  return Math.max(12, Math.min(150, (0.7 * diagonal) / widthAtOnePoint));
}

export async function addStamp(bytes: Uint8Array, options: StampOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const chosen = new Set(
    options.pages.length === 0 ? pages.map((_, i) => i) : options.pages.flatMap(pageIndices),
  );
  const [r, g, b] = COLORS[options.color];
  pages.forEach((page, index) => {
    if (!chosen.has(index)) return;
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    let size = 28;
    let place;
    if (options.placement === 'diagonal') {
      const { width, height } = visibleSize(box, rotation);
      size = diagonalFontSize(Math.hypot(width, height), font.widthOfTextAtSize(options.text, 1));
      place = placeCentered(
        box,
        rotation,
        diagonalAngle(box, rotation),
        font.widthOfTextAtSize(options.text, size),
        size * CAP_HEIGHT,
      );
    } else {
      place = placeAtEdge(
        box,
        rotation,
        options.placement === 'top' ? 'top-center' : 'bottom-center',
        font.widthOfTextAtSize(options.text, size),
        size * CAP_HEIGHT,
        12 * MM,
      );
    }
    page.drawText(options.text, {
      x: place.x,
      y: place.y,
      size,
      font,
      color: rgb(r, g, b),
      opacity: Math.min(1, Math.max(0.05, options.opacity)),
      rotate: degrees(place.rotate),
    });
  });
  return save(doc);
}
