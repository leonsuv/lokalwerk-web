import { describe, expect, it } from 'vitest';
import { decodeText } from '../../../src/core/csv/decode.ts';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('decodeText', () => {
  it('liest UTF-8 ohne BOM', () => {
    expect(decodeText(utf8('Empfänger;Betrag'))).toEqual({
      text: 'Empfänger;Betrag',
      encoding: 'utf-8',
    });
  });

  it('entfernt das UTF-8-BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Name')]);
    expect(decodeText(bytes)).toEqual({ text: 'Name', encoding: 'utf-8' });
  });

  it('liest Windows-1252 (Excel unter Windows) mit Umlauten und Euro', () => {
    // „Gärtnerei Grün 12,50 €“ in Windows-1252: ä=E4, ü=FC, €=80
    const bytes = new Uint8Array([
      0x47, 0xe4, 0x72, 0x74, 0x6e, 0x65, 0x72, 0x65, 0x69, 0x20, 0x47, 0x72, 0xfc, 0x6e, 0x20,
      0x31, 0x32, 0x2c, 0x35, 0x30, 0x20, 0x80,
    ]);
    expect(decodeText(bytes)).toEqual({ text: 'Gärtnerei Grün 12,50 €', encoding: 'windows-1252' });
  });

  it('liest UTF-16 LE mit BOM (Excel „Unicode-Text“)', () => {
    const body = Buffer.from('Name\tBetrag\nMüller\t12,50', 'utf16le');
    expect(decodeText(new Uint8Array([0xff, 0xfe, ...body]))).toEqual({
      text: 'Name\tBetrag\nMüller\t12,50',
      encoding: 'utf-16le',
    });
  });

  it('liest UTF-16 BE mit BOM', () => {
    const le = Buffer.from('Größe', 'utf16le');
    const be = Buffer.from(le).swap16();
    expect(decodeText(new Uint8Array([0xfe, 0xff, ...be]))).toEqual({
      text: 'Größe',
      encoding: 'utf-16be',
    });
  });

  it('liefert für eine leere Datei leeren Text', () => {
    expect(decodeText(new Uint8Array())).toEqual({ text: '', encoding: 'utf-8' });
  });
});
