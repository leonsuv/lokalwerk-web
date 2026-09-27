import {
  counterIds,
  EMPTY_STATE,
  NO_FACTS,
  type IdSource,
  type PageBox,
  type PageKey,
  type Source,
  type WorkshopState,
} from '../../../src/core/workshop/model.ts';
import { addSources, type Command } from '../../../src/core/workshop/commands.ts';

export const LETTER: PageBox = { width: 612, height: 792 };

export function pdfSource(id: string, pages: number, name = `${id}.pdf`, box = LETTER): Source {
  return {
    id,
    kind: 'pdf',
    name,
    size: pages * 1000,
    pages: Array.from({ length: pages }, () => ({ box, rotate: 0 })),
    facts: NO_FACTS,
  };
}

export function imageSource(id: string, name = `${id}.jpg`): Source {
  return {
    id,
    kind: 'image',
    name,
    size: 5000,
    pages: [{ box: { width: 595, height: 842 }, rotate: 0 }],
    facts: NO_FACTS,
  };
}

export interface Bench {
  state: WorkshopState;
  ids: IdSource;
  run(command: Command): WorkshopState;
}

/** Zustand mit je einem Dokument pro Quelle; `run` führt Befehle nacheinander aus */
export function bench(...sources: Source[]): Bench {
  const ids = counterIds();
  const b: Bench = {
    state: EMPTY_STATE,
    ids,
    run(command) {
      b.state = command.apply(b.state, ids).state;
      return b.state;
    },
  };
  if (sources.length > 0) b.run(addSources(sources));
  return b;
}

/** Kurzform eines Dokuments: „a1“ = Quelle a, Seite 1; „a1r90“ gedreht; „leer“ für Leerseiten */
export function describeDocs(state: WorkshopState): Record<string, string[]> {
  return Object.fromEntries(
    state.docs.map((d) => [
      d.name,
      d.pages.map((p) => {
        const base = p.kind === 'source' ? `${p.source}${p.index + 1}` : 'leer';
        return p.rotate ? `${base}r${p.rotate}` : base;
      }),
    ]),
  );
}

export function keysOf(state: WorkshopState, doc: number, ...pages: number[]): PageKey[] {
  const d = state.docs[doc];
  if (!d) throw new Error(`Dokument ${doc} fehlt`);
  return pages.map((i) => {
    const p = d.pages[i];
    if (!p) throw new Error(`Seite ${i} fehlt`);
    return p.key;
  });
}

/** Zufall mit festem Startwert (mulberry32), damit Tests wiederholbar sind */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
