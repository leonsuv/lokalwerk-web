/**
 * Dateigrößen deutsch formatieren, wie im Prototyp: „512 B“, „18 KB“, „1,4 MB“.
 * Basis 1024. Ab 1024 MB wird in GB angezeigt, weil Werkzeuge mit mehreren hundert MB
 * rechnen müssen (AGENTS.md Abschnitt 8).
 */

const oneDecimal = (value: number): string => value.toFixed(1).replace('.', ',');

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError(`Ungültige Dateigröße: ${bytes}`);
  }
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const kb = Math.round(bytes / 1024);
  if (kb < 1024) return `${kb} KB`;

  const mb = bytes / 1024 ** 2;
  if (Number(mb.toFixed(1)) < 1024) return `${oneDecimal(mb)} MB`;

  return `${oneDecimal(bytes / 1024 ** 3)} GB`;
}
