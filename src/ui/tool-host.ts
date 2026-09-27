/**
 * Schnittstelle zwischen der PDF-Werkstatt und einem eingebetteten Werkzeug (plan-phase3.md
 * 7.1, Schritt 2.1). Die Werkstatt stellt einen Bereich und das betroffene Dokument bereit, das
 * Werkzeug setzt dort seine Bedienung ein (dieselben Felder und Texte wie auf seiner Seite) und
 * gibt statt „Speichern“ ein Ergebnis zurück.
 *
 * Das Ergebnis ist je Werkzeug verschieden: Seitenzahlen liefern eine Einstellung, die erst
 * beim Export angewendet wird (Dokument-Operation). Werkzeuge, die Seiten neu erzeugen
 * („Einbacken“, Schritt 2.3), bekommen von der Werkstatt Funktionen zum Rastern oder Ausfüllen
 * (die Bytes bleiben im Worker der Werkstatt) und liefern die neue Quelle als Ergebnis.
 */

export interface ToolTarget {
  /** Name des Dokuments, für Überschrift und Ansagen */
  name: string;
  /** Seitenzahl in der aktuellen Reihenfolge */
  pages: number;
}

export interface ToolHost<Result> {
  /** Bereich, in den das Werkzeug seine Bedienung setzt; beim Schließen geleert */
  readonly root: HTMLElement;
  readonly target: ToolTarget;
  /** Vorhandenes Ergebnis zum Bearbeiten, z. B. schon gesetzte Seitenzahlen */
  readonly current: Result | null;
  /** Ergebnis übernehmen; `null` entfernt ein vorhandenes. Schließt das Werkzeug. */
  apply(result: Result | null): void;
  /** Ohne Änderung schließen */
  cancel(): void;
}

export interface EmbeddedTool {
  /** Fokus auf das erste Bedienelement */
  focus(): void;
  /** Beim Schließen: z. B. blob:-Adressen freigeben */
  dispose?(): void;
}

export type MountTool<Result> = (host: ToolHost<Result>) => EmbeddedTool;
