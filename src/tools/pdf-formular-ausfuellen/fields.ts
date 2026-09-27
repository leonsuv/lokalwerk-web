/**
 * Eingaben für die Felder eines PDF-Formulars: ein Element je Feld, Werte lesen, Zeichen außerhalb
 * der PDF-Schrift melden, leere Pflichtfelder zählen. Gemeinsam für die Werkzeugseite (page.ts)
 * und die PDF-Werkstatt (embed.ts). Die Eingaben werden nicht gespeichert (AGENTS.md Regel 5).
 */

import type { FieldValue, FormField, FormInfo } from '../../core/pdf/form.ts';
import { unsupportedChars } from '../../core/pdf/winansi.ts';

export const editable = (f: FormField): boolean => !f.readOnly && f.kind !== 'signature';

function labelText(f: FormField): string {
  return f.required ? `${f.label} (Pflichtfeld)` : f.label;
}

function hint(text: string, className = 'hint'): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

/** Ein Eingabeelement je Feld; data-index verweist auf info.fields */
function control(f: FormField, i: number): HTMLElement {
  const id = `form-f-${i}`;
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.dataset.index = String(i);

  if (f.kind === 'text') {
    const label = document.createElement('label');
    label.className = 'lbl';
    label.htmlFor = id;
    label.textContent = labelText(f);
    const input = f.multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.id = id;
    input.value = typeof f.value === 'string' ? f.value : '';
    input.disabled = f.readOnly;
    input.required = f.required;
    if (f.maxLength !== null) input.maxLength = f.maxLength;
    input.setAttribute('aria-describedby', `${id}-err`);
    const err = hint('', 'hint err');
    err.id = `${id}-err`;
    wrap.append(label, input, err);
  } else if (f.kind === 'checkbox') {
    wrap.classList.add('check-list');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = id;
    box.checked = f.value === true;
    box.disabled = f.readOnly;
    label.append(box, labelText(f));
    wrap.append(label);
  } else if (f.kind === 'radio') {
    const set = document.createElement('fieldset');
    set.className = 'check-list';
    const legend = document.createElement('legend');
    legend.className = 'lbl';
    legend.textContent = labelText(f);
    const pills = document.createElement('div');
    pills.className = 'pills';
    for (const [k, option] of ['', ...f.options].entries()) {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = id;
      radio.value = option;
      radio.id = `${id}-${k}`;
      radio.checked = f.value === option;
      radio.disabled = f.readOnly;
      label.append(radio, option === '' ? 'Keine Auswahl' : option);
      pills.append(label);
    }
    set.append(legend, pills);
    wrap.append(set);
  } else if (f.kind === 'dropdown' || f.kind === 'list') {
    const label = document.createElement('label');
    label.className = 'lbl';
    label.htmlFor = id;
    label.textContent = labelText(f);
    const select = document.createElement('select');
    select.id = id;
    select.multiple = f.multiselect;
    select.disabled = f.readOnly;
    if (f.multiselect) select.size = Math.min(6, Math.max(2, f.options.length));
    const selected = Array.isArray(f.value) ? f.value : [];
    if (!f.multiselect) select.append(new Option('Bitte wählen', '', false, selected.length === 0));
    for (const option of f.options) {
      select.append(new Option(option, option, false, selected.includes(option)));
    }
    wrap.append(label, select);
  } else {
    const label = document.createElement('span');
    label.className = 'lbl';
    label.textContent = labelText(f);
    const note = document.createElement('p');
    note.className = 'hint';
    const link = document.createElement('a');
    link.href = '/pdf-unterschreiben/';
    link.textContent = 'Unterschrift einfügen';
    note.append(
      'Unterschriftsfeld: wird hier nicht ausgefüllt. Eine Unterschrift als Bild setzt du mit ',
      link,
      '.',
    );
    wrap.append(label, note);
  }
  if (f.readOnly && f.kind !== 'signature')
    wrap.append(hint('Schreibgeschützt, lässt sich nicht ändern.'));
  return wrap;
}

export class FormFields {
  /** Zeichenvorrat der PDF-Schrift; bis er da ist, wird nicht geprüft */
  charset: ReadonlySet<number> | null = null;

  constructor(
    private readonly form: HTMLFormElement,
    readonly info: FormInfo,
  ) {
    form.replaceChildren(...info.fields.map(control));
  }

  /** Feld zum Element im Formular (Fokus), z. B. für die Vorschau */
  fieldAt(target: Element): FormField | undefined {
    const wrap = target.closest<HTMLElement>('[data-index]');
    return wrap ? this.info.fields[Number(wrap.dataset.index)] : undefined;
  }

  private valueFor(f: FormField, i: number): FieldValue {
    const id = `form-f-${i}`;
    if (f.kind === 'text') {
      return this.form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value ?? '';
    }
    if (f.kind === 'checkbox')
      return this.form.querySelector<HTMLInputElement>(`#${id}`)?.checked ?? false;
    if (f.kind === 'radio') {
      return this.form.querySelector<HTMLInputElement>(`input[name="${id}"]:checked`)?.value ?? '';
    }
    const select = this.form.querySelector<HTMLSelectElement>(`#${id}`);
    return select ? [...select.selectedOptions].map((o) => o.value).filter((v) => v !== '') : [];
  }

  values(): Record<string, FieldValue> {
    const out: Record<string, FieldValue> = {};
    this.info.fields.forEach((f, i) => {
      if (editable(f)) out[f.name] = this.valueFor(f, i);
    });
    return out;
  }

  /** Leere Pflichtfelder */
  missing(): number {
    const vals = this.values();
    return this.info.fields.filter((f) => {
      if (!f.required || !editable(f)) return false;
      const v = vals[f.name];
      return v === '' || v === false || (Array.isArray(v) && v.length === 0);
    }).length;
  }

  /** Zeichen außerhalb von WinAnsi je Textfeld anzeigen; true, wenn alles passt */
  checkChars(): boolean {
    const charset = this.charset;
    if (!charset) return true;
    let ok = true;
    this.info.fields.forEach((f, i) => {
      if (f.kind !== 'text' || !editable(f)) return;
      const text = String(this.valueFor(f, i)).replace(/[\r\n\t]/g, '');
      const missing = unsupportedChars(text, charset);
      const err = this.form.querySelector(`#form-f-${i}-err`);
      if (err) {
        err.textContent =
          missing.length === 0
            ? ''
            : `Diese Zeichen kann die PDF-Schrift nicht darstellen: ${missing.map((c) => `„${c}“`).join(', ')}. Ersetze sie, zum Beispiel Ł durch L.`;
      }
      this.form
        .querySelector(`#form-f-${i}`)
        ?.setAttribute('aria-invalid', String(missing.length > 0));
      if (missing.length > 0) ok = false;
    });
    return ok;
  }
}
