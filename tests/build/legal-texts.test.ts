/**
 * Rechtstexte werden nicht umgeschrieben, sondern nur auf Anweisung von Leon eingebaut
 * (AGENTS.md Abschnitt 9). Der Datenschutzhinweis folgt azendix.de ohne Umami
 * (Anweisung Leon, 31.10.2026). Lokalwerk ist ein privates Hobbyprojekt ohne Impressum.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = (p: string) => new URL(`../../${p}`, import.meta.url);
const read = (p: string) => readFileSync(path(p), 'utf8');

describe('Datenschutzhinweis', () => {
  const html = read('pages/datenschutz/index.html');

  it('nennt Verantwortlichen und Kontakt', () => {
    expect(html).toContain('Leon Suvorkov');
    expect(html).toContain('mailto:support@azendix.de');
  });

  it('enthält keine Entwurfsmarkierungen mehr', () => {
    expect(html).not.toContain('<mark>');
    expect(html).not.toContain('class="draft"');
  });

  it('erwähnt weder Pro, Zahlungsanbieter noch Analyse', () => {
    expect(html).not.toMatch(/\bPro\b|Paddle|Umami|kontakt@lokalwerk\.eu/);
  });
});

describe('Impressum', () => {
  it('gibt es nicht', () => {
    expect(existsSync(path('pages/impressum/index.html'))).toBe(false);
  });
});
