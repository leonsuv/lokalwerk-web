/** Dateiarten anhand von MIME-Typ und Endung erkennen. Der MIME-Typ fehlt manchmal
 *  (z. B. bei manchen Downloads unter Windows), deshalb zählt auch die Endung. */

export interface FileLike {
  name: string;
  type: string;
}

export function isPdf(file: FileLike): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImage(file: FileLike): boolean {
  return file.type.startsWith('image/');
}
