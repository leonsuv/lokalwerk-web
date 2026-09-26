/**
 * Werkzeugseite „Gläubiger-ID prüfen“ (plan-phase2.md Vorschlag E). Prüfung nach EPC262-08
 * v12.0 (core/sepa/creditor-id.ts). Nichts wird gesendet oder gespeichert.
 */

import { validateCreditorId, type CreditorIdResult } from '../../core/sepa/creditor-id.ts';
import { $ } from '../../ui/dom.ts';

const input = $<HTMLInputElement>('#ci-input');

function explain(result: Extract<CreditorIdResult, { ok: false }>): string {
  switch (result.code) {
    case 'empty':
      return '';
    case 'format':
      return 'Der Aufbau stimmt nicht: zwei Buchstaben für das Land, zwei Ziffern, drei Zeichen für den Geschäftsbereich, dann die nationale Kennung.';
    case 'not-sepa':
      return `${result.country} ist kein Land im SEPA-Raum. Prüfe die ersten beiden Buchstaben.`;
    case 'length-de':
      return `Eine deutsche Gläubiger-ID hat 18 Stellen, diese hat ${result.actual}. Prüfe, ob eine Stelle fehlt oder doppelt ist.`;
    case 'national-de':
      return 'Bei einer deutschen Gläubiger-ID stehen ab Stelle 8 nur Ziffern.';
    case 'checksum':
      return 'Die Prüfziffer passt nicht zur Nummer. Meist ist eine Ziffer vertippt oder vertauscht.';
  }
}

function chip(text: string, className: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function row(label: string, value: string): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  const td = document.createElement('td');
  td.className = 'iban';
  td.textContent = value;
  tr.append(th, td);
  return tr;
}

function render(): void {
  const result = validateCreditorId(input.value);
  const out = $('#ci-result');
  const partsWrap = $('#ci-parts-wrap');
  input.setAttribute('aria-invalid', String(!result.ok && result.code !== 'empty'));
  if (result.ok) {
    out.replaceChildren(chip('Formal gültig: Aufbau und Prüfziffer stimmen.', 'badge ok'));
    $('#ci-parts tbody').replaceChildren(
      row('Land', result.country),
      row('Prüfziffer', result.checkDigits),
      row('Geschäftsbereich', result.businessCode),
      row('Nationale Kennung', result.national),
    );
    partsWrap.hidden = false;
    return;
  }
  partsWrap.hidden = true;
  const text = explain(result);
  out.replaceChildren(...(text ? [chip(text, 'badge err')] : []));
}

input.addEventListener('input', render);
render();
