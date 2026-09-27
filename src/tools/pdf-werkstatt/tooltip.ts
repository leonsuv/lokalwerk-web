/**
 * Tooltips der Werkzeugleiste (Umbau zum Editor): Name und Tastenkürzel des Befehls, nach kurzem
 * Verweilen mit der Maus oder sofort bei Tastaturfokus. Nur eine Anzeige; vorgelesen wird der
 * Name über aria-label, das Kürzel über aria-keyshortcuts.
 */

export function setupTooltips(root: HTMLElement, tip: HTMLElement): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: HTMLElement | null = null;

  function show(el: HTMLElement): void {
    const text = el.dataset.tip;
    if (!text) return;
    current = el;
    tip.replaceChildren();
    const [label, key] = text.split('\u0000');
    tip.append(label ?? '');
    if (key) {
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      tip.append(kbd);
    }
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.getBoundingClientRect();
    const x = Math.max(
      6,
      Math.min(r.left + r.width / 2 - w.width / 2, window.innerWidth - w.width - 6),
    );
    const below = r.bottom + 8 + w.height < window.innerHeight;
    tip.style.left = `${x}px`;
    tip.style.top = `${below ? r.bottom + 8 : r.top - w.height - 8}px`;
  }

  function hide(): void {
    clearTimeout(timer);
    current = null;
    tip.hidden = true;
  }

  root.addEventListener('pointerover', (event) => {
    const el = (event.target as Element).closest<HTMLElement>('[data-tip]');
    if (!el || el === current) return;
    clearTimeout(timer);
    // Schon ein Tooltip sichtbar: gleich wechseln, wie in Desktop-Programmen
    if (!tip.hidden) show(el);
    else timer = setTimeout(() => show(el), 450);
  });
  root.addEventListener('pointerout', (event) => {
    const to = event.relatedTarget as Element | null;
    if (to?.closest('[data-tip]') && root.contains(to)) return;
    hide();
  });
  root.addEventListener('focusin', (event) => {
    const el = (event.target as Element).closest<HTMLElement>('[data-tip]');
    if (el?.matches(':focus-visible')) show(el);
  });
  root.addEventListener('focusout', hide);
  root.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !tip.hidden) hide();
  });
}
