/**
 * Werkzeugseite „PDF reparieren“. Den gemeinsamen Ablauf (Datei, Prüfung, Speichern) übernimmt
 * src/ui/pdf-tool.ts, die Reparatur selbst läuft im Worker (core/pdf/repair.ts). Die Seite zeigt
 * die Seiten vorher und nachher und nennt die Seiten, die nicht übernommen werden konnten.
 * Nichts wird gespeichert (AGENTS.md Regel 5).
 */

import { $ } from '../../ui/dom.ts';
import { mountPdfTool, type PdfToolOutput } from '../../ui/pdf-tool.ts';
import type { RepairOptions } from './repair.worker.ts';

const MESSAGES: Record<string, string> = {
  'nothing-readable':
    'In dieser Datei ist keine Seite lesbar. Eine Reparatur ist hier nicht möglich. Erzeuge die PDF im Ursprungsprogramm neu.',
};

const note = $('#rep-note');

/** „Seite 2“, „Seite 2 und 5“, „Seiten 2, 3 und 5“ */
function pageList(pages: number[]): string {
  const shown = pages.slice(0, 20).map(String);
  const more = pages.length > 20 ? ' und weitere' : '';
  if (shown.length === 1) return `Seite ${shown[0]}`;
  const head = shown.slice(0, -1).join(', ');
  return `Seiten ${head} und ${shown[shown.length - 1]}${more}`;
}

function setNote(output: PdfToolOutput): void {
  const lost = output.lost ?? [];
  const missing = output.missing ?? 0;
  const parts: string[] = [];
  if (lost.length > 0) {
    parts.push(
      `${pageList(lost)} ${lost.length === 1 ? 'ist' : 'sind'} nicht lesbar und fehlen im Ergebnis.`,
    );
  }
  if (missing > 0) {
    parts.push(
      `Laut Seitenzahl der Datei fehlen ${missing} ${missing === 1 ? 'Seite' : 'Seiten'} ganz. Sie lassen sich nicht wiederfinden.`,
    );
  }
  note.hidden = parts.length === 0;
  note.textContent = parts.join(' ');
}

const tool = mountPdfTool<RepairOptions>({
  prefix: 'rep',
  worker: new Worker(new URL('./repair.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'PDF wird repariert …',
  options: () => ({}),
  suffix: '-repariert',
  messages: MESSAGES,
  onFile: (pages) => {
    // null heißt beim Auswählen „wird geprüft“ und beim Zurücksetzen, und zugleich „nicht lesbar“.
    $('#rep-before').textContent = pages === null ? '–' : String(pages);
    $('#rep-after').textContent = '–';
    note.hidden = true;
    note.textContent = '';
  },
  done: (output) => {
    $('#rep-after').textContent = String(output.pages ?? 0);
    setNote(output);
    const lost = output.lost?.length ?? 0;
    const missing = output.missing ?? 0;
    return lost === 0 && missing === 0
      ? 'Fertig: Die reparierte PDF ist gespeichert.'
      : 'Fertig: Die reparierte PDF ist gespeichert. Nicht alle Seiten konnten übernommen werden.';
  },
});

export const { openFiles } = tool;
