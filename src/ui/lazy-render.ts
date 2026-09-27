/**
 * Zeichnet Vorschaubilder erst, wenn sie in die Nähe des sichtbaren Bereichs kommen, und immer
 * nur eines zur Zeit (plan-phase2.md Werkzeug 2: viele Seiten, wenig Speicher).
 *
 * Erweiterung für die PDF-Werkstatt (plan-phase3.md 4.2 und Abschnitt 8): Mit `release` bleibt
 * ein Element beobachtet. Liegen mehr als `limit` Bilder vor, werden die am längsten nicht mehr
 * sichtbaren freigegeben (Canvas auf 0 × 0, Pflicht in iOS Safari) und beim Zurückscrollen neu
 * gezeichnet. Aufträge für Elemente, die vor dem Zeichnen wieder aus dem Bild gescrollt sind,
 * entfallen. Mit `root` misst ein eigener Beobachter gegen einen scrollenden Container, damit
 * der Vorlauf (`rootMargin`) auch innerhalb scrollender Spalten wirkt.
 */

interface Entry {
  el: Element;
  job: () => Promise<void>;
  release: (() => void) | undefined;
  root: Element | null;
  visible: boolean;
  state: 'idle' | 'queued' | 'rendered';
}

export interface LazyOptions {
  /** Höchstzahl gezeichneter Bilder mit `release`; ohne Angabe unbegrenzt */
  limit?: number;
  rootMargin?: string;
}

export class LazyRenderer {
  private readonly entries = new Map<Element, Entry>();
  private readonly observers = new Map<Element | null, IntersectionObserver>();
  private readonly queue: Entry[] = [];
  /** Gezeichnete Elemente mit `release`, älteste Sichtung zuerst */
  private readonly rendered = new Set<Element>();
  private running = false;
  private generation = 0;

  constructor(private readonly options: LazyOptions = {}) {}

  /** Anzahl gerade gehaltener Bilder mit `release` (Leistungsmessung) */
  get renderedCount(): number {
    return this.rendered.size;
  }

  /**
   * `job` läuft, sobald `el` sichtbar wird; ein neuer Auftrag für dasselbe Element ersetzt ihn
   * (z. B. nach dem Drehen). Ohne `release` wird jeder Auftrag nur einmal ausgeführt.
   */
  observe(
    el: Element,
    job: () => Promise<void>,
    { release, root = null }: { release?: () => void; root?: Element | null } = {},
  ): void {
    const previous = this.entries.get(el);
    this.rendered.delete(el);
    const entry: Entry = {
      el,
      job,
      release,
      root,
      visible: previous?.visible ?? false,
      state: 'idle',
    };
    this.entries.set(el, entry);
    if (previous && previous.root !== root) this.observerFor(previous.root).unobserve(el);
    const observer = this.observerFor(root);
    // Neu beobachten liefert gleich den aktuellen Stand; ist das Element schon als sichtbar
    // bekannt, kommt der neue Auftrag sofort in die Warteschlange.
    observer.unobserve(el);
    observer.observe(el);
    if (entry.visible && release) this.enqueue(entry);
  }

  /** Element nicht mehr beobachten (z. B. entfernt). Freigeben ist Sache des Aufrufers. */
  unobserve(el: Element): void {
    const entry = this.entries.get(el);
    if (!entry) return;
    this.entries.delete(el);
    this.rendered.delete(el);
    this.observerFor(entry.root).unobserve(el);
  }

  clear(): void {
    this.generation++;
    for (const observer of this.observers.values()) observer.disconnect();
    this.observers.clear();
    this.entries.clear();
    this.rendered.clear();
    this.queue.length = 0;
  }

  private observerFor(root: Element | null): IntersectionObserver {
    let observer = this.observers.get(root);
    if (!observer) {
      observer = new IntersectionObserver((records) => this.onIntersect(records), {
        root,
        rootMargin: this.options.rootMargin ?? '400px',
      });
      this.observers.set(root, observer);
    }
    return observer;
  }

  private onIntersect(records: IntersectionObserverEntry[]): void {
    for (const record of records) {
      const entry = this.entries.get(record.target);
      if (!entry) continue;
      entry.visible = record.isIntersecting;
      if (!entry.visible) continue;
      if (!entry.release) {
        // Einmalige Aufträge wie bisher: nicht weiter beobachten.
        this.observerFor(entry.root).unobserve(entry.el);
        this.entries.delete(entry.el);
        this.enqueue(entry);
        continue;
      }
      if (entry.state === 'rendered') {
        // Wieder gesehen: ans Ende der Freigabe-Reihenfolge
        this.rendered.delete(entry.el);
        this.rendered.add(entry.el);
      } else {
        this.enqueue(entry);
      }
    }
  }

  private enqueue(entry: Entry): void {
    if (entry.state === 'queued') return;
    entry.state = 'queued';
    this.queue.push(entry);
    if (!this.running) void this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    const generation = this.generation;
    for (let entry = this.queue.shift(); entry; entry = this.queue.shift()) {
      if (entry.release && this.entries.get(entry.el) !== entry) continue;
      if (entry.release && !entry.visible) {
        entry.state = 'idle';
        continue;
      }
      try {
        await entry.job();
      } catch {
        // Die Aufgabe zeigt ihren Fehler selbst an; die übrigen Vorschauen laufen weiter.
      }
      if (generation !== this.generation) break;
      if (entry.release && this.entries.get(entry.el) === entry) {
        entry.state = 'rendered';
        this.rendered.add(entry.el);
        this.trim();
      }
    }
    this.running = false;
    // clear() während eines Auftrags: seitdem angenommene Aufträge abarbeiten
    if (this.queue.length > 0) void this.run();
  }

  /** Über der Grenze: nicht sichtbare Bilder freigeben, am längsten nicht gesehene zuerst */
  private trim(): void {
    const { limit } = this.options;
    if (limit === undefined) return;
    for (const el of this.rendered) {
      if (this.rendered.size <= limit) return;
      const entry = this.entries.get(el);
      if (entry?.visible) continue;
      this.rendered.delete(el);
      if (!entry) continue;
      entry.state = 'idle';
      entry.release?.();
    }
  }
}
