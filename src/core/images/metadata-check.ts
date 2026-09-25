/**
 * Prüft ein fertiges JPEG, WebP oder PNG auf personenbezogene Metadaten, bevor es zum Speichern
 * angeboten wird (plan.md Abschnitt 4). Das Verkleinern erzeugt das Bild neu und sollte keine
 * Metadaten übernehmen; diese Prüfung stellt das für jede Datei sicher, statt es anzunehmen.
 *
 * Exif wird gezielt nach Einträgen durchsucht (EXIF/TIFF, CIPA DC-008), weil Encoder auch
 * ohne Angaben kleine, harmlose Exif-Blöcke schreiben (z. B. Farbraum, Bildgröße).
 * XMP, IPTC/Photoshop-Blöcke und Kommentare gelten immer als Fund, weil sie beliebigen Text
 * enthalten können.
 */

export type MetadataFinding =
  | 'gps'
  | 'camera'
  | 'date'
  | 'author'
  | 'comment'
  | 'xmp'
  | 'iptc'
  | 'malformed'
  | 'unknown-format';

/** TIFF-Tags in IFD0 und im Exif-IFD, die auf Person, Gerät, Ort oder Zeitpunkt schließen lassen. */
const TAGS = new Map<number, MetadataFinding>([
  [0x010f, 'camera'], // Make
  [0x0110, 'camera'], // Model
  [0x0131, 'camera'], // Software
  [0x013c, 'camera'], // HostComputer
  [0x0132, 'date'], // DateTime
  [0x013b, 'author'], // Artist
  [0x8298, 'author'], // Copyright
  [0x8825, 'gps'], // GPS-IFD-Zeiger
  [0x9003, 'date'], // DateTimeOriginal
  [0x9004, 'date'], // DateTimeDigitized
  [0x927c, 'camera'], // MakerNote
  [0x9286, 'comment'], // UserComment
  [0xa420, 'camera'], // ImageUniqueID
  [0xa430, 'author'], // CameraOwnerName
  [0xa431, 'camera'], // BodySerialNumber
  [0xa433, 'camera'], // LensMake
  [0xa434, 'camera'], // LensModel
  [0xa435, 'camera'], // LensSerialNumber
]);
const EXIF_IFD_POINTER = 0x8769;

class Malformed extends Error {}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Durchsucht einen TIFF-Block (Inhalt von Exif) nach den Tags oben. */
function scanTiff(bytes: Uint8Array, found: Set<MetadataFinding>): void {
  if (bytes.length < 8) throw new Malformed();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = ascii(bytes, 0, 2);
  if (order !== 'II' && order !== 'MM') throw new Malformed();
  const little = order === 'II';
  const u16 = (at: number) => {
    if (at + 2 > bytes.length) throw new Malformed();
    return view.getUint16(at, little);
  };
  const u32 = (at: number) => {
    if (at + 4 > bytes.length) throw new Malformed();
    return view.getUint32(at, little);
  };
  if (u16(2) !== 42) throw new Malformed();

  const visited = new Set<number>();
  const scanIfd = (offset: number): void => {
    if (visited.has(offset)) throw new Malformed();
    visited.add(offset);
    const count = u16(offset);
    for (let i = 0; i < count; i++) {
      const entry = offset + 2 + i * 12;
      const tag = u16(entry);
      const finding = TAGS.get(tag);
      if (finding) found.add(finding);
      if (tag === EXIF_IFD_POINTER) scanIfd(u32(entry + 8));
    }
  };
  scanIfd(u32(4));
}

function scanJpeg(bytes: Uint8Array, found: Set<MetadataFinding>): void {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Malformed();
    const marker = bytes[i + 1] ?? 0;
    // Marker ohne Längenfeld
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return; // Bilddaten beginnen bzw. Ende
    if (i + 4 > bytes.length) throw new Malformed();
    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    const start = i + 4;
    const end = i + 2 + length;
    if (length < 2 || end > bytes.length) throw new Malformed();

    if (marker === 0xe1) {
      if (ascii(bytes, start, 6) === 'Exif\0\0') scanTiff(bytes.subarray(start + 6, end), found);
      else found.add('xmp'); // XMP oder anderer APP1-Inhalt
    }
    if (marker === 0xed) found.add('iptc'); // APP13: Photoshop/IPTC
    if (marker === 0xfe) found.add('comment'); // COM
    i = end;
  }
}

function scanWebp(bytes: Uint8Array, found: Set<MetadataFinding>): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 12;
  while (i + 8 <= bytes.length) {
    const id = ascii(bytes, i, 4);
    const size = view.getUint32(i + 4, true);
    const start = i + 8;
    const end = start + size;
    if (end > bytes.length) throw new Malformed();
    if (id === 'EXIF') {
      const exif = bytes.subarray(start, end);
      scanTiff(ascii(exif, 0, 6) === 'Exif\0\0' ? exif.subarray(6) : exif, found);
    }
    if (id === 'XMP ') found.add('xmp');
    i = end + (size % 2); // Chunks sind auf gerade Länge aufgefüllt
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * PNG (W3C PNG Specification, 3rd Edition / ISO/IEC 15948): Chunks aus Länge (4 Byte, Big
 * Endian), Typ, Daten und CRC. Text-Chunks (tEXt, zTXt, iTXt) können beliebigen Text enthalten,
 * XMP steht in iTXt mit dem Schlüssel „XML:com.adobe.xmp“, eXIf enthält Exif, tIME die Zeit
 * der letzten Änderung.
 */
function scanPng(bytes: Uint8Array, found: Set<MetadataFinding>): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i);
    const type = ascii(bytes, i + 4, 4);
    const start = i + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Malformed();
    if (type === 'tEXt' || type === 'zTXt') found.add('comment');
    if (type === 'iTXt') {
      found.add(ascii(bytes, start, 17) === 'XML:com.adobe.xmp' ? 'xmp' : 'comment');
    }
    if (type === 'eXIf') scanTiff(bytes.subarray(start, end), found);
    if (type === 'tIME') found.add('date');
    if (type === 'IEND') return;
    i = end + 4;
  }
  throw new Malformed();
}

/** Gibt die gefundenen Arten von Metadaten zurück, sortiert. Leer heißt: nichts gefunden. */
export function findMetadata(bytes: Uint8Array): MetadataFinding[] {
  const found = new Set<MetadataFinding>();
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) scanJpeg(bytes, found);
    else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') scanWebp(bytes, found);
    else if (PNG_SIGNATURE.every((b, i) => bytes[i] === b)) scanPng(bytes, found);
    else found.add('unknown-format');
  } catch (error) {
    if (!(error instanceof Malformed)) throw error;
    found.add('malformed');
  }
  return [...found].sort();
}
