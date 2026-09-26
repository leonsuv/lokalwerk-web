/**
 * Etiketten-PDF (plan-phase2.md Werkzeug 24). Ohne DOM, läuft im Worker. Schrift: Helvetica aus
 * den 14 PDF-Standardschriften (WinAnsi, Entscheidung E8a; geprüft in core/labels/prepare.ts).
 *
 * Der Probedruck ist das erste Blatt mit Rahmen um jedes Etikett und dahinter ein Blatt mit einer
 * 100-mm-Linie. So lässt sich vor dem Druck auf den Bogen prüfen, ob der Drucker in tatsächlicher
 * Größe druckt und die Etiketten trifft.
 */

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { blockHeight, LINE_HEIGHT, MM_TO_PT } from '../labels/fit.ts';
import { labelRect, labelsPerPage, PAGE, type SheetSpec } from '../labels/layout.ts';
import type { PreparedLabel } from '../labels/prepare.ts';
import { toPdfError } from './merge.ts';

export interface LabelJob {
  sheet: SheetSpec;
  labels: readonly PreparedLabel[];
  /** Erster freier Platz auf dem ersten Bogen, ab 1 */
  start: number;
  /** Innenabstand in mm */
  padding: number;
  /** Probedruck: nur das erste Blatt, mit Rahmen, dazu ein Blatt mit der 100-mm-Linie */
  test: boolean;
}

/** Oberkante der Großbuchstaben unterhalb der Oberkante des Textblocks, als Anteil der Größe */
const ASCENT = 0.8;
const PAGE_PT = { width: PAGE.width * MM_TO_PT, height: PAGE.height * MM_TO_PT };
const GRAY = rgb(0.55, 0.55, 0.55);

function drawLabel(
  page: PDFPage,
  font: PDFFont,
  sheet: SheetSpec,
  slot: number,
  label: PreparedLabel,
  padding: number,
): void {
  const r = labelRect(sheet, slot);
  const boxTop = (r.y + padding) * MM_TO_PT;
  const boxHeight = (r.height - 2 * padding) * MM_TO_PT;
  const offset = (boxHeight - blockHeight(label.lines.length, label.size)) / 2;
  label.lines.forEach((text, i) => {
    const fromTop = boxTop + offset + label.size * ASCENT + i * label.size * LINE_HEIGHT;
    page.drawText(text, {
      x: (r.x + padding) * MM_TO_PT,
      y: PAGE_PT.height - fromTop,
      size: label.size,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

function drawFrames(page: PDFPage, sheet: SheetSpec): void {
  for (let slot = 0; slot < labelsPerPage(sheet); slot++) {
    const r = labelRect(sheet, slot);
    page.drawRectangle({
      x: r.x * MM_TO_PT,
      y: PAGE_PT.height - (r.y + r.height) * MM_TO_PT,
      width: r.width * MM_TO_PT,
      height: r.height * MM_TO_PT,
      borderColor: GRAY,
      borderWidth: 0.5,
    });
  }
}

/** Waagerechte 100-mm-Linie mit Zentimeterstrichen in der Mitte eines leeren Blatts */
function drawRuler(page: PDFPage, font: PDFFont): void {
  const length = 100 * MM_TO_PT;
  const x = (PAGE_PT.width - length) / 2;
  const y = PAGE_PT.height / 2;
  const notes = [
    'Diese Linie muss genau 100 mm lang sein.',
    'Ist sie kürzer oder länger, drucke mit „Tatsächliche Größe“ oder 100 %.',
  ];
  const size = 9;
  page.drawLine({ start: { x, y }, end: { x: x + length, y }, thickness: 0.8 });
  for (let cm = 0; cm <= 10; cm++) {
    const tick = x + cm * 10 * MM_TO_PT;
    page.drawLine({ start: { x: tick, y }, end: { x: tick, y: y + (cm % 5 === 0 ? 8 : 5) } });
  }
  notes.forEach((note, i) => {
    page.drawText(note, {
      x: (PAGE_PT.width - font.widthOfTextAtSize(note, size)) / 2,
      y: y - 18 - i * size * LINE_HEIGHT,
      size,
      font,
    });
  });
}

export async function buildLabelsPdf(job: LabelJob): Promise<Uint8Array> {
  try {
    // Ohne Producer/Creator und ohne Info-Einträge (docs/pdf-lib.md Nr. 8 und 9)
    const doc = await PDFDocument.create({ updateMetadata: false });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const perPage = labelsPerPage(job.sheet);
    const first = job.start - 1;
    const total = job.test ? Math.min(job.labels.length, perPage - first) : job.labels.length;
    let page: PDFPage | null = null;
    for (let i = 0; i < total; i++) {
      const slot = first + i;
      if (!page || slot % perPage === 0) page = doc.addPage([PAGE_PT.width, PAGE_PT.height]);
      const label = job.labels[i];
      if (label) drawLabel(page, font, job.sheet, slot, label, job.padding);
    }
    if (job.test) {
      page ??= doc.addPage([PAGE_PT.width, PAGE_PT.height]);
      drawFrames(page, job.sheet);
      // Messlinie auf einem eigenen Blatt, damit sie keine Etiketten verdeckt
      drawRuler(doc.addPage([PAGE_PT.width, PAGE_PT.height]), font);
    }
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
