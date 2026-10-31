/**
 * Öffentliche Adresse der Website für Canonical, Open Graph, Sitemap und robots.txt.
 * Solange lokalwerk.eu nicht erreichbar ist, baut die Testinstanz mit ihrer eigenen Adresse
 * (LOKALWERK_SITE_URL=https://test1.azendix.de), damit Suchmaschinen keine Canonicals auf
 * eine nicht vorhandene Domain sehen. scripts/check-dist.mjs liest dieselbe Variable.
 */

export function resolveSiteUrl(fromEnv: string | undefined, fallback: string): string {
  const value = fromEnv?.trim() || fallback;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value) {
    throw new Error(`LOKALWERK_SITE_URL muss eine https-Adresse ohne Pfad sein: ${value}`);
  }
  return value;
}
