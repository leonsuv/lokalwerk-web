/**
 * Werkzeuge, in die die Startseite ohne Neuladen wechseln kann (src/tools/home/page.ts).
 * Je Werkzeug: das Markup der Seite (dieselbe main.html wie auf der Werkzeugseite) und die
 * Funktion, die die abgelegten Dateien übernimmt. Geladen wird erst beim Aufruf, damit die
 * Startseite keine PDF- oder Tabellenbibliothek lädt (AGENTS.md Abschnitt 3).
 *
 * Für jedes Werkzeug mit `accepts` im Register muss hier ein Eintrag stehen
 * (tests/tools/home-loaders.test.ts).
 */

export interface ToolLoader {
  markup: () => Promise<string>;
  open: () => Promise<(files: File[]) => unknown>;
}

export const LOADERS: Record<string, ToolLoader> = {
  'pdf-zusammenfuegen': {
    markup: async () => (await import('../pdf-zusammenfuegen/main.html?raw')).default,
    open: async () => (await import('../pdf-zusammenfuegen/page.ts')).addFiles,
  },
  'pdf-teilen': {
    markup: async () => (await import('../pdf-teilen/main.html?raw')).default,
    open: async () => (await import('../pdf-teilen/page.ts')).openFiles,
  },
  'pdf-seitenzahlen': {
    markup: async () => (await import('../pdf-seitenzahlen/main.html?raw')).default,
    open: async () => (await import('../pdf-seitenzahlen/page.ts')).openFiles,
  },
  'pdf-metadaten-entfernen': {
    markup: async () => (await import('../pdf-metadaten-entfernen/main.html?raw')).default,
    open: async () => (await import('../pdf-metadaten-entfernen/page.ts')).openFiles,
  },
  'bilder-zu-pdf': {
    markup: async () => (await import('../bilder-zu-pdf/main.html?raw')).default,
    open: async () => (await import('../bilder-zu-pdf/page.ts')).addFiles,
  },
  'fotos-verkleinern': {
    markup: async () => (await import('../fotos-verkleinern/main.html?raw')).default,
    open: async () => (await import('../fotos-verkleinern/page.ts')).addFiles,
  },
  'bildformat-umwandeln': {
    markup: async () => (await import('../bildformat-umwandeln/main.html?raw')).default,
    open: async () => (await import('../bildformat-umwandeln/page.ts')).addFiles,
  },
  'sepa-sammelueberweisung': {
    markup: async () => (await import('../sepa-sammelueberweisung/main.html?raw')).default,
    open: async () => (await import('../sepa-sammelueberweisung/page.ts')).openFiles,
  },
  'excel-csv-umwandeln': {
    markup: async () => (await import('../excel-csv-umwandeln/main.html?raw')).default,
    open: async () => (await import('../excel-csv-umwandeln/page.ts')).openFiles,
  },
};
