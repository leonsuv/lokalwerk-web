/**
 * QR-Codes kodieren mit uqr 0.1.3 (Grundlage: QR-Generator von Project Nayuki). Wir übergeben
 * immer UTF-8-Bytes (Byte-Modus), damit Sonderzeichen und Umlaute gleich behandelt werden.
 * Ruhezone: 4 Module rundum, wie ISO/IEC 18004 sie verlangt (über uqr, Norm selbst nicht
 * vorliegend).
 */

import { encode, renderSVG } from 'uqr';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  ecc: Ecc;
  /** Höchste erlaubte QR-Version (Größe); größer wirft QrTooLongError */
  maxVersion?: number;
}

export const QUIET_ZONE = 4;

export class QrTooLongError extends Error {
  constructor() {
    super('QR-Code: Inhalt zu lang');
    this.name = 'QrTooLongError';
  }
}

export interface QrMatrix {
  version: number;
  /** Kantenlänge in Modulen, ohne Ruhezone */
  size: number;
  /** true = dunkles Modul, [Zeile][Spalte] */
  modules: boolean[][];
}

export function utf8(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

function options({ ecc, maxVersion = 40 }: QrOptions) {
  // boostEcc aus: EPC069-12 verlangt genau Stufe M
  return { ecc, maxVersion, boostEcc: false, border: 0 };
}

export function qrMatrix(bytes: readonly number[], opts: QrOptions): QrMatrix {
  try {
    const result = encode(bytes, options(opts));
    return { version: result.version, size: result.size, modules: result.data };
  } catch (error) {
    if (error instanceof RangeError) throw new QrTooLongError();
    throw error;
  }
}

/** SVG mit Ruhezone, schwarze Module auf weißem Grund */
export function qrSvg(bytes: readonly number[], opts: QrOptions): string {
  try {
    return renderSVG(bytes, { ...options(opts), border: QUIET_ZONE, pixelSize: 10 });
  } catch (error) {
    if (error instanceof RangeError) throw new QrTooLongError();
    throw error;
  }
}
