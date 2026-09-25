/**
 * Ersetzt die Nachlade-Fabrik von pdf.js. pdf.js fragt darüber CMaps, Standardschriften und
 * WASM-Dateien an; die Standard-Fabrik lädt sie per fetch nach. Hier gibt es kein Netzwerk:
 * - WASM-Dekoder nur in der WASM-Variante, aus dem Bundle (./wasm-bytes.ts),
 * - CMaps und Standardschriften gar nicht (plan-phase2.md Abschnitt 5.1). pdf.js weicht dann
 *   auf Systemschriften aus.
 */

type Kind = 'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl';

export class NotShippedError extends Error {}

/**
 * Wird beim ersten Laden gestartet, damit die Dekoder danach offline bereitstehen. Die Bedingung
 * steht hier wörtlich statt über PDFJS_WASM (./mode.ts): Nur so entfernt der Build den Import
 * in der Variante ohne WebAssembly, und wasm-bytes landet nicht in dist/.
 */
export const wasmFiles: Promise<Record<string, Uint8Array>> | null =
  import.meta.env.VITE_PDFJS_WASM === '1'
    ? import('./wasm-bytes.ts').then((m) => m.WASM_FILES)
    : null;

/** pdf.js übergibt dem Konstruktor die Adressen aus getDocument; sie werden nicht verwendet. */
export class LocalBinaryDataFactory {
  async fetch({ kind, filename }: { kind: Kind; filename: string }): Promise<Uint8Array> {
    if (kind === 'wasmUrl' && wasmFiles) {
      const bytes = (await wasmFiles)[filename];
      if (bytes) return bytes.slice();
    }
    throw new NotShippedError(`Nicht mitgeliefert: ${filename}`);
  }
}
