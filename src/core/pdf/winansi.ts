/**
 * Zeichen prüfen, bevor sie mit einer PDF-Standardschrift (WinAnsi) geschrieben werden
 * (Entscheidung E8a). Eigene Datei ohne pdf-lib, damit die Seiten sie laden können, ohne
 * pdf-lib in den Hauptthread zu ziehen; den Zeichenvorrat liefert der Worker.
 */

/** Zeichen des Texts, die die Schrift nicht darstellen kann, jedes einmal */
export function unsupportedChars(text: string, charset: ReadonlySet<number>): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    if (!charset.has(char.codePointAt(0) ?? 0)) missing.add(char);
  }
  return [...missing];
}
