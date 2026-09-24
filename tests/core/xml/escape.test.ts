import { describe, expect, it } from 'vitest';
import { escapeXml } from '../../../src/core/xml/escape.ts';

describe('escapeXml', () => {
  it('maskiert die fünf XML-Sonderzeichen', () => {
    expect(escapeXml(`Grün & Söhne <"Test"> 's`)).toBe(
      'Grün &amp; Söhne &lt;&quot;Test&quot;&gt; &apos;s',
    );
  });

  it('lässt normalen Text unverändert', () => {
    expect(escapeXml('Rechnung 2026-117')).toBe('Rechnung 2026-117');
  });

  it('maskiert nicht doppelt', () => {
    expect(escapeXml('&amp;')).toBe('&amp;amp;');
  });
});
