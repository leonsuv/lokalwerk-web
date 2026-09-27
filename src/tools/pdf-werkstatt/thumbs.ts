/**
 * Vorschaubilder der PDF-Werkstatt (plan-phase3.md Abschnitt 3 und 8): nur sichtbare Seiten,
 * eine nach der anderen, höchstens THUMB_LIMIT gleichzeitig; nicht sichtbare werden darüber
 * hinaus freigegeben (Canvas auf 0 × 0) und beim Zurückscrollen neu gezeichnet. Stempel und
 * Unterschriften sind eingezeichnet (overlay-canvas.ts), so wie sie gespeichert werden.
 */

import type { PageBox, PageOp, PageRef } from '../../core/workshop/model.ts';
import { LazyRenderer } from '../../ui/lazy-render.ts';
import { drawImagePage } from './image-pages.ts';
import { drawOverlay } from './overlay-canvas.ts';
import type { SourceFiles } from './sources.ts';
import { NO_PREVIEW } from './texts.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

/** Bei etwa 120 × 170 Pixeln (doppelte Auflösung) rund 30 MB (plan-phase3.md Abschnitt 8) */
export const THUMB_LIMIT = 200;

/** Kennung je Liste von Seiten-Operationen: Die Listen sind unveränderlich, neue Liste = neue Kennung */
const opsIds = new WeakMap<readonly PageOp[], number>();
let nextOpsId = 0;

function opsToken(ops: readonly PageOp[] | undefined): string {
  if (!ops?.length) return '';
  let id = opsIds.get(ops);
  if (id === undefined) {
    id = ++nextOpsId;
    opsIds.set(ops, id);
  }
  return `:o${id}`;
}

function blankCanvas(view: PageBox, width: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round((width * view.height) / view.width);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

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

  /**
   * Vorschau für die Seite auf dem Papier; `root` ist die scrollende Spalte, `view` die Größe
   * der angezeigten Seite in Punkt.
   */
  show(
    paper: HTMLElement,
    page: PageRef,
    root: Element,
    kind: 'pdf' | 'image',
    view: PageBox,
  ): void {
    const pixels = () =>
      (paper.getBoundingClientRect().width || 120) * (globalThis.devicePixelRatio || 1);
    const withOverlay = async (canvas: HTMLCanvasElement) => {
      try {
        await drawOverlay(canvas, page, view);
      } catch (error) {
        canvas.width = 0;
        canvas.height = 0;
        throw error;
      }
      return canvas;
    };
    const ops = opsToken(page.ops);
    if (page.kind === 'blank') {
      // Leerseite ohne Operation: das weiße Papier der Kachel genügt
      if (!ops) this.forget(paper);
      else
        this.observe(paper, `blank:${page.rotate}${ops}`, root, () =>
          withOverlay(blankCanvas(view, pixels())),
        );
      return;
    }
    const token = `${page.source}:${page.index}:${page.rotate}${ops}`;
    if (kind === 'image') {
      this.observe(paper, token, root, async () => {
        const bitmap = await this.files.thumbImage(page.source);
        return withOverlay(drawImagePage(bitmap, page.rotate, pixels()));
      });
      return;
    }
    const { source, index, rotate } = page;
    this.observe(paper, token, root, async () => {
      const [{ pageSize, renderPageAt }, doc] = await Promise.all([
        this.pdfjs,
        this.files.pdf(source),
      ]);
      const size = await pageSize(doc, index + 1, rotate);
      const scale = pixels() / size.width;
      return withOverlay(await renderPageAt(doc, index + 1, { scale, extraRotation: rotate }));
    });
  }

  /** Auftrag für das Papier, wenn er sich geändert hat; `draw` liefert das fertige Canvas */
  private observe(
    paper: HTMLElement,
    token: string,
    root: Element,
    draw: () => Promise<HTMLCanvasElement>,
  ): void {
    const wanted = this.wanted.get(paper);
    if (wanted?.token === token && wanted.root === root) return;
    this.wanted.set(paper, { token, root });
    this.lazy.observe(
      paper,
      async () => {
        try {
          const canvas = await draw();
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
