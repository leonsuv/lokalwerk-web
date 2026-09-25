/**
 * Prüft das Seitenregister beim Build (plan-phase2.md Abschnitt 3.5). Der Build bricht ab,
 * wenn ein Verweis ins Leere geht, ein Symbol fehlt oder Titel und Beschreibungen doppelt sind.
 */

import { CATEGORIES, type PageDef } from './pages.ts';

/** Symbol-IDs aus dem Inhalt von src/partials/icons.svg */
export function iconIds(svg: string): Set<string> {
  return new Set([...svg.matchAll(/<symbol\s+id="([^"]+)"/g)].map((m) => m[1] ?? ''));
}

/** Gibt alle Beanstandungen zurück, leer wenn alles in Ordnung ist. */
export function checkRegistry(pages: readonly PageDef[], icons: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const duplicates = (values: string[], what: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) problems.push(`${what} doppelt: ${value}`);
      seen.add(value);
    }
  };
  duplicates(
    pages.map((p) => p.file),
    'Datei',
  );
  duplicates(
    pages.map((p) => p.url),
    'URL',
  );
  duplicates(
    pages.map((p) => p.title),
    'Titel',
  );
  duplicates(
    pages.filter((p) => p.index).map((p) => p.description),
    'Meta-Beschreibung',
  );

  const tools = pages.flatMap((p) => (p.tool ? [{ page: p, tool: p.tool }] : []));
  duplicates(
    tools.map((t) => t.tool.name),
    'Werkzeugname',
  );
  const ids = new Set(tools.map((t) => t.tool.id));
  for (const { page, tool } of tools) {
    const where = `${page.url} (${tool.id})`;
    if (page.url !== `/${tool.id}/`) problems.push(`${where}: id passt nicht zur URL`);
    if (!page.index) problems.push(`${where}: Werkzeugseiten müssen indexiert werden`);
    if (!CATEGORIES.some((c) => c.id === tool.category))
      problems.push(`${where}: unbekannte Kategorie ${tool.category}`);
    if (!icons.has(tool.icon)) problems.push(`${where}: Symbol ${tool.icon} fehlt in icons.svg`);
    if (tool.short.trim() === '') problems.push(`${where}: Kurztext fehlt`);
    if (tool.related.length === 0) problems.push(`${where}: keine verwandten Werkzeuge`);
    for (const id of tool.related) {
      if (id === tool.id) problems.push(`${where}: verweist auf sich selbst`);
      else if (!ids.has(id)) problems.push(`${where}: verwandtes Werkzeug ${id} gibt es nicht`);
    }
    duplicates([...tool.related], `${where}: Verweis`);
  }
  return problems;
}
