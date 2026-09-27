/**
 * Menüs der PDF-Werkstatt: Kontextmenüs, Untermenüs und die Menüleiste (Umbau zum Editor).
 * Muster „Menu“ und „Menubar“ aus den WAI-ARIA Authoring Practices: Pfeiltasten, Pos1/Ende,
 * Pfeil rechts öffnet ein Untermenü, Pfeil links schließt es, Eingabe oder Leertaste wählt,
 * Esc schließt eine Ebene, Tab schließt alles. Anfangsbuchstaben springen zum Eintrag.
 * Tastenkürzel stehen sichtbar daneben und in aria-keyshortcuts.
 */

export type MenuEntry =
  | {
      kind?: 'item';
      label: string;
      /** Anzeige, z. B. „Strg+X“ */
      shortcut?: string;
      /** Für aria-keyshortcuts, z. B. „Control+X“ */
      keys?: string;
      disabled?: boolean;
      /** Häkchen (Umschalter) oder Punkt (eine aus mehreren) */
      checked?: boolean;
      radio?: boolean;
      run: () => void;
    }
  | { kind: 'submenu'; label: string; disabled?: boolean; items: () => MenuEntry[] }
  | { kind: 'separator' };

/** Kurzform für eine Trennlinie */
export const SEP: MenuEntry = { kind: 'separator' };

interface OpenOptions {
  label: string;
  /** Fokus nach dem Schließen */
  returnFocus: HTMLElement | null;
  /** Bekommt aria-expanded */
  opener?: HTMLElement;
  /** Pfeil links/rechts in der obersten Ebene (Menüleiste) */
  onSideways?: (direction: -1 | 1) => void;
  /** Nach dem Schließen, auch ohne Auswahl */
  onClose?: () => void;
}

/** Offene Menüs von außen nach innen */
const stack: PopupMenu[] = [];

function closeAll(restore: boolean): void {
  const root = stack[0];
  root?.close(restore);
}

document.addEventListener(
  'pointerdown',
  (event) => {
    if (stack.length === 0) return;
    const inside = stack.some((m) => m.el.contains(event.target as Node));
    const onOpener = stack[0]?.opener?.contains(event.target as Node);
    if (!inside && !onOpener) closeAll(false);
  },
  true,
);
window.addEventListener('blur', () => closeAll(false));
window.addEventListener('resize', () => closeAll(false));

