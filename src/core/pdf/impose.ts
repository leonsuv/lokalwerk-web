/**
 * Seiten verkleinert auf Blätter setzen (Werkzeuge „Mehrere Seiten pro Blatt“ und „Broschüre“).
 * Ohne DOM, läuft im Worker.
 *
 * Die Quellseiten werden als Formulare (Form XObjects, ISO 32000-2, 8.10) in neue Blätter
 * eingebettet: Text, Schriften und Vektoren bleiben erhalten, nur die Größe ändert sich. Gezeigt
 * wird der sichtbare Bereich der Seite (CropBox, /Rotate beachtet). Beschriftungen wie Links
 * und Formularfelder gehen dabei verloren, weil nur der Seiteninhalt übernommen wird.
 */

import { degrees, PDFDocument, rgb } from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
import { normalizeRotation } from './stamp-geometry.ts';

/** DIN A4 in Punkt (ISO 216, 1 pt = 1/72 Zoll) */
const A4 = { width: (210 * 72) / 25.4, height: (297 * 72) / 25.4 };

/** Ein Feld auf dem Blatt in Punkt, Ursprung unten links */
export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Grid {
  cols: number;
  rows: number;
  landscape: boolean;
}

/** Raster je Anzahl Seiten pro Blatt; Querformat, wo die Seiten dadurch größer bleiben */
export const GRIDS: Readonly<Record<number, Grid>> = {
  2: { cols: 2, rows: 1, landscape: true },
  4: { cols: 2, rows: 2, landscape: false },
  6: { cols: 3, rows: 2, landscape: true },
  8: { cols: 4, rows: 2, landscape: true },
  9: { cols: 3, rows: 3, landscape: false },
};

export const PER_SHEET = Object.keys(GRIDS).map(Number);

/** Felder eines Rasters, von links nach rechts und oben nach unten */
export function gridCells(grid: Grid, margin: number, gap: number): Cell[] {
  const sheetW = grid.landscape ? A4.height : A4.width;
  const sheetH = grid.landscape ? A4.width : A4.height;
  const cellW = (sheetW - 2 * margin - (grid.cols - 1) * gap) / grid.cols;
  const cellH = (sheetH - 2 * margin - (grid.rows - 1) * gap) / grid.rows;
  const cells: Cell[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      cells.push({
        x: margin + c * (cellW + gap),
        y: sheetH - margin - (r + 1) * cellH - r * gap,
        width: cellW,
        height: cellH,
      });
    }
  }
  return cells;
}

export function sheetSize(grid: Grid): { width: number; height: number } {
  return grid.landscape
    ? { width: A4.height, height: A4.width }
    : { width: A4.width, height: A4.height };
}

/** Seitenfolgen je Blatt für „n pro Blatt“; null = leeres Feld am Ende */
export function nUpSheets(total: number, perSheet: number): (number | null)[][] {
  const sheets: (number | null)[][] = [];
  for (let start = 0; start < total; start += perSheet) {
    sheets.push(Array.from({ length: perSheet }, (_, i) => (start + i < total ? start + i : null)));
  }
  return sheets;
}

/**
 * Seitenfolgen für eine Broschüre (Sattelheftung, doppelseitiger Druck an der langen Kante):
 * je Blatt zwei Seiten, zuerst die Vorderseite, dann die Rückseite. Die Seitenzahl wird auf ein
 * Vielfaches von 4 aufgefüllt (null = leere Seite am Ende). Beispiel mit 8 Seiten (0 bis 7):
 * Blatt 1 vorn 7|0, hinten 1|6; Blatt 2 vorn 5|2, hinten 3|4.
 */
export function bookletSheets(total: number): (number | null)[][] {
  const padded = Math.ceil(total / 4) * 4;
  const page = (i: number): number | null => (i < total ? i : null);
  const sheets: (number | null)[][] = [];
  for (let k = 0; k < padded / 4; k++) {
    sheets.push([page(padded - 1 - 2 * k), page(2 * k)]);
    sheets.push([page(2 * k + 1), page(padded - 2 - 2 * k)]);
  }
  return sheets;
}

export interface Placement {
  x: number;
  y: number;
  scale: number;
  /** Drehung gegen den Uhrzeigersinn in Grad für pdf-lib */
  rotate: number;
}

/**
 * Seite (Breite × Höhe im ungedrehten Raum, mit /Rotate) mittig und so groß wie möglich in ein
 * Feld setzen. pdf-lib wendet erst die Skalierung an, dann die Drehung, dann die Verschiebung.
 */
export function placeInCell(
  cell: Cell,
  width: number,
  height: number,
  rotation: number,
): Placement {
  const turns = normalizeRotation(rotation);
  const sideways = turns === 90 || turns === 270;
  const visibleW = sideways ? height : width;
  const visibleH = sideways ? width : height;
  const scale = Math.min(cell.width / visibleW, cell.height / visibleH);
  const theta = (-turns * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // Mittelpunkt der Seite nach Skalieren und Drehen: dorthin soll die Feldmitte
  const cx = (scale * width) / 2;
  const cy = (scale * height) / 2;
  return {
    x: cell.x + cell.width / 2 - (cx * cos - cy * sin),
    y: cell.y + cell.height / 2 - (cx * sin + cy * cos),
    scale,
    rotate: -turns,
  };
}

export interface ImposeOptions {
  /** Seitenfolge je Blatt; null = leeres Feld */
  sheets: readonly (readonly (number | null)[])[];
  grid: Grid;
  /** Rand in Punkt */
  margin: number;
  /** Abstand zwischen den Feldern in Punkt */
  gap: number;
  /** Dünner Rahmen um jedes belegte Feld */
  border: boolean;
}

export async function imposePages(
  bytes: Uint8Array,
  options: ImposeOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const source = await loadPdf(bytes);
  try {
    const out = await PDFDocument.create({ updateMetadata: false });
    const pages = source.getPages();
    const boxes = pages.map((page) => {
      const c = page.getCropBox();
      return { left: c.x, bottom: c.y, right: c.x + c.width, top: c.y + c.height };
    });
    const embedded = await out.embedPages(pages, boxes);
    const cells = gridCells(options.grid, options.margin, options.gap);
    const size = sheetSize(options.grid);
    for (const [s, order] of options.sheets.entries()) {
      const sheet = out.addPage([size.width, size.height]);
      for (const [i, index] of order.entries()) {
        const cell = cells[i];
        const form = index === null ? undefined : embedded[index];
        const box = index === null ? undefined : boxes[index];
        if (!cell || !form || !box) continue;
        const rotation = pages[index as number]?.getRotation().angle ?? 0;
        const place = placeInCell(cell, box.right - box.left, box.top - box.bottom, rotation);
        sheet.drawPage(form, {
          x: place.x,
          y: place.y,
          xScale: place.scale,
          yScale: place.scale,
          rotate: degrees(place.rotate),
        });
        if (options.border) {
          sheet.drawRectangle({
            x: cell.x,
            y: cell.y,
            width: cell.width,
            height: cell.height,
            borderColor: rgb(0.6, 0.6, 0.6),
            borderWidth: 0.5,
          });
        }
      }
      onProgress?.(s + 1, options.sheets.length);
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
