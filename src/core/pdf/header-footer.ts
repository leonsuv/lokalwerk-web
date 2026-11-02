/**
 * Kopf- und Fußzeile in eine bestehende PDF schreiben (Werkzeug „Kopf- und Fußzeile“). Ohne DOM,
 * läuft im Worker. Die Seiten bleiben sonst unverändert: Inhalt, Lesezeichen und Metadaten
 * bleiben erhalten. Digitale Signaturen werden durch das Speichern ungültig.
 * Schrift: Helvetica aus den 14 PDF-Standardschriften, Zeichensatz WinAnsi.
 */

import { degrees, type PDFFont, rgb, StandardFonts } from 'pdf-lib';
import {
  type HeaderFooterOptions,
  isEmptyHeaderFooter,
  isSelectedPage,
  placeTexts,
  textsForPage,
  unsupportedInOptions,
} from './header-footer-layout.ts';
import { loadPdf, toPdfError } from './merge.ts';
import { normalizeRotation, toUserSpace, visibleSize } from './stamp-geometry.ts';

/**
 * `unsupported-chars`: Die Eingabe enthält Zeichen, die die Schrift nicht darstellen kann (in
 * `chars`, jedes einmal). `nothing`: keine Texte und keine Seitenzahl eingetragen.
 */
export class HeaderFooterError extends Error {
  constructor(
    readonly code: 'unsupported-chars' | 'nothing',
    readonly chars: readonly string[] = [],
  ) {
    super(code === 'nothing' ? 'Nichts einzutragen' : `Nicht darstellbar: ${chars.join(' ')}`);
    this.name = 'HeaderFooterError';
  }
}

/** Schreibt Kopf- und Fußzeile auf die gewählten Seiten und gibt die neue PDF zurück */
export async function addHeaderFooter(
  bytes: Uint8Array,
  options: HeaderFooterOptions,
): Promise<Uint8Array> {
  if (isEmptyHeaderFooter(options)) throw new HeaderFooterError('nothing');
  const missing = unsupportedInOptions(options);
  if (missing.length > 0) throw new HeaderFooterError('unsupported-chars', missing);

  const doc = await loadPdf(bytes);
  const font: PDFFont = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    if (!isSelectedPage(options.pages, index)) return;
    const items = textsForPage(options, index, pages.length);
    if (items.length === 0) return;
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    const { width, height } = visibleSize(box, rotation);
    const texts = placeTexts(width, height, items, options.fontSize, options.marginMm, (text) =>
      font.widthOfTextAtSize(text, options.fontSize),
    );
    for (const { text, vx, vy } of texts) {
      const at = toUserSpace(box, rotation, vx, vy);
      page.drawText(text, {
        x: at.x,
        y: at.y,
        size: options.fontSize,
        font,
        color: rgb(0, 0, 0),
        rotate: degrees(rotation),
      });
    }
  });
  try {
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
