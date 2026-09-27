/**
 * Menü der PDF-Werkstatt: Kontextmenü einer Seite und Menü im Spaltenkopf (plan-phase3.md 6.1,
 * 6.2). Muster „Menu“ aus den WAI-ARIA Authoring Practices: Pfeiltasten, Pos1/Ende, Eingabe
 * oder Leertaste wählt, Esc schließt und gibt den Fokus zurück. Tastenkürzel stehen sichtbar
 * daneben und in aria-keyshortcuts.
 */

export interface MenuItem {
  id: string;
  label: string;
  /** Anzeige, z. B. „Strg+X“ */
  shortcut?: string;
  /** Für aria-keyshortcuts, z. B. „Control+X“ */
  keys?: string;
  disabled?: boolean;
  /** Trennlinie vor diesem Eintrag */
  separator?: boolean;
}

export class Menu {
  private returnFocus: HTMLElement | null = null;
  private onChoose: ((id: string) => void) | null = null;
  private opener: HTMLElement | null = null;

  constructor(private readonly el: HTMLElement) {
    el.setAttribute('role', 'menu');
    el.hidden = true;
    el.addEventListener('click', (event) => {
      const item = (event.target as Element).closest<HTMLButtonElement>('[role="menuitem"]');
      if (item && !item.disabled) this.choose(item.dataset.id ?? '');
    });
    el.addEventListener('keydown', (event) => this.onKey(event));
    // Schließen, wenn der Fokus das Menü verlässt (Tab, Klick daneben)
    el.addEventListener('focusout', (event) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !el.contains(next)) this.close(false);
    });
    document.addEventListener('pointerdown', (event) => {
      if (!el.hidden && !el.contains(event.target as Node)) this.close(false);
    });
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  /**
   * Öffnet das Menü an der Stelle (Bildschirmkoordinaten). `opener` bekommt aria-expanded,
   * `returnFocus` den Fokus nach dem Schließen.
   */
  show(
    items: readonly MenuItem[],
    at: { x: number; y: number },
    options: {
      label: string;
      returnFocus: HTMLElement;
      opener?: HTMLElement;
      onChoose: (id: string) => void;
    },
  ): void {
    this.el.replaceChildren(
      ...items.flatMap((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        button.tabIndex = -1;
        button.dataset.id = item.id;
        button.disabled = item.disabled ?? false;
        const label = document.createElement('span');
        label.textContent = item.label;
        button.append(label);
        if (item.shortcut) {
          const kbd = document.createElement('kbd');
          kbd.textContent = item.shortcut;
          kbd.setAttribute('aria-hidden', 'true');
          button.append(kbd);
        }
        if (item.keys) button.setAttribute('aria-keyshortcuts', item.keys);
        if (!item.separator) return [button];
        const line = document.createElement('div');
        line.setAttribute('role', 'separator');
        return [line, button];
      }),
    );
    this.el.setAttribute('aria-label', options.label);
    this.returnFocus = options.returnFocus;
    this.onChoose = options.onChoose;
    this.opener?.setAttribute('aria-expanded', 'false');
    this.opener = options.opener ?? null;
    this.opener?.setAttribute('aria-expanded', 'true');
    this.el.hidden = false;
    // Im Bild halten
    const { width, height } = this.el.getBoundingClientRect();
    const x = Math.max(8, Math.min(at.x, window.innerWidth - width - 8));
    const y = Math.max(8, Math.min(at.y, window.innerHeight - height - 8));
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.items()[0]?.focus();
  }

  close(restoreFocus = true): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.opener?.setAttribute('aria-expanded', 'false');
    this.opener = null;
    if (restoreFocus) this.returnFocus?.focus();
    this.returnFocus = null;
  }

  private items(): HTMLButtonElement[] {
    return [...this.el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
  }

  private choose(id: string): void {
    const handler = this.onChoose;
    this.close();
    handler?.(id);
  }

  private onKey(event: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        go(index + 1);
        break;
      case 'ArrowUp':
        go(index - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(items.length - 1);
        break;
      case 'Escape':
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
}
