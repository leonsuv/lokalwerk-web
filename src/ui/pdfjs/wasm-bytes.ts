/**
 * WASM-Dekoder von pdf.js als Teil des JS-Bundles. Ein eigener Abruf per fetch ginge unter
 * connect-src 'none' nicht; ein Skript von der eigenen Domain dagegen schon (script-src 'self').
 * Nur in der WASM-Variante eingebunden (./mode.ts).
 */

import jbig2 from 'pdfjs-dist/wasm/jbig2.wasm?inline';
import openjpeg from 'pdfjs-dist/wasm/openjpeg.wasm?inline';

function fromDataUrl(url: string): Uint8Array {
  const binary = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const WASM_FILES: Record<string, Uint8Array> = {
  'jbig2.wasm': fromDataUrl(jbig2),
  'openjpeg.wasm': fromDataUrl(openjpeg),
};
