/**
 * ZIP-Archive ohne Kompression („stored“, Methode 0) nach der ZIP-Spezifikation von PKWARE
 * (APPNOTE.TXT, Abschnitte 4.3 und 4.4), plan-phase2.md E3. Fotos und PDFs sind schon
 * komprimiert, eine zweite Kompression spart kaum etwas.
 *
 * Diese Datei erzeugt nur die Verwaltungsdaten (Kopf je Datei, zentrales Verzeichnis). Die
 * Inhalte selbst werden nicht kopiert: Die Oberfläche setzt Kopf, Inhalt, Kopf, Inhalt, …,
 * Verzeichnis zu einem Blob zusammen (src/ui/zip.ts). Kein ZIP64: Archive bis knapp 4 GiB
 * und 65 535 Dateien.
 */

export type ZipErrorCode = 'too-large' | 'too-many' | 'empty';

export class ZipError extends Error {
  readonly code: ZipErrorCode;

  constructor(code: ZipErrorCode) {
    super(`ZIP-Fehler: ${code}`);
    this.name = 'ZipError';
    this.code = code;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * CRC-32 (ISO 3309, wie in APPNOTE 4.4.7). Für große Dateien in Stücken aufrufen und das
 * Ergebnis als `previous` weitergeben.
 */
export function crc32(bytes: Uint8Array, previous = 0): number {
  let crc = ~previous >>> 0;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return ~crc >>> 0;
}

/** Datum und Uhrzeit im MS-DOS-Format (APPNOTE 4.4.6), Ortszeit, 2-Sekunden-Schritte. */
export function dosDateTime(date: Date): { date: number; time: number } {
  if (date.getFullYear() < 1980) return { date: (1 << 5) | 1, time: 0 };
  return {
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  };
}

/**
 * Dateinamen für das Archiv: keine Ordner, keine Steuerzeichen, keine doppelten Namen
 * („foto.jpg“, „foto (2).jpg“). Groß-/Kleinschreibung zählt als gleich, wie unter Windows.
 */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    // eslint-disable-next-line no-control-regex -- Steuerzeichen gehören nicht in Dateinamen
    const clean = raw.replace(/[\u0000-\u001f\u007f/\\:]/g, '_').trim() || 'datei';
    const dot = clean.lastIndexOf('.');
    const [base, ext] = dot > 0 ? [clean.slice(0, dot), clean.slice(dot)] : [clean, ''];
    let name = clean;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})${ext}`;
    used.add(name.toLowerCase());
    return name;
  });
}

export interface ZipEntryInfo {
  name: string;
  size: number;
  crc: number;
  modified: Date;
}

export interface ZipLayout {
  /** Kopf je Datei, direkt vor ihrem Inhalt einzufügen */
  localHeaders: Uint8Array[];
  /** Zentrales Verzeichnis und Abschluss, ans Ende */
  centralDirectory: Uint8Array;
  /** Größe des fertigen Archivs in Byte */
  totalSize: number;
}

const MAX_32 = 0xffffffff;
const VERSION = 20; // 2.0: gilt für alle Programme; MS-DOS als Ursprungssystem
const UTF8_FLAG = 1 << 11; // Namen in UTF-8 (APPNOTE 4.4.4, Bit 11)

export function zipLayout(entries: readonly ZipEntryInfo[]): ZipLayout {
  if (entries.length === 0) throw new ZipError('empty');
  if (entries.length > 0xffff) throw new ZipError('too-many');
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const { date, time } = dosDateTime(entry.modified);
    if (entry.size > MAX_32 || offset > MAX_32) throw new ZipError('too-large');

    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, VERSION, true);
    l.setUint16(6, UTF8_FLAG, true);
    l.setUint16(8, 0, true); // gespeichert, ohne Kompression
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint32(14, entry.crc, true);
    l.setUint32(18, entry.size, true);
    l.setUint32(22, entry.size, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    local.set(name, 30);
    localHeaders.push(local);

    const header = new Uint8Array(46 + name.length);
    const c = new DataView(header.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, VERSION, true);
    c.setUint16(6, VERSION, true);
    c.setUint16(8, UTF8_FLAG, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, entry.crc, true);
    c.setUint32(20, entry.size, true);
    c.setUint32(24, entry.size, true);
    c.setUint16(28, name.length, true);
    // Zusatzfeld, Kommentar, Datenträger, interne und externe Attribute: 0
    c.setUint32(42, offset, true);
    header.set(name, 46);
    central.push(header);

    offset += local.length + entry.size;
  }

  const centralSize = central.reduce((sum, h) => sum + h.length, 0);
  if (offset > MAX_32 || offset + centralSize + 22 > MAX_32) throw new ZipError('too-large');
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);

  const centralDirectory = new Uint8Array(centralSize + end.length);
  let at = 0;
  for (const h of central) {
    centralDirectory.set(h, at);
    at += h.length;
  }
  centralDirectory.set(end, at);
  return { localHeaders, centralDirectory, totalSize: offset + centralDirectory.length };
}
