/** Bietet eine im Browser erzeugte Datei zum Speichern an. Nichts verlässt das Gerät. */

export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Etwas warten, sonst bricht mancher Browser den Download ab.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
