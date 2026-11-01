/**
 * Pfade für Archive mit Ordnerstruktur. Jeder Pfad wird bereinigt, bevor er ins Archiv kommt:
 * Schrägstriche trennen Ordner (Rückwärts-Schrägstriche werden dazu), leere Teile, „.“ und „..“
 * fallen weg, Steuerzeichen und Doppelpunkte werden zu „_“. So kann kein Eintrag aus dem Ordner
 * ausbrechen, in den das Archiv entpackt wird („Zip Slip“). Die Spezifikation verlangt
 * Schrägstriche und keinen führenden Schrägstrich (APPNOTE 4.4.17).
 */

/** Höchstlänge eines Pfades im Archiv (Feld „Dateinamenlänge“ hat 16 Bit, APPNOTE 4.4.10) */
const MAX_PATH_BYTES = 1024;

export function safeEntryPath(raw: string): string {
  const parts = raw
    .replace(/\\/g, '/')
    .split('/')
    // eslint-disable-next-line no-control-regex -- Steuerzeichen gehören nicht in Dateinamen
    .map((part) => part.replace(/[\u0000-\u001f\u007f:]/g, '_').trim())
    .filter((part) => part !== '' && part !== '.' && part !== '..');
  let path = parts.join('/') || 'datei';
  const encoder = new TextEncoder();
  while (encoder.encode(path).length > MAX_PATH_BYTES) path = path.slice(0, -1);
  return path;
}

/** Bereinigte Pfade; gleiche Pfade (Groß-/Kleinschreibung egal) werden „name (2).ext“ im selben Ordner. */
export function uniquePaths(paths: readonly string[]): string[] {
  const used = new Set<string>();
  return paths.map((raw) => {
    const clean = safeEntryPath(raw);
    const slash = clean.lastIndexOf('/');
    const folder = slash >= 0 ? clean.slice(0, slash + 1) : '';
    const file = clean.slice(slash + 1);
    const dot = file.lastIndexOf('.');
    const [base, ext] = dot > 0 ? [file.slice(0, dot), file.slice(dot)] : [file, ''];
    let path = clean;
    for (let n = 2; used.has(path.toLowerCase()); n++) path = `${folder}${base} (${n})${ext}`;
    used.add(path.toLowerCase());
    return path;
  });
}
