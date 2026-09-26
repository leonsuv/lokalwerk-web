/**
 * Foto-Metadaten verständlich aufbereiten (Werkzeug „Foto-Metadaten anzeigen“). Reine Funktionen
 * über dem, was exifr (Lite) liefert, mit `reviveValues: false`: Zeiten bleiben Text, wie sie in
 * der Datei stehen, ohne Umrechnung in eine Zeitzone.
 *
 * Feldnamen und Bedeutung: CIPA DC-008 (Exif). Ort nur als Text, keine Karte (plan-phase2.md 15).
 */

export interface MetaRow {
  label: string;
  value: string;
}

export interface MetaSection {
  title: string;
  rows: MetaRow[];
}

export type MetaFlag = 'gps' | 'camera' | 'date' | 'person' | 'software';

export interface MetaReport {
  sections: MetaSection[];
  flags: MetaFlag[];
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v.replace(/\0+$/, '').trim() || null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ') || null;
  return null;
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const de = (n: number, digits = 2) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: digits, useGrouping: false });

/** Grad, Minuten, Sekunden aus [G, M, S] oder einer Dezimalzahl, mit Himmelsrichtung */
export function formatDms(value: unknown, ref: unknown, axis: 'lat' | 'lon'): string | null {
  let parts: number[] | null = null;
  if (Array.isArray(value) && value.length === 3 && value.every((x) => typeof x === 'number')) {
    parts = value;
  } else if (typeof value === 'number') {
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    parts = [d, m, (abs - d - m / 60) * 3600];
  }
  if (!parts) return null;
  const [d = 0, m = 0, s = 0] = parts;
  const r = str(ref)?.toUpperCase();
  const dir =
    axis === 'lat'
      ? r === 'S' || (r === undefined && typeof value === 'number' && value < 0)
        ? 'S'
        : 'N'
      : r === 'W' || (r === undefined && typeof value === 'number' && value < 0)
        ? 'W'
        : 'O';
  return `${de(d, 0)}° ${de(m, 0)}′ ${de(s, 2)}″ ${dir}`;
}

