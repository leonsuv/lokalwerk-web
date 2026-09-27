/**
 * Eine PDF für die PDF-Werkstatt einlesen (plan-phase3.md Abschnitt 3): Seitengrößen und eigene
 * Drehung je Seite (für Platzhalter mit richtigem Seitenverhältnis und Leerseiten) und was beim
 * Neuzusammensetzen verloren geht (Hinweise vor dem Export). Ohne DOM, läuft im Worker.
 *
 * Seitengröße: CropBox, sonst MediaBox (ISO 32000-2, 7.7.3.3; pdf-lib `getCropBox`).
 * Lesezeichen: /Outlines mit mindestens einem Eintrag (/First, 12.3.3).
 * XFA: /XFA im AcroForm-Wörterbuch (12.7.9). Signatur: isSigned aus stamp.ts.
 */

import { PDFArray, PDFDict, PDFName } from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
import { hiddenInfo } from './metadata.ts';
import { isSigned } from './stamp.ts';
import { normalizeRotation, type PageRotation } from './stamp-geometry.ts';

export interface WorkshopPdfInfo {
  pages: { box: { width: number; height: number }; rotate: PageRotation }[];
  facts: {
    form: boolean;
    xfa: boolean;
    outline: boolean;
    signed: boolean;
    /** Versteckte Angaben im Dokument bzw. auf Seiten (Schritt 2.4) */
    metadata: boolean;
    pageMetadata: boolean;
  };
}

/** Wirft PdfError (leer, verschlüsselt, beschädigt, keine Seiten, zu wenig Speicher). */
export async function inspectForWorkshop(bytes: Uint8Array): Promise<WorkshopPdfInfo> {
  const doc = await loadPdf(bytes);
  try {
    const pages = doc.getPages().map((page) => {
      const { width, height } = page.getCropBox();
      return {
        box: { width: Math.abs(width), height: Math.abs(height) },
        rotate: normalizeRotation(page.getRotation().angle),
      };
    });
    const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'));
    const fields = acroForm instanceof PDFDict ? acroForm.lookup(PDFName.of('Fields')) : undefined;
    const outlines = doc.catalog.lookup(PDFName.of('Outlines'));
    // Vor isSigned lesen: pdf-lib entfernt /XFA beim ersten getForm() (PDFDocument.getForm).
    const xfa = acroForm instanceof PDFDict && acroForm.has(PDFName.of('XFA'));
    return {
      pages,
      facts: {
        form: fields instanceof PDFArray && fields.size() > 0,
        xfa,
        outline: outlines instanceof PDFDict && outlines.has(PDFName.of('First')),
        signed: isSigned(doc, bytes),
        ...hiddenInfo(doc, bytes),
      },
    };
  } catch (error) {
    throw toPdfError(error);
  }
}
