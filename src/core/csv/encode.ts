/**
 * Text für eine CSV-Datei in Bytes umwandeln.
 * - UTF-8 mit BOM: Excel erkennt daran UTF-8 und zeigt Umlaute richtig an.
 * - UTF-8 ohne BOM: für Programme, die das BOM als Zeichen lesen.
 * - Windows-1252: für ältere Programme. Die Zuordnung kommt aus dem Decoder des Browsers
 *   (WHATWG Encoding Standard), nicht aus einer eigenen Tabelle. Zeichen, die es dort nicht
 *   gibt, werden gemeldet statt ersetzt.
 */

export type OutputEncoding = 'utf-8-bom' | 'utf-8' | 'windows-1252';

export type EncodeResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; code: 'unsupported'; chars: string[]; line: number };

let windows1252: Map<string, number> | undefined;

/** Unicode-Zeichen → Byte, aus dem Decoder für die Bytes 0x80–0xFF */
function windows1252Table(): Map<string, number> {
  if (!windows1252) {
    const decoder = new TextDecoder('windows-1252');
    windows1252 = new Map();
    for (let byte = 0x80; byte <= 0xff; byte++) {
      windows1252.set(decoder.decode(new Uint8Array([byte])), byte);
    }
  }
  return windows1252;
}

const MAX_REPORTED = 10;

export function encodeText(text: string, encoding: OutputEncoding): EncodeResult {
  if (encoding !== 'windows-1252') {
    const body = new TextEncoder().encode(text);
    if (encoding === 'utf-8') return { ok: true, bytes: body };
    const bytes = new Uint8Array(body.length + 3);
    bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(body, 3);
    return { ok: true, bytes };
  }

  const table = windows1252Table();
  const bytes = new Uint8Array(text.length);
  const missing = new Set<string>();
  let firstLine = 0;
  let line = 1;
  let length = 0;
  for (const char of text) {
    if (char === '\n') line++;
    const code = char.codePointAt(0) ?? 0;
    const byte = code < 0x80 ? code : table.get(char);
    if (byte === undefined) {
      if (missing.size < MAX_REPORTED) missing.add(char);
      if (firstLine === 0) firstLine = line;
      continue;
    }
    bytes[length++] = byte;
  }
  if (missing.size > 0)
    return { ok: false, code: 'unsupported', chars: [...missing], line: firstLine };
  return { ok: true, bytes: bytes.subarray(0, length) };
}