/** Exif-Zeitangabe „2026:09:24 10:00:00“ → „24.09.2026, 10:00:00“; anderes unverändert */
export function formatExifDate(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(text);
  return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}` : text;
}

const ORIENTATION: Record<number, string> = {
  1: 'normal',
  2: 'gespiegelt',
  3: 'um 180° gedreht',
  4: 'um 180° gedreht und gespiegelt',
  5: 'um 90° gedreht und gespiegelt',
  6: 'um 90° im Uhrzeigersinn gedreht',
  7: 'um 270° gedreht und gespiegelt',
  8: 'um 90° gegen den Uhrzeigersinn gedreht',
};

function rows(entries: [string, string | null][]): MetaRow[] {
  return entries
    .filter((e): e is [string, string] => e[1] !== null)
    .map(([label, value]) => ({ label, value }));
}

/**
 * `parsed` ist die Ausgabe von exifr.parse mit mergeOutput: false (Blöcke ifd0, exif, gps, xmp).
 * `hasXmp`/`hasIptc`/`hasComment` kommen aus der eigenen Prüfung (images/metadata-check.ts).
 */
export function describeMetadata(
  parsed: Record<string, Raw | undefined> | undefined,
  extra: { xmp: boolean; iptc: boolean; comment: boolean } = {
    xmp: false,
    iptc: false,
    comment: false,
  },
): MetaReport {
  const ifd0 = parsed?.['ifd0'] ?? {};
  const exif = parsed?.['exif'] ?? {};
  const gps = parsed?.['gps'] ?? {};
  const sections: MetaSection[] = [];
  const flags = new Set<MetaFlag>();

  const lat = formatDms(gps['GPSLatitude'] ?? gps['latitude'], gps['GPSLatitudeRef'], 'lat');
  const lon = formatDms(gps['GPSLongitude'] ?? gps['longitude'], gps['GPSLongitudeRef'], 'lon');
  const alt = num(gps['GPSAltitude']);
  const place = rows([
    ['Breite', lat],
    ['Länge', lon],
    [
      'Höhe',
      alt === null
        ? null
        : `${de(alt, 1)} m ${gps['GPSAltitudeRef'] === 1 ? 'unter' : 'über'} dem Meeresspiegel`,
    ],
    [
      'Blickrichtung',
      num(gps['GPSImgDirection']) === null ? null : `${de(num(gps['GPSImgDirection']) ?? 0, 0)}°`,
    ],
  ]);
  if (lat || lon) flags.add('gps');
  if (place.length > 0) sections.push({ title: 'Aufnahmeort', rows: place });

  const camera = rows([
    ['Hersteller', str(ifd0['Make'])],
    ['Modell', str(ifd0['Model'])],
    ['Objektiv', str(exif['LensModel']) ?? str(exif['LensMake'])],
    ['Seriennummer der Kamera', str(exif['BodySerialNumber'])],
    ['Seriennummer des Objektivs', str(exif['LensSerialNumber'])],
    ['Eindeutige Bildkennung', str(exif['ImageUniqueID'])],
  ]);
  if (camera.length > 0) {
    flags.add('camera');
    sections.push({ title: 'Kamera', rows: camera });
  }

  const time = rows([
    ['Aufgenommen', formatExifDate(exif['DateTimeOriginal'])],
    ['Digitalisiert', formatExifDate(exif['CreateDate'] ?? exif['DateTimeDigitized'])],
    ['Geändert', formatExifDate(ifd0['ModifyDate'] ?? ifd0['DateTime'])],
    ['Zeitzone der Aufnahme', str(exif['OffsetTimeOriginal'])],
  ]);
  if (time.length > 0) {
    flags.add('date');
    sections.push({ title: 'Zeit', rows: time });
  }

  const person = rows([
    ['Urheber', str(ifd0['Artist'])],
    ['Urheberrecht', str(ifd0['Copyright'])],
    ['Besitzer der Kamera', str(exif['CameraOwnerName'])],
    ['Bildbeschreibung', str(ifd0['ImageDescription'])],
    ['Kommentar', str(exif['UserComment'])],
  ]);
  if (person.length > 0) {
    flags.add('person');
    sections.push({ title: 'Person und Beschreibung', rows: person });
  }

  const software = rows([
    ['Programm', str(ifd0['Software'])],
    ['Computer', str(ifd0['HostComputer'])],
  ]);
  if (software.length > 0) {
    flags.add('software');
    sections.push({ title: 'Software', rows: software });
  }

  const exposure = num(exif['ExposureTime']);
  const shot = rows([
    [
      'Belichtungszeit',
      exposure === null
        ? null
        : exposure < 1
          ? `1/${de(Math.round(1 / exposure), 0)} s`
          : `${de(exposure)} s`,
    ],
    ['Blende', num(exif['FNumber']) === null ? null : `f/${de(num(exif['FNumber']) ?? 0, 1)}`],
    ['ISO', str(exif['ISO'])],
    [
      'Brennweite',
      num(exif['FocalLength']) === null ? null : `${de(num(exif['FocalLength']) ?? 0, 1)} mm`,
    ],
    ['Ausrichtung', ORIENTATION[num(ifd0['Orientation']) ?? 0] ?? null],
  ]);
  if (shot.length > 0) sections.push({ title: 'Aufnahme', rows: shot });

  const more = rows([
    [
      'XMP-Daten',
      extra.xmp || parsed?.['xmp']
        ? 'vorhanden (Text beliebigen Inhalts, oft Bearbeitungsverlauf oder Bildrechte)'
        : null,
    ],
    ['IPTC-Daten', extra.iptc ? 'vorhanden (oft Beschreibung, Stichwörter, Urheber)' : null],
    ['Kommentar im Bild', extra.comment ? 'vorhanden' : null],
  ]);
  if (more.length > 0) sections.push({ title: 'Weitere Angaben', rows: more });

  return { sections, flags: [...flags] };
}
