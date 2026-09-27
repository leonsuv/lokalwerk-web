import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  loadPdfjs,
  missingPdfjsApis,
  pdfErrorCode,
  PdfjsUnsupportedError,
  UNSUPPORTED_PREVIEW,
  UNSUPPORTED_TOOL,
} from '../../src/ui/pdfjs/support.ts';

type PdfJs = typeof import('../../src/ui/pdfjs/pdfjs.ts');

/** globalThis ohne die genannten APIs, wie in einem älteren Browser */
function without(...names: string[]): typeof globalThis {
  const promise = names.includes('Promise.withResolvers')
    ? Object.assign(function P() {}, { withResolvers: undefined })
    : Promise;
  const object = names.includes('Object.hasOwn') ? { ...Object, hasOwn: undefined } : Object;
  const array = names.includes('Array.prototype.at')
    ? { prototype: { ...Array.prototype, at: undefined } }
    : Array;
  return { Promise: promise, Object: object, Array: array } as unknown as typeof globalThis;
}

describe('Prüfung beim Laden von pdf.js (docs/pdfjs-kompatibilitaet.md 5)', () => {
  it('kennt die APIs, die der Legacy-Build noch voraussetzt', () => {
    expect(missingPdfjsApis()).toEqual([]);
    expect(missingPdfjsApis(without('Promise.withResolvers'))).toEqual(['Promise.withResolvers']);
    expect(
      missingPdfjsApis(without('Promise.withResolvers', 'Object.hasOwn', 'Array.prototype.at')),
    ).toEqual(['Promise.withResolvers', 'Object.hasOwn', 'Array.prototype.at']);
  });

  it('lädt pdf.js gar nicht erst, wenn eine API fehlt', async () => {
    const importer = vi.fn(() => Promise.resolve({} as PdfJs));
    const loaded = loadPdfjs(importer, without('Object.hasOwn'));
    await expect(loaded).rejects.toBeInstanceOf(PdfjsUnsupportedError);
    await expect(loaded).rejects.toMatchObject({ missing: ['Object.hasOwn'] });
    expect(importer).not.toHaveBeenCalled();
  });

  it('wertet einen Syntaxfehler beim Laden als zu alten Browser, andere Fehler nicht', async () => {
    const syntax = loadPdfjs(() => Promise.reject(new SyntaxError('Unexpected token #')));
    await expect(syntax).rejects.toBeInstanceOf(PdfjsUnsupportedError);
    const offline = new TypeError('Failed to fetch dynamically imported module');
    await expect(loadPdfjs(() => Promise.reject(offline))).rejects.toBe(offline);
    const ok = {} as PdfJs;
    await expect(loadPdfjs(() => Promise.resolve(ok))).resolves.toBe(ok);
  });

  it('meldet einen frühen Fehler nicht als unbehandelt', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    // Absichtlich nicht abgewartet: So legen die Werkzeuge das Laden beim Seitenaufruf an.
    void loadPdfjs(undefined, without('Array.prototype.at'));
    await new Promise((r) => setTimeout(r, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('ordnet Fehler beim Öffnen zu: zu alter Browser ist nie „beschädigt“', () => {
    expect(pdfErrorCode(new PdfjsUnsupportedError(['Object.hasOwn']))).toBe('unsupported');
    const openError = (code: string) =>
      Object.assign(new Error(code), { name: 'PdfOpenError', code });
    expect(pdfErrorCode(openError('unsupported'))).toBe('unsupported');
    expect(pdfErrorCode(openError('encrypted'))).toBe('encrypted');
    expect(pdfErrorCode(new DOMException('weg', 'NotReadableError'))).toBe('unreadable');
    expect(pdfErrorCode(new TypeError('irgendwas'))).toBe('damaged');
  });

  it('Texte wie freigegeben (Leon, 27.09.2026)', () => {
    expect(UNSUPPORTED_PREVIEW).toBe(
      'Dein Browser ist zu alt für die Vorschau. Aktualisiere ihn und lade die Seite neu.',
    );
    expect(UNSUPPORTED_TOOL).toBe(
      'Dein Browser ist zu alt für dieses Werkzeug. Aktualisiere ihn und lade die Seite neu.',
    );
  });
});

describe('Werkzeuge mit pdf.js', () => {
  const tools = fileURLToPath(new URL('../../src/tools', import.meta.url));
  const sources = readdirSync(tools, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(tools, f), 'utf8') }));

  it('laden pdf.js nur über loadPdfjs und zeigen den Hinweis', () => {
    const users = sources.filter((s) => /ui\/pdfjs\/support\.ts/.test(s.text));
    expect(users.map((s) => s.file.split('/')[0]).sort()).toEqual([
      'pdf-formular-ausfuellen',
      'pdf-schwaerzen',
      'pdf-seiten-bearbeiten',
      'pdf-unterschreiben',
      'pdf-werkstatt',
      'pdf-zu-bildern',
    ]);
    for (const { file, text } of sources) {
      // Nur Typen dürfen direkt auf pdfjs.ts verweisen (typeof import(…), import type)
      expect(text, file).not.toMatch(/(?<!typeof )import\(\s*'[./]*ui\/pdfjs\/pdfjs\.ts'\s*\)/);
    }
    for (const { file, text } of users)
      expect(text, file).toMatch(/unsupportedNote\('(preview|tool)'/);
  });

  it('Werkzeuge, die pdf.js für das Ergebnis brauchen, melden „zu alt“ statt „beschädigt“', () => {
    for (const tool of ['pdf-schwaerzen', 'pdf-zu-bildern', 'pdf-unterschreiben']) {
      const text = sources.find((s) => s.file === `${tool}/page.ts`)?.text ?? '';
      expect(text, tool).toContain('unsupported: UNSUPPORTED_TOOL');
      expect(text, tool).toContain("unsupportedNote('tool')");
      expect(text, tool).toMatch(/pdfErrorCode\(error\)/);
    }
  });
});
