/**
 * Briefpapier überlagern (Werkzeug „Briefpapier überlagern“). Ohne DOM, läuft im Worker.
 *
 * Jede Seite des Briefs wird als Formular (Form XObject, ISO 32000-2, 8.10) auf eine Seite gelegt,
 * die eine Seite des Briefpapiers als Hintergrund trägt. Beide Seiten bleiben Vektoren und Text;
 * nichts wird gerastert. Die Seitengröße der neuen Seite ist die des Briefpapiers. Der Brief wird
 * oben links bündig gesetzt, nur auf Wunsch skaliert. Links, Formularfelder, Lesezeichen und
 * Anmerkungen des Briefs gehen verloren, weil nur der Seiteninhalt übernommen wird. Die Zuordnung
 * der Seiten und das Feld berechnet ./letterhead-geometry.ts.
 */

import { degrees, PDFDocument, type PDFPage } from 'pdf-lib';
import { placeInCell } from './impose.ts';
import { letterheadPageIndex, contentCell, type LetterheadPick } from './letterhead-geometry.ts';
import { loadPdf, PdfError, toPdfError } from './merge.ts';
import { normalizeRotation, visibleSize } from './stamp-geometry.ts';

/** Das Briefpapier lässt sich nicht lesen (verschlüsselt, beschädigt, leer). Eigener Code, damit die Meldung sagt, welche Datei gemeint ist. */
export class LetterheadError extends Error {
  readonly code = 'letterhead-invalid';
  constructor() {
    super('Das Briefpapier konnte nicht gelesen werden');
    this.name = 'LetterheadError';
  }
}

export interface LetterheadSettings {
  pick: LetterheadPick;
  /** Brief auf die Größe des Briefpapiers einpassen, sonst unverändert (Maßstab 1) */
  fit: boolean;
}

/** Sichtbarer Bereich (CropBox) einer Seite; so wie resize.ts sie einbettet */
interface Area {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

function areaOf(page: PDFPage): Area {
  const c = page.getCropBox();
  return { left: c.x, bottom: c.y, right: c.x + c.width, top: c.y + c.height };
}

async function loadLetterhead(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await loadPdf(bytes);
  } catch (error) {
    if (error instanceof PdfError && error.code === 'out-of-memory') throw error;
    throw new LetterheadError();
  }
}

/**
 * Legt jede Seite von `contentBytes` über eine Seite von `letterheadBytes`. Wirft PdfError oder
 * LetterheadError.
 */
export async function overlayLetterhead(
  contentBytes: Uint8Array,
  letterheadBytes: Uint8Array,
  settings: LetterheadSettings,
): Promise<Uint8Array> {
  const content = await loadPdf(contentBytes);
  const letter = await loadLetterhead(letterheadBytes);
  try {
    const out = await PDFDocument.create({ updateMetadata: false });
    const letterPages = letter.getPages();
    const letterAreas = letterPages.map(areaOf);
    const letterForms = await out.embedPages(letterPages, letterAreas);

    const contentPages = content.getPages();
    const contentAreas = contentPages.map(areaOf);
    const contentForms = await out.embedPages(contentPages, contentAreas);

    for (const [i, contentPage] of contentPages.entries()) {
      const li = letterheadPageIndex(i, letterPages.length, settings.pick);
      const letterPage = letterPages[li];
      const letterArea = letterAreas[li];
      const letterForm = letterForms[li];
      const contentArea = contentAreas[i];
      const contentForm = contentForms[i];
      if (!letterPage || !letterArea || !letterForm || !contentArea || !contentForm) {
        throw new PdfError('damaged');
      }

      // Die neue Seite hat die Größe des Briefpapiers (sichtbarer Bereich, /Rotate beachtet).
      const letterW = letterArea.right - letterArea.left;
      const letterH = letterArea.top - letterArea.bottom;
      const letterRotation = normalizeRotation(letterPage.getRotation().angle);
      const sheetSize = visibleSize(
        { x: 0, y: 0, width: letterW, height: letterH },
        letterRotation,
      );
      const sheet = out.addPage([sheetSize.width, sheetSize.height]);
      const back = placeInCell(
        { x: 0, y: 0, width: sheetSize.width, height: sheetSize.height },
        letterW,
        letterH,
        letterRotation,
      );
      sheet.drawPage(letterForm, {
        x: back.x,
        y: back.y,
        xScale: back.scale,
        yScale: back.scale,
        rotate: degrees(back.rotate),
      });

      // Der Brief liegt darüber, mit dem Maßstab aus den Einstellungen.
      const contentW = contentArea.right - contentArea.left;
      const contentH = contentArea.top - contentArea.bottom;
      const contentRotation = normalizeRotation(contentPage.getRotation().angle);
      const contentVisible = visibleSize(
        { x: 0, y: 0, width: contentW, height: contentH },
        contentRotation,
      );
      const cell = contentCell(contentVisible, sheetSize, settings.fit);
      if (cell === null) throw new PdfError('damaged');
      const front = placeInCell(cell, contentW, contentH, contentRotation);
      sheet.drawPage(contentForm, {
        x: front.x,
        y: front.y,
        xScale: front.scale,
        yScale: front.scale,
        rotate: degrees(front.rotate),
      });
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
