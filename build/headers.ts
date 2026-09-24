/**
 * Liest die Header für alle Pfade (`/*`) aus `public/_headers` (Cloudflare-Format),
 * damit `vite preview` dieselbe Content-Security-Policy ausliefert wie Cloudflare.
 */

export function parseGlobalHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let inGlobalBlock = false;

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    const indented = /^\s/.test(raw);
    if (!indented) {
      inGlobalBlock = raw.trim() === '/*';
      continue;
    }
    if (!inGlobalBlock) continue;
    const colon = raw.indexOf(':');
    if (colon < 0) throw new Error(`_headers: Zeile ohne Doppelpunkt: ${raw.trim()}`);
    headers[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim();
  }

  return headers;
}
