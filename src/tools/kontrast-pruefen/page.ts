/**
 * Werkzeugseite „Kontrast prüfen“ (plan-phase2.md, Werkzeug 30). Rechnet direkt auf der Seite;
 * die Vorschau wird über CSSOM gefärbt (erlaubt die CSP, anders als style-Attribute).
 */

import { assess, formatRatio, type Assessment, type Rgba } from '../../core/color/contrast.ts';
import { parseColor, toHex } from '../../core/color/parse.ts';
import { $ } from '../../ui/dom.ts';

const fg = $<HTMLInputElement>('#con-fg');
const bg = $<HTMLInputElement>('#con-bg');
const fgPick = $<HTMLInputElement>('#con-fg-pick');
const bgPick = $<HTMLInputElement>('#con-bg-pick');
const preview = $('#con-preview');
const results = $('#con-results');

const CHECKS: { key: keyof Omit<Assessment, 'ratio'>; label: string }[] = [
  { key: 'aa', label: 'Text, Stufe AA (4,5:1)' },
  { key: 'aaLarge', label: 'Großer Text, Stufe AA (3:1)' },
  { key: 'aaa', label: 'Text, Stufe AAA (7:1)' },
  { key: 'aaaLarge', label: 'Großer Text, Stufe AAA (4,5:1)' },
  { key: 'nonText', label: 'Bedienelemente und Grafiken (3:1)' },
];

const cssColor = ({ r, g, b, a }: Rgba) =>
  `rgb(${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} / ${a})`;

function read(input: HTMLInputElement, errorId: string, opaque: boolean): Rgba | null {
  const color = parseColor(input.value);
  let message = '';
  if (!color) message = 'Keine gültige Farbe. Schreib zum Beispiel #3A55E0 oder rgb(58 85 224).';
  else if (opaque && color.a < 1) message = 'Der Hintergrund muss deckend sein (ohne Transparenz).';
  $(`#${errorId}`).textContent = message;
  input.setAttribute('aria-invalid', String(message !== ''));
  return message ? null : color;
}

function row(label: string, ok: boolean): HTMLElement {
  const div = document.createElement('div');
  div.className = 'check-row';
  const text = document.createElement('span');
  text.textContent = label;
  const badge = document.createElement('span');
  badge.className = ok ? 'badge ok' : 'badge err';
  badge.textContent = ok ? 'erfüllt' : 'nicht erfüllt';
  div.append(text, badge);
  return div;
}

function update(): void {
  const text = read(fg, 'con-fg-error', false);
  const back = read(bg, 'con-bg-error', true);
  if (!text || !back) {
    $('#con-ratio').textContent = '–';
    results.replaceChildren();
    return;
  }
  const result = assess(text, back);
  $('#con-ratio').textContent = formatRatio(result.ratio);
  results.replaceChildren(...CHECKS.map((c) => row(c.label, result[c.key])));
  preview.style.color = cssColor(text);
  preview.style.backgroundColor = cssColor(back);
  fgPick.value = toHex(text);
  bgPick.value = toHex(back);
}

for (const [input, pick] of [
  [fg, fgPick],
  [bg, bgPick],
] as const) {
  input.addEventListener('input', update);
  pick.addEventListener('input', () => {
    input.value = pick.value.toUpperCase();
    update();
  });
}
$('#con-swap').addEventListener('click', () => {
  [fg.value, bg.value] = [bg.value, fg.value];
  update();
});

update();
