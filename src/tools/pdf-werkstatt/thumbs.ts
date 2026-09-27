/**
 * Vorschaubilder der PDF-Werkstatt (plan-phase3.md Abschnitt 3 und 8): nur sichtbare Seiten,
 * eine nach der anderen, höchstens THUMB_LIMIT gleichzeitig; nicht sichtbare werden darüber
 * hinaus freigegeben (Canvas auf 0 × 0) und beim Zurückscrollen neu gezeichnet.
 */

import type { PageRef } from '../../core/workshop/model.ts';
import { LazyRenderer } from '../../ui/lazy-render.ts';
import type { SourceFiles } from './sources.ts';
import { NO_PREVIEW } from './texts.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

/** Bei etwa 120 × 170 Pixeln (doppelte Auflösung) rund 30 MB (plan-phase3.md Abschnitt 8) */
export const THUMB_LIMIT = 200;

function clear(paper: HTMLElement): void {
  for (const canvas of paper.querySelectorAll('canvas')) {
    canvas.width = 0;
    canvas.height = 0;
  }
  paper.replaceChildren();
}

export class Thumbs {
  private readonly lazy = new LazyRenderer({ limit: THUMB_LIMIT });
  /** Was ein Papier zeigt oder zeigen soll, damit gleiche Aufträge nicht neu starten */
  private readonly wanted = new WeakMap<HTMLElement, { token: string; root: Element }>();

  constructor(
    private readonly files: SourceFiles,
    private readonly pdfjs: Promise<PdfJs>,
  ) {}

  /** Gerade gehaltene Vorschaubilder (Leistungsmessung) */
  get count(): number {
    return this.lazy.renderedCount;
  }

  /** Vorschau für die Seite auf dem Papier; `root` ist die scrollende Spalte */
  show(paper: HTMLElement, page: PageRef, root: Element): void {
    if (page.kind === 'blank') {
      this.forget(paper);
      return;
    }
    const token = `${page.source}:${page.index}:${page.rotate}`;
    const wanted = this.wanted.get(paper);
    if (wanted?.token === token && wanted.root === root) return;
    this.wanted.set(paper, { token, root });
    const { source, index, rotate } = page;
    this.lazy.observe(
      paper,
      async () => {
        try {
          const [{ pageSize, renderPageAt }, doc] = await Promise.all([
            this.pdfjs,
            this.files.pdf(source),
          ]);
          const size = await pageSize(doc, index + 1, rotate);
          const width = paper.getBoundingClientRect().width || 120;
          const scale = (width * (globalThis.devicePixelRatio || 1)) / size.width;
          const canvas = await renderPageAt(doc, index + 1, { scale, extraRotation: rotate });
          canvas.setAttribute('aria-hidden', 'true');
          if (this.wanted.get(paper)?.token === token) {
            clear(paper);
            paper.append(canvas);
          } else {
            canvas.width = 0;
            canvas.height = 0;
          }
        } catch {
          const err = document.createElement('span');
          err.className = 'err';
          err.textContent = NO_PREVIEW;
          paper.replaceChildren(err);
        }
      },
      { release: () => clear(paper), root },
    );
  }

  forget(paper: HTMLElement): void {
    this.wanted.delete(paper);
    this.lazy.unobserve(paper);
    clear(paper);
  }
}