class PopupMenu {
  readonly el = document.createElement('div');
  opener: HTMLElement | null = null;
  private child: PopupMenu | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    entries: readonly MenuEntry[],
    private readonly options: OpenOptions,
    private readonly parent: PopupMenu | null,
  ) {
    const el = this.el;
    el.className = 'ws-menu';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', options.label);
    el.tabIndex = -1;
    for (const entry of entries) el.append(this.render(entry));
    el.addEventListener('keydown', (event) => this.onKey(event));
    el.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private render(entry: MenuEntry): HTMLElement {
    if (entry.kind === 'separator') {
      const line = document.createElement('div');
      line.setAttribute('role', 'separator');
      return line;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.disabled = entry.disabled ?? false;
    const mark = document.createElement('span');
    mark.className = 'ws-menu-mark';
    mark.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'ws-menu-label';
    label.textContent = entry.label;
    button.append(mark, label);
    if (entry.kind === 'submenu') {
      button.setAttribute('role', 'menuitem');
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      const arrow = document.createElement('span');
      arrow.className = 'ws-menu-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '›';
      button.append(arrow);
      const open = () => {
        if (!button.disabled) this.openChild(entry.items(), button, entry.label, false);
      };
      button.addEventListener('click', open);
      button.addEventListener('pointerenter', () => {
        clearTimeout(this.hoverTimer);
        button.focus();
        this.hoverTimer = setTimeout(open, 140);
      });
      return button;
    }
    if (entry.checked !== undefined) {
      button.setAttribute('role', entry.radio ? 'menuitemradio' : 'menuitemcheckbox');
      button.setAttribute('aria-checked', String(entry.checked));
      mark.textContent = entry.checked ? (entry.radio ? '●' : '✓') : '';
    } else {
      button.setAttribute('role', 'menuitem');
    }
    if (entry.shortcut) {
      const kbd = document.createElement('kbd');
      kbd.textContent = entry.shortcut;
      kbd.setAttribute('aria-hidden', 'true');
      button.append(kbd);
    }
    if (entry.keys) button.setAttribute('aria-keyshortcuts', entry.keys);
    button.addEventListener('click', () => {
      if (button.disabled) return;
      closeAll(true);
      entry.run();
    });
    button.addEventListener('pointerenter', () => {
      clearTimeout(this.hoverTimer);
      if (!button.disabled) button.focus();
      else this.el.focus();
      this.hoverTimer = setTimeout(() => this.closeChild(false), 140);
    });
    return button;
  }

  items(): HTMLButtonElement[] {
    return [...this.el.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)')];
  }

  show(at: { x: number; y: number }, avoid?: DOMRect): void {
    document.body.append(this.el);
    stack.push(this);
    this.opener = this.options.opener ?? null;
    this.opener?.setAttribute('aria-expanded', 'true');
    const { width, height } = this.el.getBoundingClientRect();
    let x = at.x;
    let y = at.y;
    // Untermenü: passt es rechts nicht hin, links vom Elternmenü
    if (avoid && x + width > window.innerWidth - 8) x = avoid.left - width + 4;
    x = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - height - 8));
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  focusFirst(last = false): void {
    const items = this.items();
    (last ? items[items.length - 1] : items[0])?.focus();
    if (items.length === 0) this.el.focus();
  }

  private openChild(
    entries: MenuEntry[],
    button: HTMLButtonElement,
    label: string,
    focus: boolean,
  ): void {
    if (this.child?.opener === button) {
      if (focus) this.child.focusFirst();
      return;
    }
    this.closeChild(false);
    const child = new PopupMenu(entries, { label, returnFocus: button, opener: button }, this);
    this.child = child;
    const r = button.getBoundingClientRect();
    child.show({ x: r.right - 4, y: r.top - 5 }, this.el.getBoundingClientRect());
    if (focus) child.focusFirst();
  }

  private closeChild(restore: boolean): void {
    this.child?.close(restore);
    this.child = null;
  }

  close(restore: boolean): void {
    clearTimeout(this.hoverTimer);
    this.closeChild(false);
    const at = stack.indexOf(this);
    if (at >= 0) stack.splice(at, 1);
    if (!this.el.isConnected) return;
    this.el.remove();
    this.opener?.setAttribute('aria-expanded', 'false');
    if (this.parent) {
      if (this.parent.child === this) this.parent.child = null;
      if (restore) this.options.returnFocus?.focus();
      return;
    }
    if (restore) this.options.returnFocus?.focus();
    this.options.onClose?.();
  }

  private onKey(event: KeyboardEvent): void {
    const items = this.items();
    const current = document.activeElement as HTMLButtonElement;
    const index = items.indexOf(current);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        go(index + 1);
        break;
      case 'ArrowUp':
        go(index < 0 ? items.length - 1 : index - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(items.length - 1);
        break;
      case 'ArrowRight':
        if (current.getAttribute('aria-haspopup') === 'menu') {
          current.click();
          this.child?.focusFirst();
        } else {
          this.root().options.onSideways?.(1);
        }
        break;
      case 'ArrowLeft':
        if (this.parent) this.close(true);
        else this.options.onSideways?.(-1);
        break;
      case 'Escape':
        this.close(true);
        break;
      case 'Tab':
        closeAll(true);
        break;
      case 'Enter':
      case ' ':
        if (current.getAttribute('aria-haspopup') === 'menu') {
          current.click();
          this.child?.focusFirst();
        } else {
          current.click();
        }
        break;
      default:
        // Anfangsbuchstabe: nächster Eintrag, der so beginnt
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const k = event.key.toLowerCase();
          const start = index + 1;
          for (let n = 0; n < items.length; n++) {
            const item = items[(start + n) % items.length];
            const text = item?.querySelector('.ws-menu-label')?.textContent ?? '';
            if (text.toLowerCase().startsWith(k)) {
              item?.focus();
              break;
            }
          }
          break;
        }
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private root(): PopupMenu {
    return this.parent ? this.parent.root() : this;
  }
}

/** Menü öffnen (Kontextmenü, Knopf mit Menü). Schließt ein offenes Menü vorher. */
export function openMenu(
  entries: readonly MenuEntry[],
  at: { x: number; y: number },
  options: OpenOptions,
  focusLast = false,
): void {
  closeAll(false);
  const menu = new PopupMenu(entries, options, null);
  menu.show(at);
  menu.focusFirst(focusLast);
}

export function menuOpen(): boolean {
  return stack.length > 0;
}

export function closeMenus(): void {
  closeAll(false);
}

/** Menü unter einem Knopf öffnen */
export function openMenuAt(
  button: HTMLElement,
  entries: readonly MenuEntry[],
  label: string,
  extra: Partial<OpenOptions> = {},
): void {
  const r = button.getBoundingClientRect();
  openMenu(
    entries,
    { x: r.left, y: r.bottom + 2 },
    {
      label,
      returnFocus: button,
      opener: button,
      ...extra,
    },
  );
}

/**
 * Menüleiste: oberste Einträge als Knöpfe (role=menuitem), ein Tabstopp. Klick oder Pfeil runter
 * öffnet, Pfeil links/rechts wechselt, auch bei offenem Menü; Überfahren mit der Maus wechselt,
 * solange ein Menü offen ist.
 */
export class MenuBar {
  private readonly buttons: HTMLButtonElement[] = [];
  private openIndex = -1;

  constructor(el: HTMLElement, menus: readonly { label: string; items: () => MenuEntry[] }[]) {
    el.setAttribute('role', 'menubar');
    menus.forEach((menu, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ws-mb-item';
      button.setAttribute('role', 'menuitem');
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.tabIndex = i === 0 ? 0 : -1;
      button.textContent = menu.label;
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (this.openIndex === i) {
          closeMenus();
          return;
        }
        this.open(i, menus, false);
      });
      button.addEventListener('click', (event) => {
        // Tastatur (Eingabe/Leertaste) löst click ohne pointerdown aus
        if (event.detail === 0) this.open(i, menus, true);
      });
      button.addEventListener('pointerenter', () => {
        if (this.openIndex >= 0 && this.openIndex !== i) this.open(i, menus, false);
      });
      button.addEventListener('keydown', (event) => {
        const n = this.buttons.length;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          const next = (i + (event.key === 'ArrowRight' ? 1 : -1) + n) % n;
          this.focus(next);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          this.open(i, menus, true, event.key === 'ArrowUp');
        } else if (event.key === 'Home') {
          this.focus(0);
        } else if (event.key === 'End') {
          this.focus(n - 1);
        } else {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      });
      this.buttons.push(button);
      el.append(button);
    });
  }

  focus(i: number): void {
    for (const [k, b] of this.buttons.entries()) b.tabIndex = k === i ? 0 : -1;
    this.buttons[i]?.focus();
  }

  /** F10: Fokus in die Menüleiste */
  focusBar(): void {
    this.focus(
      Math.max(
        0,
        this.buttons.findIndex((b) => b.tabIndex === 0),
      ),
    );
  }

  private open(
    i: number,
    menus: readonly { label: string; items: () => MenuEntry[] }[],
    focus: boolean,
    last = false,
  ): void {
    const button = this.buttons[i];
    const menu = menus[i];
    if (!button || !menu) return;
    for (const [k, b] of this.buttons.entries()) b.tabIndex = k === i ? 0 : -1;
    const r = button.getBoundingClientRect();
    openMenu(
      menu.items(),
      { x: r.left, y: r.bottom + 2 },
      {
        label: menu.label,
        returnFocus: button,
        opener: button,
        onSideways: (direction) => {
          const n = this.buttons.length;
          this.open((i + direction + n) % n, menus, true);
        },
        onClose: () => {
          if (this.openIndex === i) this.openIndex = -1;
          button.classList.remove('open');
        },
      },
      last,
    );
    this.openIndex = i;
    button.classList.add('open');
    // Mit der Maus geöffnet: noch kein Eintrag hervorgehoben, die Tastatur geht trotzdem
    if (!focus)
      (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.ws-menu')?.focus();
  }
}
