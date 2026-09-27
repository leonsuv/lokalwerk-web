/**
 * Übergabe aus den Einzelwerkzeugen an die PDF-Werkstatt, Einstellung „Versteckte Angaben“
 * (M6, Leon 27.09.2026): aus „PDF-Metadaten entfernen“ ist „Entfernen“ vorausgewählt, bei allen
 * anderen Übergaben „Behalten“; die Einstellung bleibt sichtbar und umstellbar.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportOptionsFor } from '../../src/core/workshop/export-plan.ts';

const src = fileURLToPath(new URL('../../src', import.meta.url));
const read = (path: string) => readFileSync(join(src, path), 'utf8');

describe('Übergabe an die Werkstatt: versteckte Angaben', () => {
  it('„Entfernen“ nur mit stripMetadata, sonst „Behalten“', () => {
    expect(exportOptionsFor({ stripMetadata: true })).toEqual({ strip: true });
    expect(exportOptionsFor({})).toEqual({ strip: false });
    expect(exportOptionsFor()).toEqual({ strip: false });
  });

  it('nur „PDF-Metadaten entfernen“ übergibt „Entfernen“', () => {
    const tools = readdirSync(join(src, 'tools'));
    const callers = tools.filter((t) => {
      try {
        return /workshopLink\(/.test(read(`tools/${t}/page.ts`));
      } catch {
        return false;
      }
    });
    // Alle 12 Werkzeuge mit Knopf „In der PDF-Werkstatt weiterbearbeiten“
    expect(callers).toHaveLength(12);
    const stripping = callers.filter((t) =>
      /stripMetadata:\s*true/.test(read(`tools/${t}/page.ts`)),
    );
    expect(stripping).toEqual(['pdf-metadaten-entfernen']);
  });

  it('die Werkstatt setzt die Einstellung bei jeder Übergabe', () => {
    const page = read('tools/pdf-werkstatt/page.ts');
    const openFiles = page.slice(page.indexOf('export function openFiles('));
    expect(openFiles.slice(0, openFiles.indexOf('\n}'))).toMatch(
      /exporter\.options = exportOptionsFor\(handover\)/,
    );
    // Der Weg vom Knopf bis zur Werkstatt reicht die Übergabe durch
    expect(read('ui/workshop-link.ts')).toMatch(
      /openInWorkshop\(\[\.\.\.files\], pageLayouts, handover\)/,
    );
    expect(read('ui/workshop-switch.ts')).toMatch(/openFiles\(files, layouts, handover\)/);
  });
});
