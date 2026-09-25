import { describe, expect, it } from 'vitest';
import { decodeText } from '../../../src/core/csv/decode.ts';
import { encodeText } from '../../../src/core/csv/encode.ts';

const bytesOf = (result: ReturnType<typeof encodeText>) => {
  if (!result.ok) throw new Error('nicht kodierbar');
  return [...result.bytes];
};

describe('encodeText', () => {
  it('schreibt UTF-8 mit und ohne BOM', () => {
    expect(bytesOf(encodeText('ä', 'utf-8-bom'))).toEqual([0xef, 0xbb, 0xbf, 0xc3, 0xa4]);
    expect(bytesOf(encodeText('ä', 'utf-8'))).toEqual([0xc3, 0xa4]);
  });

  it('schreibt Windows-1252 nach dem Decoder des Browsers', () => {
    expect(bytesOf(encodeText('Straße ÄÖÜ äöü €', 'windows-1252'))).toEqual([
      0x53, 0x74, 0x72, 0x61, 0xdf, 0x65, 0x20, 0xc4, 0xd6, 0xdc, 0x20, 0xe4, 0xf6, 0xfc, 0x20,
      0x80,
    ]);
  });

  it('ergibt beim Zurücklesen denselben Text, für alle 256 Zeichen von Windows-1252', () => {
    const all = new TextDecoder('windows-1252').decode(
      new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
    );
    const encoded = encodeText(all, 'windows-1252');
    expect(encoded.ok).toBe(true);
    if (encoded.ok) expect(new TextDecoder('windows-1252').decode(encoded.bytes)).toBe(all);
  });

  it('meldet Zeichen, die es in Windows-1252 nicht gibt, mit der ersten Zeile', () => {
    expect(encodeText('Anna\nŁukasz\nZoë\nŐrs 😀', 'windows-1252')).toEqual({
      ok: false,
      code: 'unsupported',
      chars: ['Ł', 'Ő', '😀'],
      line: 2,
    });
  });

  it('passt zum eigenen CSV-Leser (decodeText)', () => {
    for (const encoding of ['utf-8-bom', 'windows-1252'] as const) {
      const encoded = encodeText('Größe;Preis\r\nÄpfel;1,50 €', encoding);
      if (!encoded.ok) throw new Error('nicht kodierbar');
      expect(decodeText(encoded.bytes).text).toBe('Größe;Preis\r\nÄpfel;1,50 €');
    }
  });
});
