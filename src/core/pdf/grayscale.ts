/**
 * Graustufen für gerasterte PDF-Seiten (Werkzeug „PDF in Graustufen“). Reine Rechnung ohne DOM.
 * Die Seiten zeichnet die Werkzeugseite mit pdf.js; hier wird nur der Pixelpuffer umgerechnet.
 * Gewichtung nach ITU-R BT.601 (0,299 Rot, 0,587 Grün, 0,114 Blau), in ganzzahligen Tausendsteln
 * gerechnet und kaufmännisch gerundet, damit die Werte exakt und überall gleich sind.
 */

/** Helligkeit eines Pixels, 0 bis 255, ganzzahlig */
export function luminance(r: number, g: number, b: number): number {
  return Math.floor((299 * r + 587 * g + 114 * b + 500) / 1000);
}

/**
 * Macht den RGBA-Puffer (je Pixel vier Bytes, wie ImageData.data) in place grau. Der Alphawert
 * bleibt unverändert.
 */
export function grayscaleRgba(data: Uint8Array | Uint8ClampedArray): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const y = luminance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }
}
