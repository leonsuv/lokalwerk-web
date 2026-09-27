/**
 * „PDF-Formular ausfüllen“ in der PDF-Werkstatt (plan-phase3.md 7.2, Schritt 2.3): dieselben
 * Felder (fields.ts), Hinweise, Einstellung „Formular festschreiben“ und Meldungen wie auf der
 * Werkzeugseite. Lesen und Ausfüllen übernimmt der Worker der Werkstatt; das Ergebnis ist die
 * ausgefüllte Datei als neue Quelle („Einbacken“).
 *
 * Lädt weder den Worker noch pdf.js der Werkzeugseite (die stecken in page.ts).
 */

import type { FieldValue, FormInfo } from '../../core/pdf/form.ts';
import type { MountTool } from '../../ui/tool-host.ts';
import { editable, FormFields } from './fields.ts';
import markup from './main.html?raw';
import { MESSAGES, messageFor, NO_FIELDS } from './messages.ts';

export interface FormToolOptions<Result> {
  labels: { loading: string; hint: string; apply: string; busy: string };
  /** Formular der Quelle lesen (Worker der Werkstatt) */
  read: () => Promise<FormInfo>;
  /** Ausgefüllt als neue Quelle anlegen */
  fill: (values: Record<string, FieldValue>, flatten: boolean) => Promise<Result>;
  /** Wenn das Werkzeug geschlossen wurde, bevor das Ausfüllen fertig war */
  discard: (result: Result) => void;
  charset: Promise<ReadonlySet<number>>;
  notify: (message: string) => void;
}

const CANCEL = 'Abbrechen';

function fromMarkup(selector: string): HTMLElement {
  const template = document.createElement('template');
  // Festes Markup aus dem eigenen Build, keine Nutzerdaten.
  template.innerHTML = markup;
  const el = template.content.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`${selector} fehlt in main.html`);
  return el;
}

function button(label: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

function paragraph(text: string, className: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

export function formTool<Result>(options: FormToolOptions<Result>): MountTool<Result> {
  return (host) => {
    const { labels } = options;
    const cancel = button(CANCEL, 'btn ghost wide mt-s');
    cancel.addEventListener('click', () => host.cancel());
    const status = paragraph(labels.loading, 'hint');
    status.setAttribute('role', 'status');
    host.root.replaceChildren(status, cancel);
    let closed = false;

    const fail = (message: string) => {
      const err = paragraph(message, 'hint err');
      err.setAttribute('role', 'alert');
      host.root.replaceChildren(err, cancel);
      cancel.focus();
    };

    const show = (info: FormInfo) => {
      const signed = fromMarkup('#form-signed');
      signed.hidden = !info.signed;
      const hybrid = fromMarkup('#form-hybrid');
      hybrid.hidden = info.xfa !== 'hybrid';
      const form = document.createElement('form');
      form.className = 'mt-m';
      form.noValidate = true;
      form.addEventListener('submit', (e) => e.preventDefault());
      const fields = new FormFields(form, info);
      const settings = fromMarkup('#form-settings');
      const hint = paragraph(labels.hint, 'hint mt-m');
      const apply = button(labels.apply, 'btn wide mt-m');
      host.root.replaceChildren(signed, hybrid, form, settings, hint, apply, cancel);
      const q = (selector: string) => {
        const el = host.root.querySelector<HTMLElement>(selector);
        if (!el) throw new Error(`${selector} fehlt`);
        return el;
      };
      const flattenButtons = [...settings.querySelectorAll<HTMLButtonElement>('[data-flatten]')];
      let flatten = false;
      let busy = false;
      const render = () => {
        for (const b of flattenButtons) {
          b.setAttribute('aria-pressed', String((b.dataset.flatten === 'yes') === flatten));
        }
        q('#form-count').textContent = String(info.fields.length);
        q('#form-missing').textContent = String(fields.missing());
        const charsOk = fields.checkChars();
        apply.disabled = busy || !info.fields.some(editable) || !charsOk || fields.charset === null;
      };
      for (const b of flattenButtons) {
        b.addEventListener('click', () => {
          flatten = b.dataset.flatten === 'yes';
          render();
        });
      }
      form.addEventListener('input', render);
      form.addEventListener('change', render);
      void options.charset.then((codes) => {
        fields.charset = codes;
        render();
      });
      apply.addEventListener('click', () => {
        busy = true;
        apply.textContent = labels.busy;
        render();
        options.fill(fields.values(), flatten).then(
          (result) => {
            if (closed) options.discard(result);
            else host.apply(result);
          },
          (error: unknown) => {
            busy = false;
            apply.textContent = labels.apply;
            render();
            if (!closed) options.notify(messageFor(error));
          },
        );
      });
      render();
      form.querySelector<HTMLElement>('input, textarea, select')?.focus();
    };

    options.read().then(
      (info) => {
        if (closed) return;
        if (info.xfa === 'pure') fail(MESSAGES['xfa'] ?? NO_FIELDS);
        else if (info.fields.length === 0) fail(NO_FIELDS);
        else show(info);
      },
      (error: unknown) => {
        if (!closed) fail(messageFor(error));
      },
    );
    return {
      focus: () => cancel.focus(),
      dispose: () => {
        closed = true;
      },
    };
  };
}
