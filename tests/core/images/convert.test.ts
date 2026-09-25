import { describe, expect, it } from 'vitest';
import { convertedName, hasQuality } from '../../../src/core/images/convert.ts';

describe('convertedName', () => {
  it.each([
    ['Urlaub.webp', 'image/jpeg', 'Urlaub.jpg'],
    ['scan.PNG', 'image/webp', 'scan.webp'],
    ['foto.jpg', 'image/jpeg', 'foto.jpg'],
    ['ohne endung', 'image/png', 'ohne endung.png'],
    ['.webp', 'image/png', 'bild.png'],
    ['a.b.c.gif', 'image/png', 'a.b.c.png'],
  ] as const)('%s als %s → %s', (name, type, out) => {
    expect(convertedName(name, type)).toBe(out);
  });
});

describe('hasQuality', () => {
  it('nur JPEG und WebP haben eine Qualitätsstufe', () => {
    expect(hasQuality('image/jpeg')).toBe(true);
    expect(hasQuality('image/webp')).toBe(true);
    expect(hasQuality('image/png')).toBe(false);
  });
});
