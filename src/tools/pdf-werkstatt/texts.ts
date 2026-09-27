/**
 * Texte der PDF-Werkstatt an einer Stelle (AGENTS.md Abschnitt 7). Entwurf zur Freigabe bei
 * Anhaltepunkt B (plan-phase3.md); die Befehlsnamen stehen in src/core/workshop/commands.ts.
 */

import { formatBytes } from '../../core/format/bytes.ts';

export const pages = (n: number): string => `${n} ${n === 1 ? 'Seite' : 'Seiten'}`;

export const ERRORS: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory':
    'Zu wenig Arbeitsspeicher für diese Datei. Schließe andere Dokumente oder lade die Seite neu.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'worker-failed': 'Die Werkstatt konnte nicht starten. Lade die Seite neu.',
};

export const FALLBACK_ERROR =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

export const fileError = (name: string, message: string): string => `${name}: ${message}`;

export const NOT_SUPPORTED = (names: string[]): string =>
  names.length === 1
    ? `${names[0] ?? ''} wurde nicht übernommen: Die Werkstatt öffnet PDFs.`
    : `${names.length} Dateien wurden nicht übernommen: Die Werkstatt öffnet PDFs.`;

export const loading = (done: number, total: number): string =>
  total === 1 ? 'Datei wird geöffnet …' : `Dateien werden geöffnet: ${done} von ${total} …`;

export const NO_PREVIEW = 'Keine Vorschau möglich';

export const EMPTY_DOC = 'Noch keine Seiten';

export const memoryHint = (bytes: number): string =>
  `Die geöffneten Dateien sind zusammen ${formatBytes(bytes)} groß. Bei so viel Daten kann der Arbeitsspeicher des Browsers knapp werden; schließe Dokumente, die du nicht mehr brauchst.`;

export interface PageDescription {
  position: number;
  count: number;
  /** Dateiname und Seite der Quelle, oder null für eine leere Seite */
  source: { name: string; page: number | null } | null;
  rotate: number;
}

/** Beschriftung einer Seite für Screenreader (plan-phase3.md 6.4) */
export function pageLabel(d: PageDescription): string {
  const from = d.source
    ? d.source.page === null
      ? `aus ${d.source.name}`
      : `aus ${d.source.name} Seite ${d.source.page}`
    : 'leere Seite';
  const turned = d.rotate ? `, gedreht um ${d.rotate} Grad` : '';
  return `Seite ${d.position} von ${d.count}, ${from}${turned}`;
}

export const docPagesLabel = (name: string): string => `Seiten von ${name}`;
export const DOC_NAME_LABEL = 'Name des Dokuments';
export const LEAVE_WARNING = 'Die Werkstatt hat Änderungen, die noch nicht gespeichert sind.';
