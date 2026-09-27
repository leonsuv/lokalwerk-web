import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyRenderer } from '../../src/ui/lazy-render.ts';

/** Nachgebauter IntersectionObserver: Sichtbarkeit wird im Test per `show` gesetzt */
class FakeObserver {
  static all: FakeObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(
    private readonly callback: (records: IntersectionObserverEntry[]) => void,
    readonly options: IntersectionObserverInit,
  ) {
    FakeObserver.all.push(this);
  }
  observe(el: Element): void {
    this.targets.add(el);
  }
  unobserve(el: Element): void {
    this.targets.delete(el);
  }
  disconnect(): void {
    this.targets.clear();
  }
  fire(el: Element, visible: boolean): void {
    if (!this.targets.has(el)) return;
    this.callback([{ target: el, isIntersecting: visible } as IntersectionObserverEntry]);
  }
}

function show(el: Element, visible: boolean): void {
  for (const o of FakeObserver.all) o.fire(el, visible);
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const el = (name: string) => ({ name }) as unknown as Element;

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('LazyRenderer', () => {
  it('ohne release: einmal zeichnen, danach nicht mehr beobachten (bisheriges Verhalten)', async () => {
    const lazy = new LazyRenderer();
    const a = el('a');
    const job = vi.fn(async () => {});
    lazy.observe(a, job);
    show(a, false);
    await flush();
    expect(job).not.toHaveBeenCalled();
    show(a, true);
    await flush();
    show(a, true);
    await flush();
    expect(job).toHaveBeenCalledTimes(1);
  });

  it('gibt über der Grenze die am längsten nicht gesehenen Bilder frei, nie sichtbare', async () => {
    const lazy = new LazyRenderer({ limit: 2 });
    const els = ['a', 'b', 'c'].map(el);
    const released: string[] = [];
    for (const e of els) {
      lazy.observe(e, async () => {}, {
        release: () => released.push((e as unknown as { name: string }).name),
      });
    }
    const [a, b, c] = els as [Element, Element, Element];
    show(a, true);
    show(b, true);
    await flush();
    expect(lazy.renderedCount).toBe(2);
    show(a, false);
    show(c, true);
    await flush();
    expect(released).toEqual(['a']);
    expect(lazy.renderedCount).toBe(2);
    // b ist noch sichtbar: wird nicht freigegeben, auch wenn es älter ist
    show(c, false);
    show(a, true);
    await flush();
    expect(released).toEqual(['a', 'c']);
  });

  it('zeichnet freigegebene Bilder beim Zurückscrollen neu und ersetzt Aufträge', async () => {
    const lazy = new LazyRenderer({ limit: 1 });
    const [a, b] = [el('a'), el('b')];
    const jobA = vi.fn(async () => {});
    lazy.observe(a, jobA, { release: () => {} });
    lazy.observe(b, async () => {}, { release: () => {} });
    show(a, true);
    await flush();
    show(a, false);
    show(b, true);
    await flush();
    show(a, true);
    await flush();
    expect(jobA).toHaveBeenCalledTimes(2);
    // Neuer Auftrag für ein sichtbares Element (z. B. gedreht) läuft sofort
    const jobA2 = vi.fn(async () => {});
    lazy.observe(a, jobA2, { release: () => {} });
    await flush();
    expect(jobA2).toHaveBeenCalledTimes(1);
  });

  it('überspringt Aufträge für Elemente, die vor dem Zeichnen wieder unsichtbar wurden', async () => {
    const lazy = new LazyRenderer();
    let finish = () => {};
    const slow = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const skipped = vi.fn(async () => {});
    const [a, b] = [el('a'), el('b')];
    lazy.observe(a, slow, { release: () => {} });
    lazy.observe(b, skipped, { release: () => {} });
    show(a, true);
    show(b, true);
    show(b, false);
    finish();
    await flush();
    await flush();
    expect(skipped).not.toHaveBeenCalled();
  });

  it('misst mit eigenem Beobachter je scrollendem Container', () => {
    const lazy = new LazyRenderer();
    const root = el('spalte');
    lazy.observe(el('a'), async () => {}, { release: () => {}, root });
    lazy.observe(el('b'), async () => {}, { release: () => {} });
    expect(FakeObserver.all.map((o) => o.options.root ?? null)).toEqual([root, null]);
  });
});
