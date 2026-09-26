/**
 * „Hochladen“ nur verneint (Leon, 26.09.2026): „nicht hochgeladen“, „ohne Upload“ ja, aber nie für
 * die Dateiauswahl im Browser. Geprüft werden alle sichtbaren Texte: HTML-Text der Seiten und
 * Werkzeuge sowie Zeichenketten im Code (src/, build/pages.ts), ohne Kommentare.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

const UPLOAD =
  /hoch\s*(?:ge)?lad\w*|\b(?:lade|lädst|lädt|laden)\b[^.!?<]{0,60}?\bhoch\b|\bupload\w*/gi;
const NEGATION = /\b(?:nicht|ohne|keine?[nmrs]?|weder|nie|nichts)\b|\b0 B\b/i;

/**
 * Ausnahmen mit Begründung: „hochladen“ im Sinn von Einreichen einer erzeugten Datei bei der
 * Bank, nicht für die Dateiauswahl im Browser. Freigegebene Texte der Phase 1; Rückfrage an Leon.
 */
const BANK_UPLOAD = [
  'die du im Onlinebanking hochladen kannst',
  'nach dem Hochladen im Onlinebanking',
  'im Onlinebanking als Sammelüberweisung hochgeladen',
  'bietet den Upload von Überweisungsdateien an',
];

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => ext.test(f))
    .map((f) => join(dir, f));
}

/** Sichtbarer Text einer HTML-Datei: ohne Kommentare, Tags und Attributnamen */
function htmlText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Zeichenketten im TypeScript-Code, ohne Kommentare */
function tsStrings(code: string): string {
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const literals = withoutComments.match(
    /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
  );
  return (literals ?? []).map((l) => l.slice(1, -1)).join(' ¶ ');
}

/** Anfang des Satzes bis zur Fundstelle */
function sentenceBefore(text: string, index: number): string {
  const start = Math.max(
    text.lastIndexOf('.', index - 1),
    text.lastIndexOf('!', index - 1),
    text.lastIndexOf('?', index - 1),
    text.lastIndexOf('¶', index - 1),
  );
  return text.slice(start + 1, index);
}

export function findUploadWording(text: string): string[] {
  const problems: string[] = [];
  for (const m of text.matchAll(UPLOAD)) {
    const context = text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40);
    if (BANK_UPLOAD.some((b) => context.includes(b))) continue;
    if (NEGATION.test(sentenceBefore(text, m.index))) continue;
    problems.push(context.trim());
  }
  return problems;
}

describe('„hochladen“ nur verneint', () => {
  it('erkennt Verneinung und findet Aufforderungen zum Hochladen', () => {
    expect(findUploadWording('Die Datei wird nicht hochgeladen.')).toEqual([]);
    expect(findUploadWording('Kostenlos, ohne Upload deiner Dateien.')).toEqual([]);
    expect(findUploadWording('0 B hochgeladen')).toEqual([]);
    expect(findUploadWording('Weder hochgeladen noch gespeichert.')).toEqual([]);
    expect(findUploadWording('Bild hochladen')).toHaveLength(1);
    expect(findUploadWording('Lade ein Foto davon hoch.')).toHaveLength(1);
    expect(findUploadWording('Du lädst dein Bild hoch.')).toHaveLength(1);
    expect(findUploadWording('Datei-Upload')).toHaveLength(1);
  });

  it('gilt für alle Seiten, Werkzeuge, Meldungen und Titel', () => {
    const problems: string[] = [];
    for (const file of [...files('pages', /\.html$/), ...files('src', /\.html$/)]) {
      for (const p of findUploadWording(htmlText(readFileSync(join(root, file), 'utf8')))) {
        problems.push(`${file}: ${p}`);
      }
    }
    for (const file of [...files('src', /\.ts$/), 'build/pages.ts']) {
      for (const p of findUploadWording(tsStrings(readFileSync(join(root, file), 'utf8')))) {
        problems.push(`${file}: ${p}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
