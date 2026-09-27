/**
 * Handy-Ansicht der PDF-Werkstatt (plan-phase3.md 5.4, W10), bis 640 px Breite:
 * - ein Dokument zur Zeit, Wechsel über die Auswahl oben,
 * - Tippen öffnet die Einzelseite; „Auswählen“ schaltet in den Auswahlmodus mit Häkchen,
 * - untere Leiste: Drehen, Nach vorne, Nach hinten, Verschieben nach …, Löschen, Mehr,
 * - kein Ziehen (drag.ts fragt isPhone), Umsortieren nur mit „Nach vorne/Nach hinten“ und
 *   „Verschieben nach …“.
 * Die Werkzeugleiste des Desktops ist ausgeblendet; die rechte Spalte (Export, Hinweise) steht
 * unter den Seiten.
 */

import { toggle } from '../../core/workshop/selection.ts';
import type { DocId, PageKey } from '../../core/workshop/model.ts';
import { $ } from '../../ui/dom.ts';
import type { Actions } from './actions.ts';
import { openMenu, type MenuEntry } from './menu.ts';
import type { WorkshopStore } from './store.ts';
import { mobileDocOption, mobileStatus, MOBILE_HINT } from './texts.ts';

export interface MobileContext {
  store: WorkshopStore;
  actions: Actions;
  board: HTMLElement;
  phone: MediaQueryList;
  openPreview(key: PageKey): void;
  /** Weitere Aktionen im Menü „Mehr“: die Menüs der Menüleiste */
  moreItems(): MenuEntry[];
  announceSelection(): void;
}

export function setupMobile(ctx: MobileContext): {
  render(): void;
  showDoc(doc: DocId): void;
  activeDoc(): DocId | null;
} {
  const select = $<HTMLSelectElement>('#ws-m-doc');
  const selectButton = $<HTMLButtonElement>('#ws-m-select');
  const status = $('#ws-m-status');
  const bar = $('#ws-actions');
  let active: DocId | null = null;
  let selecting = false;

  function render(): void {
    const { state, selection } = ctx.store;
    if (!state.docs.some((d) => d.id === active)) active = state.docs[0]?.id ?? null;
    // Auswahlliste der Dokumente, nur neu aufbauen, wenn sich etwas geändert hat
    const options = state.docs.map((d) => [d.id, mobileDocOption(d.name, d.pages.length)] as const);
    const same =
      select.options.length === options.length &&
      options.every(
        ([id, label], i) => select.options[i]?.value === id && select.options[i]?.text === label,
      );
    if (!same) {
      select.replaceChildren(
        ...options.map(([id, label]) => {
          const option = document.createElement('option');
          option.value = id;
          option.text = label;
          return option;
        }),
      );
    }
    if (active) select.value = active;
    for (const col of ctx.board.querySelectorAll<HTMLElement>('.ws-sec')) {
      col.classList.toggle('active', col.dataset.doc === active);
    }
    document.documentElement.classList.toggle('ws-selecting', selecting);
    selectButton.setAttribute('aria-pressed', String(selecting));
    const count = selection.keys.size;
    status.textContent = selecting ? mobileStatus(count) : MOBILE_HINT;
    for (const button of bar.querySelectorAll<HTMLButtonElement>('button[data-m]')) {
      button.disabled = button.dataset.m !== 'more' && count === 0;
    }
    $('#ws-mobile').hidden = state.docs.length === 0;
    bar.hidden = state.docs.length === 0;
  }

  select.addEventListener('change', () => {
    active = select.value;
    ctx.store.select({ keys: new Set(), anchor: null, focus: null });
  });

  selectButton.addEventListener('click', () => {
    selecting = !selecting;
    if (!selecting) ctx.store.select({ ...ctx.store.selection, keys: new Set(), anchor: null });
    else render();
  });

  // Tippen auf eine Seite: im Auswahlmodus an- oder abwählen, sonst Einzelseite. Läuft vor
  // der Auswahl des Desktops (Erfassungsphase) und hält sie auf.
  ctx.board.addEventListener(
    'click',
    (event) => {
      if (!ctx.phone.matches) return;
      const key = (event.target as Element).closest<HTMLElement>('.ws-page')?.dataset.key;
      if (!key) return;
      event.stopPropagation();
      if (selecting) {
        ctx.store.select(toggle(ctx.store.selection, key));
        ctx.announceSelection();
      } else {
        ctx.openPreview(key);
      }
    },
    true,
  );

  bar.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-m]');
    if (!button || button.disabled) return;
    const { actions } = ctx;
    switch (button.dataset.m) {
      case 'rotate':
        actions.rotate(90);
        break;
      case 'forward':
        actions.shift(-1);
        break;
      case 'back':
        actions.shift(1);
        break;
      case 'move':
        actions.moveDialog();
        break;
      case 'delete':
        actions.remove();
        break;
      case 'more': {
        const rect = button.getBoundingClientRect();
        openMenu(
          ctx.moreItems(),
          { x: rect.right, y: rect.top - 8 },
          {
            label: button.getAttribute('aria-label') ?? '',
            returnFocus: button,
            opener: button,
          },
          true,
        );
        break;
      }
    }
  });

  // Beim Wechsel zwischen Handy und Desktop: Auswahlmodus beenden
  ctx.phone.addEventListener('change', () => {
    selecting = false;
    render();
  });

  return {
    render,
    activeDoc: () => active,
    showDoc: (doc) => {
      active = doc;
      render();
    },
  };
}
