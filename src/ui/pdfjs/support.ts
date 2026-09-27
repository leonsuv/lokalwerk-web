/**
 * Prüfung beim Laden, ob der Browser pdf.js ausführen kann (docs/pdfjs-kompatibilitaet.md
 * Abschnitt 5, Leon 27.09.2026). Ohne DOM und ohne pdf.js selbst, damit Werkzeuge es statisch
 * einbinden dürfen (chunk-guard) und es in Node testbar ist.
 *
 * Geprüft werden die APIs, die der Legacy-Build von pdf.js auf unserem Weg noch voraussetzt und
 * nicht mit core-js ergänzt (Messung in Abschnitt 1.3). Ein Browser mit diesen APIs kann auch die
 * ES2022-Syntax des Builds lesen. Schlägt das Laden trotzdem mit einem Syntaxfehler fehl, gilt der
 * Browser ebenso als zu alt. Zu alte Browser bekommen eine klare Meldung statt „Die Datei ist
 * beschädigt …“.
 */

type PdfJs = typeof import('./pdfjs.ts');

export const UNSUPPORTED_PREVIEW =
  'Dein Browser ist zu alt für die Vorschau. Aktualisiere ihn und lade die Seite neu.';
export const UNSUPPORTED_TOOL =
  'Dein Browser ist zu alt für dieses Werkzeug. Aktualisiere ihn und lade die Seite neu.';
export const SAVE_STILL_WORKS = 'Speichern funktioniert trotzdem.';

/** Vom Legacy-Build vorausgesetzt, nicht ergänzt: Chrome/Edge 119, Firefox 121, Safari 17.4 */
const REQUIRED_APIS: ReadonlyArray<readonly [string, (g: typeof globalThis) => unknown]> = [
  // Erst ab ES2024 in den Typen; hier bewusst ohne Typ geprüft
  [
    'Promise.withResolvers',
    (g) => (g.Promise as { withResolvers?: unknown } | undefined)?.withResolvers,
  ],
  ['Object.hasOwn', (g) => g.Object?.hasOwn],
  ['Array.prototype.at', (g) => g.Array?.prototype.at],
];

export function missingPdfjsApis(g: typeof globalThis = globalThis): string[] {
  return REQUIRED_APIS.filter(([, get]) => typeof get(g) !== 'function').map(([name]) => name);
}

export class PdfjsUnsupportedError extends Error {
  constructor(
    readonly missing: readonly string[],
    options?: ErrorOptions,
  ) {
    super(
      `pdf.js wird von diesem Browser nicht unterstützt (${missing.join(', ') || 'Syntax'})`,
      options,
    );
    this.name = 'PdfjsUnsupportedError';
  }
}

/**
 * Lädt pdf.js, wenn der Browser es ausführen kann; sonst PdfjsUnsupportedError. Andere Fehler
 * (z. B. offline, bevor die Datei im Cache lag) bleiben, wie sie sind. Die Rückgabe gilt als
 * behandelt, damit ein früher Fehler nicht als unbehandelt in der Konsole landet; wer sie
 * abwartet, bekommt ihn trotzdem.
 */
export function loadPdfjs(
  importer: () => Promise<PdfJs> = () => import('./pdfjs.ts'),
  g: typeof globalThis = globalThis,
): Promise<PdfJs> {
  const missing = missingPdfjsApis(g);
  const loaded =
    missing.length > 0
      ? Promise.reject(new PdfjsUnsupportedError(missing))
      : importer().catch((error: unknown) => {
          throw error instanceof SyntaxError
            ? new PdfjsUnsupportedError([], { cause: error })
            : error;
        });
  loaded.catch(() => undefined);
  return loaded;
}

export type PdfErrorCode = 'unsupported' | 'empty' | 'encrypted' | 'damaged' | 'unreadable';

/**
 * Fehlerart beim Öffnen einer PDF mit pdf.js, für die Meldungen der Werkzeuge. PdfOpenError
 * (pdfjs.ts) wird am Namen erkannt, damit dieses Modul pdf.js nicht einbindet.
 */
export function pdfErrorCode(error: unknown): PdfErrorCode {
  if (error instanceof PdfjsUnsupportedError) return 'unsupported';
  if (error instanceof Error && error.name === 'PdfOpenError' && 'code' in error) {
    return error.code as PdfErrorCode;
  }
  if (error instanceof DOMException) return 'unreadable';
  return 'damaged';
}
