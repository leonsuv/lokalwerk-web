/** Reine Regeln für „Bildformat umwandeln“: Zielformate und Dateinamen. */

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export const FORMATS: readonly { type: ImageFormat; name: string; extension: string }[] = [
  { type: 'image/jpeg', name: 'JPEG', extension: 'jpg' },
  { type: 'image/png', name: 'PNG', extension: 'png' },
  { type: 'image/webp', name: 'WebP', extension: 'webp' },
];

/** Verlustbehaftete Formate haben eine Qualitätsstufe, PNG nicht. */
export const hasQuality = (type: ImageFormat) => type !== 'image/png';

/** „Urlaub.webp“ → „Urlaub.jpg“; „foto.jpg“ bleibt „foto.jpg“. */
export function convertedName(name: string, type: ImageFormat): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim() || 'bild';
  const extension = FORMATS.find((f) => f.type === type)?.extension ?? 'bild';
  return `${base}.${extension}`;
}
