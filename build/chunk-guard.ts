/**
 * Build-Prüfung für die Aufteilung der Skripte (nach dem Fehler vom 25.09.2026: der Build hatte
 * gemeinsame Hilfsmodule in den Seiten-Chunk eines Werkzeugs gelegt, sodass andere Seiten dessen
 * Code und pdf-lib mitluden). Für jede Seite wird geprüft, was sie beim Laden statisch einbindet:
 * - höchstens die page.ts eines einzigen Werkzeugs,
 * - keine schweren Bibliotheken (pdf-lib, SheetJS); die gehören in Worker (AGENTS.md Abschnitt 3),
 * - pdf.js nur dynamisch nachgeladen (src/ui/pdfjs/pdfjs.ts); der Teil im Hauptthread zeichnet
 *   die Seiten, das Lesen der PDF läuft in seinem Worker.
 * Dynamisch nachgeladene Teile (Startseite → Werkzeug) zählen nicht.
 */

import type { Plugin } from 'vite';

export interface ChunkInfo {
  fileName: string;
  isEntry: boolean;
  imports: string[];
  moduleIds: string[];
}

const TOOL_PAGE = /[\\/]src[\\/]tools[\\/]([^\\/]+)[\\/]page\.ts$/;
const MAIN_THREAD_FORBIDDEN = /[\\/]node_modules[\\/](pdf-lib|xlsx)[\\/]/;
const STATIC_FORBIDDEN = /[\\/]node_modules[\\/](pdfjs-dist)[\\/]/;

export function checkChunks(chunks: readonly ChunkInfo[]): string[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const problems: string[] = [];
  for (const entry of chunks.filter((c) => c.isEntry)) {
    const seen = new Set<string>();
    const stack = [entry.fileName];
    const tools = new Set<string>();
    const heavy = new Set<string>();
    const eager = new Set<string>();
    while (stack.length > 0) {
      const name = stack.pop() ?? '';
      if (seen.has(name)) continue;
      seen.add(name);
      const chunk = byName.get(name);
      if (!chunk) continue;
      for (const id of chunk.moduleIds) {
        const tool = TOOL_PAGE.exec(id)?.[1];
        if (tool) tools.add(tool);
        const lib = MAIN_THREAD_FORBIDDEN.exec(id)?.[1];
        if (lib) heavy.add(lib);
        const dynamicOnly = STATIC_FORBIDDEN.exec(id)?.[1];
        if (dynamicOnly) eager.add(dynamicOnly);
      }
      stack.push(...chunk.imports);
    }
    if (tools.size > 1) {
      problems.push(
        `${entry.fileName} lädt Seitencode mehrerer Werkzeuge: ${[...tools].sort().join(', ')}`,
      );
    }
    if (heavy.size > 0) {
      problems.push(
        `${entry.fileName} lädt im Hauptthread: ${[...heavy].sort().join(', ')} (gehört in einen Worker)`,
      );
    }
    if (eager.size > 0) {
      problems.push(
        `${entry.fileName} bindet ${[...eager].sort().join(', ')} statisch ein (nur per import() nachladen)`,
      );
    }
  }
  return problems;
}

/** Nur im Haupt-Build; Worker-Builds haben eigene Bundles. */
export function chunkGuard(): Plugin {
  return {
    name: 'lokalwerk-chunk-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks: ChunkInfo[] = [];
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        chunks.push({
          fileName: output.fileName,
          isEntry: output.isEntry,
          imports: output.imports,
          moduleIds: output.moduleIds,
        });
      }
      const problems = checkChunks(chunks);
      if (problems.length > 0) this.error(`Aufteilung der Skripte:\n  ${problems.join('\n  ')}`);
    },
  };
}
