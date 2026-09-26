/**
 * exifr liefert Typen nur für den Paketeinstieg. Die Lite-Fassung hat dieselbe Schnittstelle; wir
 * nutzen nur `parse` und geben das Ergebnis als `unknown` weiter (Prüfung in core/images/exif-read.ts).
 */
declare module 'exifr/dist/lite.esm.mjs' {
  export function parse(data: Uint8Array | ArrayBuffer, options?: object): Promise<unknown>;
}
