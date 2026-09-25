import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../../build/pages.ts';

const pagesDir = fileURLToPath(new URL('../../pages/', import.meta.url));
const byUrl = (url: string) => PAGES.find((p) => p.url === url);

describe('Seitenregister', () => {
  it('hat eindeutige Dateien, URLs und Titel', () => {
    for (const key of ['file', 'url', 'title'] as const) {
      expect(new Set(PAGES.map((p) => p[key])).size).toBe(PAGES.length);
    }
  });

  it('verweist nur auf vorhandene HTML-Dateien', () => {
    for (const p of PAGES) expect(existsSync(pagesDir + p.file), p.file).toBe(true);
  });

  it('enthält genau die Seiten aus plan.md Abschnitt 3 und plan-phase2.md', () => {
    expect(PAGES.map((p) => p.url).sort()).toEqual(
      [
        '/',
        '/werkzeuge/',
        '/pdf-teilen/',
        '/bilder-zu-pdf/',
        '/pdf-metadaten-entfernen/',
        '/bildformat-umwandeln/',
        '/pdf-zusammenfuegen/',
        '/fotos-verkleinern/',
        '/sepa-sammelueberweisung/',
        '/pro/',
        '/impressum/',
        '/datenschutz/',
        '/lizenzen/',
        '/404.html',
      ].sort(),
    );
  });

  it('baut keine AGB-Seite (plan.md A7)', () => {
    expect(PAGES.some((p) => p.url.includes('agb'))).toBe(false);
  });

  it('setzt Rechtsseiten und 404 auf noindex', () => {
    for (const url of ['/impressum/', '/datenschutz/', '/404.html'])
      expect(byUrl(url)?.index).toBe(false);
  });

  it('hat Meta-Beschreibungen in einer für Suchmaschinen sinnvollen Länge', () => {
    for (const p of PAGES) {
      expect(p.description.length, p.url).toBeGreaterThan(0);
      expect(p.description.length, p.url).toBeLessThanOrEqual(160);
    }
  });

  it('nennt bei SEPA die deutschen Banken (plan.md S10)', () => {
    expect(byUrl('/sepa-sammelueberweisung/')?.description).toContain('deutschen Banken');
  });

  it('setzt Pro bis zur Verfügbarkeit auf noindex (freigegeben 25.09.2026)', () => {
    expect(byUrl('/pro/')?.index).toBe(false);
  });
});
