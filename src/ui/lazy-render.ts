/**
 * Zeichnet Vorschaubilder erst, wenn sie in die Nähe des sichtbaren Bereichs kommen, und immer
 * nur eines zur Zeit (plan-phase2.md Werkzeug 2: viele Seiten, wenig Speicher).
 */

export class LazyRenderer {
  private readonly jobs = new Map<Element, () => Promise<void>>();
  private readonly queue: (() => Promise<void>)[] = [];
  private running = false;
  private readonly observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        this.observer.unobserve(entry.target);
        const job = this.jobs.get(entry.target);
        this.jobs.delete(entry.target);
        if (job) this.enqueue(job);
      }
    },
    { rootMargin: '400px' },
  );

  /** `job` läuft, sobald `el` sichtbar wird; ein neuer Auftrag für dasselbe Element ersetzt ihn. */
  observe(el: Element, job: () => Promise<void>): void {
    this.jobs.set(el, job);
    this.observer.unobserve(el);
    this.observer.observe(el);
  }

  clear(): void {
    this.observer.disconnect();
    this.jobs.clear();
    this.queue.length = 0;
  }

  private enqueue(job: () => Promise<void>): void {
    this.queue.push(job);
    if (!this.running) void this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    for (let job = this.queue.shift(); job; job = this.queue.shift()) {
      try {
        await job();
      } catch {
        // Die Aufgabe zeigt ihren Fehler selbst an; die übrigen Vorschauen laufen weiter.
      }
    }
    this.running = false;
  }
}
