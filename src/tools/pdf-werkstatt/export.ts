/**
 * Export der PDF-Werkstatt (plan-phase3.md Abschnitt 9): ein Dokument, die Auswahl als neue PDF
 * oder alle Dokumente als ZIP. Der Worker bekommt nur Seitenverweise (export-plan.ts) und setzt
 * die Dateien mit assemble.ts zusammen. Unveränderte Dokumente kommen als Originaldatei (W12),
 * gleiche Namen im ZIP werden mit „(2)“ unterschieden (W11).
 */

import type { AssembleDoc } from '../../core/pdf/assemble.ts';
import { exportPlan, selectionPlan } from '../../core/workshop/export-plan.ts';
import {
  indexPages,
  unchangedSource,
  type Doc,
  type DocId,
  type PageKey,
  type Source,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import type { Selection } from '../../core/workshop/selection.ts';
import { saveBlob } from '../../ui/download.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { WorkerClient } from '../../ui/worker-protocol.ts';
import { zipBlobs } from '../../ui/zip.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';
import type { ExportedFile, ExportProgress, WorkshopRequest } from './workshop.worker.ts';

/** Dokument, das „… als PDF speichern“ meint: das mit dem Fokus, sonst das erste mit Seiten */
export function currentDoc(state: WorkshopState, selection: Selection): Doc | undefined {
  const focused = selection.focus ? indexPages(state).get(selection.focus)?.doc : undefined;
  if (focused && focused.pages.length > 0) return focused;
  return state.docs.find((d) => d.pages.length > 0);
}

/** Quellen mit Formular, Lesezeichen oder Signatur in Dokumenten, die neu zusammengesetzt werden */
export function lossSources(state: WorkshopState, docs: readonly Doc[]): Source[] {
  const found = new Map<string, Source>();
  for (const doc of docs) {
    if (unchangedSource(state, doc)) continue;
    for (const page of doc.pages) {
      const source = page.kind === 'source' ? state.sources.get(page.source) : undefined;
      if (!source) continue;
      const { form, xfa, outline, signed } = source.facts;
      if (form || xfa || outline || signed) found.set(source.id, source);
    }
  }
  return [...found.values()];
}

export class Exporter {
  private running = false;

  constructor(
    private readonly store: WorkshopStore,
    private readonly client: WorkerClient<WorkshopRequest>,
    private readonly ui: {
      status(text: string): void;
      busy(running: boolean): void;
      done(message: string): void;
      failed(error: unknown): void;
    },
  ) {}

  get busy(): boolean {
    return this.running;
  }

  /** Ein Dokument als PDF */
  async doc(id: DocId): Promise<void> {
    await this.run(exportPlan(this.store.state, [id]), false, [id]);
  }

  /** Alle Dokumente mit Seiten als ZIP */
  async all(): Promise<void> {
    const ids = this.store.state.docs.map((d) => d.id);
    await this.run(exportPlan(this.store.state, ids), true, ids);
  }

  /** Auswahl als neue PDF */
  async selection(keys: readonly PageKey[]): Promise<void> {
    const plan = selectionPlan(this.store.state, keys, t.SELECTION_NAME);
    if (plan) await this.run([plan], false, []);
  }

  private async run(plan: AssembleDoc[], zip: boolean, docIds: readonly DocId[]): Promise<void> {
    if (this.running || plan.length === 0) return;
    const state = this.store.state;
    this.running = true;
    this.ui.busy(true);
    this.ui.status(t.exporting(0, 0));
    try {
      const files = await this.client.request<ExportedFile[]>(
        { type: 'export', docs: plan },
        (progress) => {
          const { done, total } = progress as ExportProgress;
          this.ui.status(t.exporting(done, total));
        },
      );
      const blobs = files.map((f) => ({
        name: f.name,
        blob: new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      }));
      const [single] = blobs;
      if (zip || blobs.length > 1) saveBlob(t.ZIP_NAME, await zipBlobs(blobs));
      else if (single) saveBlob(single.name, single.blob);
      // Plakette: Größe der beteiligten Originaldateien, wie in den anderen Werkzeugen
      const used = new Set(
        plan.flatMap((d) => d.pages.flatMap((p) => (p.kind === 'source' ? [p.source] : []))),
      );
      countLocalBytes([...used].reduce((sum, id) => sum + (state.sources.get(id)?.size ?? 0), 0));
      // Warnung beim Verlassen erst aus, wenn alle Dokumente mit Seiten gespeichert sind
      const all = state.docs.filter((d) => d.pages.length > 0).every((d) => docIds.includes(d.id));
      if (all && this.store.state === state) this.store.markSaved();
      const unchanged = files.filter((f) => f.unchanged).length;
      this.ui.done(
        t.exportDone(
          files.map((f) => f.name),
          unchanged,
          zip || files.length > 1,
        ),
      );
    } catch (error) {
      this.ui.failed(error);
    } finally {
      this.running = false;
      this.ui.status('');
      this.ui.busy(false);
    }
  }
}
