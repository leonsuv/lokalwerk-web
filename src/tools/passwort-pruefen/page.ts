/**
 * Werkzeugseite „Passwort prüfen“. Das Passwort wird nur im Browser eingeordnet und nirgends
 * gespeichert (AGENTS.md Regel 1 und 5).
 */

import { checkPassword, type Finding } from '../../core/random/password-check.ts';
import { $, $$ } from '../../ui/dom.ts';

const input = $<HTMLInputElement>('#pwc-input');
const showButtons = $$<HTMLButtonElement>('button[data-show]');
const findingsBox = $('#pwc-findings');
const summary = $('#pwc-summary');

const EXAMPLES = {
  long: 'mindestens 25 Zeichen',
  'long-two-kinds': '20 bis 25 Zeichen mit zwei Zeichenarten',
  'short-four-kinds': '8 bis 12 Zeichen mit vier Zeichenarten',
} as const;

const TEXTS: Record<Finding['kind'], (f: Finding) => string> = {
  common: () => 'Dieses Passwort steht in der Liste sehr häufiger Passwörter. Wähle ein anderes.',
  'common-start': () =>
    'Das Passwort besteht aus einem sehr häufigen Passwort mit angehängten Ziffern oder Zeichen. Das probieren Angreifer zuerst.',
  'repeat-char': (f) => `Es enthält ein Zeichen mehrfach hintereinander („${sample(f)}“).`,
  sequence: (f) => `Es enthält eine Reihe aufeinanderfolgender Zeichen („${sample(f)}“).`,
  keyboard: (f) => `Es enthält eine Tastaturreihe („${sample(f)}“).`,
  'repeat-block': (f) => `Es besteht aus einem wiederholten Block („${sample(f)}“).`,
  umlaut: () =>
    'Es enthält Umlaute, ß oder €. Das BSI rät davon ab, weil manche Dienste und Tastaturen sie anders behandeln.',
};

function sample(f: Finding): string {
  return 'sample' in f ? f.sample : '';
}

function chip(text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'chip';
  el.textContent = text;
  return el;
}

function render(): void {
  const show = showButtons.some(
    (b) => b.dataset.show === 'yes' && b.getAttribute('aria-pressed') === 'true',
  );
  input.type = show ? 'text' : 'password';
  const password = input.value;
  $('#pwc-empty').hidden = password !== '';
  if (password === '') {
    summary.replaceChildren();
    findingsBox.replaceChildren();
    for (const id of ['#pwc-length', '#pwc-kinds', '#pwc-bsi']) $(id).textContent = '–';
    return;
  }
  const c = checkPassword(password);
  $('#pwc-length').textContent = `${c.length} Zeichen`;
  $('#pwc-kinds').textContent = `${c.kinds} von 4`;
  $('#pwc-bsi').textContent = c.bsi.ok ? 'erfüllt' : 'nicht erfüllt';
  const kindNames = [
    c.upper ? 'Großbuchstaben' : '',
    c.lower ? 'Kleinbuchstaben' : '',
    c.digits ? 'Ziffern' : '',
    c.symbols ? 'Sonderzeichen' : '',
  ].filter(Boolean);
  summary.replaceChildren(
    chip(
      c.bsi.ok
        ? `Entspricht dem BSI-Beispiel: ${
            c.bsi.example === 'short-four-kinds' && c.length > 12
              ? 'mindestens 8 Zeichen mit vier Zeichenarten'
              : EXAMPLES[c.bsi.example]
          }`
        : 'Entspricht keinem der BSI-Beispiele',
    ),
    chip(kindNames.join(', ')),
  );
  const lines = c.findings.map((f) => {
    const p = document.createElement('p');
    p.className = 'hint err';
    p.textContent = TEXTS[f.kind](f);
    return p;
  });
  if (lines.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Keine typischen Schwächen gefunden.';
    lines.push(p);
  }
  if (!c.bsi.ok) {
    const p = document.createElement('p');
    p.className = 'hint err';
    p.textContent =
      'Länge und Zeichenarten reichen für keines der BSI-Beispiele. Ein längeres Passwort hilft am meisten.';
    lines.unshift(p);
  }
  findingsBox.replaceChildren(...lines);
}

for (const b of showButtons) {
  b.addEventListener('click', () => {
    for (const other of showButtons) other.setAttribute('aria-pressed', String(other === b));
    render();
  });
}
input.addEventListener('input', render);
render();
