/**
 * Lokale Suche nach Werkzeugen (plan-phase2.md Abschnitt 3.3). Der Suchtext jedes Werkzeugs
 * wird beim Build mit `searchText` erzeugt und steht im HTML; die Seite vergleicht nur noch.
 * Kein Index als Datei, keine Anfrage, nichts wird gespeichert.
 */

/** Klein, ß → ss, Akzente weg, alles außer Buchstaben und Ziffern wird zu einem Leerzeichen. */
function fold(text: string, umlauts: 'ae' | 'a'): string {
  let out = text.toLowerCase().replace(/ß/g, 'ss');
  if (umlauts === 'ae') out = out.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  return out
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Suchbegriff vereinheitlichen: „Zusammen-Fügen“ → „zusammen fuegen“. */
export function normalizeQuery(query: string): string {
  return fold(query, 'ae');
}

/**
 * Suchtext eines Werkzeugs. Enthält jede Angabe zweimal, mit ausgeschriebenen und mit
 * vereinfachten Umlauten, damit „zusammenfugen“ und „zusammenfuegen“ beide treffen.
 */
export function searchText(parts: readonly string[]): string {
  const words = new Set(
    parts.flatMap((part) => [fold(part, 'ae'), fold(part, 'a')]).flatMap((p) => p.split(' ')),
  );
  words.delete('');
  return [...words].join(' ');
}

/** Trifft, wenn jedes Wort der Suche irgendwo im Suchtext vorkommt (auch als Wortteil). */
export function matchesQuery(query: string, text: string): boolean {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  return words.every((word) => text.includes(word));
}
