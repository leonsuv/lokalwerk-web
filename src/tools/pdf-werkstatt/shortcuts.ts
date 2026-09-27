/**
 * Tastenkürzel der Werkstatt als kurze Beschreibung („mod+shift+z“, „r“, „delete“): daraus
 * entstehen Anzeige im Menü („Strg+Umschalt+Z“ bzw. „⌘⇧Z“), aria-keyshortcuts und der Vergleich
 * mit einem Tastendruck. „mod“ ist Strg, auf dem Mac Cmd.
 */

import { combo, KEY } from './texts.ts';

const NAMES: Record<string, string> = {
  delete: 'Entf',
  backspace: '⌫',
  enter: 'Eingabe',
  escape: 'Esc',
  plus: '+',
  minus: '−',
  arrowup: 'Pfeil hoch',
  arrowdown: 'Pfeil runter',
  arrowleft: 'Pfeil links',
  arrowright: 'Pfeil rechts',
  pageup: 'Bild auf',
  pagedown: 'Bild ab',
  home: 'Pos1',
  end: 'Ende',
  space: 'Leertaste',
};

const ARIA: Record<string, string> = {
  delete: 'Delete',
  backspace: 'Backspace',
  enter: 'Enter',
  escape: 'Escape',
  plus: '+',
  minus: '-',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
  space: 'Space',
};

function split(spec: string): { mods: string[]; key: string } {
  const parts = spec.split('+');
  const key = parts.pop() ?? '';
  return { mods: parts, key };
}

/** Anzeige, z. B. „Strg+Umschalt+Z“ */
export function shortcutLabel(spec: string): string {
  const { mods, key } = split(spec);
  const name = NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key.toUpperCase());
  return combo(...mods.filter((m) => m in KEY), name);
}

/** Für aria-keyshortcuts; „mod“ wird zu Control und Meta */
export function ariaShortcut(specs: readonly string[]): string {
  const out: string[] = [];
  for (const spec of specs) {
    const { mods, key } = split(spec);
    const name = ARIA[key] ?? (key.length === 1 ? key.toUpperCase() : key.toUpperCase());
    const rest = mods
      .filter((m) => m !== 'mod')
      .map((m) => ({ shift: 'Shift', alt: 'Alt' })[m] ?? m);
    if (mods.includes('mod')) {
      out.push(['Control', ...rest, name].join('+'), ['Meta', ...rest, name].join('+'));
    } else {
      out.push([...rest, name].join('+'));
    }
  }
  return out.join(' ');
}

/**
 * Tastendruck als Beschreibung. Zeichen wie „?“ oder „+“ ohne Umschalt, weil es je nach
 * Tastatur mit oder ohne Umschalt entsteht.
 */
export function keyOf(event: KeyboardEvent): string {
  let key = event.key.toLowerCase();
  if (key === ' ') key = 'space';
  if (key === '+' || key === '=') key = 'plus';
  if (key === '-' || key === '_') key = 'minus';
  // Buchstaben mit Alt (Mac) liefern Sonderzeichen: dann den Code der Taste nehmen
  if (event.altKey && /^Key[A-Z]$/.test(event.code)) key = event.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(event.code) && (event.ctrlKey || event.metaKey)) key = event.code.slice(5);
  const printable = key.length === 1 && !/[a-z0-9]/.test(key);
  const mods = [
    event.ctrlKey || event.metaKey ? 'mod' : '',
    event.altKey ? 'alt' : '',
    event.shiftKey && !printable && key !== 'plus' && key !== 'minus' ? 'shift' : '',
  ].filter(Boolean);
  return [...mods, key].join('+');
}
