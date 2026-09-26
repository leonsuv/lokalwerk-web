import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOOL_PAGES } from '../../build/pages.ts';

// Als Text gelesen: Ein Import zöge über die dynamischen Importe die Browser-Typen der
// Werkzeugseiten in die Node-Typprüfung.
const source = readFileSync(new URL('../../src/tools/home/loaders.ts', import.meta.url), 'utf8');
// Schlüssel ohne Bindestrich schreibt Prettier ohne Anführungszeichen
const keys = [...source.matchAll(/^ {2}'?([\w-]+)'?: \{$/gm)].map((m) => m[1]);

describe('Startseite: Werkzeuge für die Ablage', () => {
  it('hat für genau die Werkzeuge mit Dateiart im Register einen Lader', () => {
    const accepting = TOOL_PAGES.filter((p) => p.tool.accepts).map((p) => p.tool.id);
    expect(keys.sort()).toEqual(accepting.sort());
  });

  it('lädt je Werkzeug die eigene main.html und page.ts', () => {
    for (const id of keys) {
      expect(source).toContain(`import('../${id}/main.html?raw')`);
      expect(source).toContain(`import('../${id}/page.ts')`);
    }
  });
});
