/**
 * Ersetzt die Nachlade-Fabrik von pdf.js. pdf.js fragt darüber CMaps, Standardschriften und
 * WASM-Dateien an; die Standard-Fabrik lädt sie per fetch nach. Hier gibt es kein Netzwerk und
 * nichts davon (plan-phase2.md Abschnitt 5.1, E4: ohne WebAssembly). pdf.js weicht dann auf
 * Systemschriften und seine JS-Ersatzdekoder aus.
 */

type Kind = 'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl';

export class NotShippedError extends Error {}

/** pdf.js übergibt dem Konstruktor die Adressen aus getDocument; sie werden nicht verwendet. */
export class LocalBinaryDataFactory {
  fetch({ filename }: { kind: Kind; filename: string }): Promise<Uint8Array> {
    return Promise.reject(new NotShippedError(`Nicht mitgeliefert: ${filename}`));
  }
}
