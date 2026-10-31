import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '../../build/site-url.ts';

describe('resolveSiteUrl', () => {
  it('nimmt ohne Variable die Adresse aus dem Register', () => {
    expect(resolveSiteUrl(undefined, 'https://lokalwerk.eu')).toBe('https://lokalwerk.eu');
    expect(resolveSiteUrl('  ', 'https://lokalwerk.eu')).toBe('https://lokalwerk.eu');
  });

  it('nimmt die Adresse aus der Variable', () => {
    expect(resolveSiteUrl('https://test1.azendix.de', 'https://lokalwerk.eu')).toBe(
      'https://test1.azendix.de',
    );
  });

  it('lehnt Pfad, Schrägstrich am Ende und http ab', () => {
    for (const bad of ['https://lokalwerk.eu/', 'https://lokalwerk.eu/de', 'http://lokalwerk.eu']) {
      expect(() => resolveSiteUrl(bad, 'https://lokalwerk.eu')).toThrow('LOKALWERK_SITE_URL');
    }
  });
});
