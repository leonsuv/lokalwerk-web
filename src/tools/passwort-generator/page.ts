/**
 * Werkzeugseite „Passwort-Generator“ (plan-phase2.md, Werkzeug 25). Zufall aus
 * crypto.getRandomValues; nichts wird gesendet oder gespeichert (AGENTS.md Regel 1 und 5).
 */

import {
  alphabetSize,
  BSI_WLAN_MIN_LENGTH,
  entropyBits,
  generatePassword,
  rateAgainstBsi,
  type BsiRating,
  type CharGroup,
} from '../../core/random/password.ts';
import { $, $$ } from '../../ui/dom.ts';
import { showToast } from '../../ui/toast.ts';

const output = $('#pw-out');
const length = $<HTMLInputElement>('#pw-length');
const groupButtons = $$<HTMLButtonElement>('button[data-group]');
const ambiguousButtons = $$<HTMLButtonElement>('button[data-ambiguous]');
const rating = $('#pw-rating');

const random = (buffer: Uint32Array<ArrayBuffer>) => crypto.getRandomValues(buffer);

let groups = new Set<CharGroup>(['upper', 'lower', 'digits', 'symbols']);
let avoidAmbiguous = false;

const EXAMPLES: Record<Extract<BsiRating, { ok: true }>['example'], string> = {
  long: 'mindestens 25 Zeichen',
  'long-two-kinds': '20 bis 25 Zeichen, zwei Zeichenarten',
  'short-four-kinds': '8 bis 12 Zeichen, vier Zeichenarten',
};

function chip(text: string, className = 'chip'): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function generate(): void {
  const chosen = [...groups];
  const n = Number(length.value);
  output.textContent = generatePassword({ length: n, groups: chosen, avoidAmbiguous }, random);
  const bits = Math.floor(entropyBits(n, alphabetSize(chosen, avoidAmbiguous)));
  const bsi = rateAgainstBsi(n, chosen.length);
  rating.replaceChildren(
    chip(`Zufälligkeit: bis ${bits} Bit`),
    bsi.ok
      ? chip(`Entspricht dem BSI-Beispiel: ${EXAMPLES[bsi.example]}`, 'badge ok')
      : chip('Kürzer oder einfacher als die BSI-Beispiele', 'badge err'),
  );
  $('#pw-wlan').hidden = n >= BSI_WLAN_MIN_LENGTH;
}

function render(): void {
  $('#pw-length-val').textContent = length.value;
  for (const b of groupButtons) {
    const group = b.dataset.group as CharGroup;
    b.setAttribute('aria-pressed', String(groups.has(group)));
    // Die letzte gewählte Zeichenart lässt sich nicht abwählen.
    b.disabled = groups.size === 1 && groups.has(group);
  }
  for (const b of ambiguousButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.ambiguous === 'avoid') === avoidAmbiguous));
  }
  generate();
}

async function copy(): Promise<void> {
  const text = output.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    showToast('Passwort kopiert. Es bleibt in der Zwischenablage, bis du etwas anderes kopierst.');
  } catch {
    // Ohne Zugriff auf die Zwischenablage: Text markieren, damit Strg+C/⌘C reicht.
    const range = document.createRange();
    range.selectNodeContents(output);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    showToast('Das Passwort ist markiert. Kopiere es mit Strg+C oder ⌘C.');
  }
}

length.addEventListener('input', render);
for (const button of groupButtons) {
  button.addEventListener('click', () => {
    const group = button.dataset.group as CharGroup;
    const next = new Set(groups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    if (next.size > 0) groups = next;
    render();
    // Fokus bleibt am Knopf, auch wenn er gerade gesperrt wurde (dann am nächsten).
    if (button.disabled) groupButtons.find((b) => !b.disabled)?.focus();
  });
}
for (const button of ambiguousButtons) {
  button.addEventListener('click', () => {
    avoidAmbiguous = button.dataset.ambiguous === 'avoid';
    render();
  });
}
$('#pw-new').addEventListener('click', generate);
$('#pw-copy').addEventListener('click', () => {
  void copy();
});

render();
