/**
 * PDF-Formulare lesen und ausfüllen (plan-phase2.md Vorschlag B). Ohne DOM, läuft im Worker.
 * Grundlage: ISO 32000-2, 12.7 (interaktive Formulare, AcroForm). XFA-Formulare kann pdf-lib
 * nicht ausfüllen; reine XFA-Formulare werden abgelehnt, bei gemischten wird der XFA-Teil beim
 * Speichern entfernt, damit PDF-Programme die ausgefüllten AcroForm-Felder anzeigen.
 *
 * Schrift für die ausgefüllten Felder: Helvetica (WinAnsi). Zeichen außerhalb davon werden vorher
 * gemeldet (Entscheidung E8a).
 */

import {
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
  PDFString,
  PDFTextField,
  type PDFDocument,
  type PDFField,
} from 'pdf-lib';
import type { NormRect } from '../geometry/norm-rect.ts';
import { loadPdf, toPdfError } from './merge.ts';
import { isSigned, standardFontCharset } from './stamp.ts';
import { normalizeRotation, toVisible, visibleSize } from './stamp-geometry.ts';
import { unsupportedChars } from './winansi.ts';

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list' | 'signature';

export interface FormField {
  /** Voll qualifizierter Name, eindeutig im Formular */
  name: string;
  /** Beschriftung für Menschen: /TU, sonst der Name */
  label: string;
  kind: FieldKind;
  readOnly: boolean;
  required: boolean;
  /** Text, gewählte Optionen oder angehakt */
  value: string | string[] | boolean;
  options: string[];
  multiline: boolean;
  multiselect: boolean;
  maxLength: number | null;
  /** Seite des ersten Widgets (ab 1) und seine Lage auf der sichtbaren Seite */
  page: number | null;
  rect: NormRect | null;
}

export type XfaKind = 'none' | 'hybrid' | 'pure';

export interface FormInfo {
  pages: number;
  signed: boolean;
  xfa: XfaKind;
  fields: FormField[];
}

export type FieldValue = string | string[] | boolean;

/** Fehler mit Code für den Worker (ui/worker-protocol.ts gibt nur den Code weiter) */
export class FormError extends Error {
  readonly code: 'charset' | 'xfa';
  readonly field: string;
  readonly chars: string[];

  constructor(code: 'charset' | 'xfa', field = '', chars: string[] = []) {
    super(`Formular: ${code}`);
    this.name = 'FormError';
    this.code = code;
    this.field = field;
    this.chars = chars;
  }
}

function kindOf(field: PDFField): FieldKind | null {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'list';
  if (field instanceof PDFSignature) return 'signature';
  // Schaltflächen (PDFButton) haben keinen Wert zum Ausfüllen.
  return null;
}

function alternateName(field: PDFField): string | null {
  const tu = field.acroField.dict.lookup(PDFName.of('TU'));
  if (tu instanceof PDFString || tu instanceof PDFHexString) {
    const text = tu.decodeText().trim();
    return text || null;
  }
  return null;
}

function valueOf(field: PDFField): FieldValue {
  if (field instanceof PDFTextField) return field.getText() ?? '';
  if (field instanceof PDFCheckBox) return field.isChecked();
  if (field instanceof PDFRadioGroup) return field.getSelected() ?? '';
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) return field.getSelected();
  return '';
}

function optionsOf(field: PDFField): string[] {
  if (
    field instanceof PDFRadioGroup ||
    field instanceof PDFDropdown ||
    field instanceof PDFOptionList
  ) {
    return field.getOptions();
  }
  return [];
}

/** Seite (ab 1) und Lage des ersten Widgets auf der sichtbaren Seite */
function widgetPlace(doc: PDFDocument, field: PDFField): { page: number; rect: NormRect } | null {
  const widget = field.acroField.getWidgets()[0];
  if (!widget) return null;
  const pages = doc.getPages();
  let index = -1;
  const ref = widget.P();
  if (ref instanceof PDFRef) index = pages.findIndex((p) => p.ref === ref);
  if (index < 0) {
    // /P fehlt oft: dann die Seite suchen, deren /Annots das Widget enthält
    const widgetRef = doc.context.getObjectRef(widget.dict);
    index = pages.findIndex((p) => {
      const annots = p.node.lookup(PDFName.of('Annots'));
      return annots instanceof PDFArray && annots.asArray().some((a) => a === widgetRef);
    });
  }
  const page = pages[index];
  if (!page) return null;
  const box = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const { width, height } = visibleSize(box, rotation);
  const r = widget.getRectangle();
  const a = toVisible(box, rotation, r.x, r.y);
  const b = toVisible(box, rotation, r.x + r.width, r.y + r.height);
  const left = Math.min(a.vx, b.vx);
  const bottom = Math.min(a.vy, b.vy);
  return {
    page: index + 1,
    rect: {
      x: left / width,
      y: 1 - (bottom + Math.abs(b.vy - a.vy)) / height,
      w: Math.abs(b.vx - a.vx) / width,
      h: Math.abs(b.vy - a.vy) / height,
    },
  };
}

/**
 * Erkennt XFA und entfernt es aus dem geladenen Dokument, bevor pdf-lib das Formular liest
 * (pdf-lib täte es sonst selbst, mit einer Warnung in der Konsole). Gemischt heißt: Es gibt
 * zusätzlich AcroForm-Felder, die sich ausfüllen lassen.
 */
function takeXfa(doc: PDFDocument): XfaKind {
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'));
  if (!(acroForm instanceof PDFDict) || !acroForm.has(PDFName.of('XFA'))) return 'none';
  acroForm.delete(PDFName.of('XFA'));
  const fields = acroForm.lookup(PDFName.of('Fields'));
  return fields instanceof PDFArray && fields.size() > 0 ? 'hybrid' : 'pure';
}

export async function readForm(bytes: Uint8Array): Promise<FormInfo> {
  const doc = await loadPdf(bytes);
  try {
    const xfa = takeXfa(doc);
    const all = doc.getForm().getFields();
    const fields: FormField[] = [];
    for (const field of all) {
      const kind = kindOf(field);
      if (!kind) continue;
      const place = widgetPlace(doc, field);
      fields.push({
        name: field.getName(),
        label: alternateName(field) ?? field.getName(),
        kind,
        readOnly: field.isReadOnly(),
        required: field.isRequired(),
        value: valueOf(field),
        options: optionsOf(field),
        multiline: field instanceof PDFTextField && field.isMultiline(),
        multiselect:
          (field instanceof PDFDropdown || field instanceof PDFOptionList) && field.isMultiselect(),
        maxLength: field instanceof PDFTextField ? (field.getMaxLength() ?? null) : null,
        page: place?.page ?? null,
        rect: place?.rect ?? null,
      });
    }
    // In Lesereihenfolge: nach Seite, dann von oben nach unten und links nach rechts
    fields.sort(
      (p, q) =>
        (p.page ?? Infinity) - (q.page ?? Infinity) ||
        Math.round(((p.rect?.y ?? 0) - (q.rect?.y ?? 0)) * 100) ||
        (p.rect?.x ?? 0) - (q.rect?.x ?? 0),
    );
    return {
      pages: doc.getPageCount(),
      signed: isSigned(doc, bytes),
      xfa,
      fields,
    };
  } catch (error) {
    throw toPdfError(error);
  }
}

/**
 * Setzt die Werte (nur für genannte Felder) und speichert. `flatten` schreibt die Felder fest:
 * Sie werden zu normalem Seiteninhalt und lassen sich nicht mehr ändern.
 * Wirft FormError 'charset', wenn ein Text Zeichen außerhalb von WinAnsi enthält, und 'xfa' bei
 * reinen XFA-Formularen. Die Darstellung der geänderten Felder erneuert pdf-lib beim Speichern
 * mit Helvetica; unveränderte Felder behalten ihr Aussehen.
 */
export async function fillForm(
  bytes: Uint8Array,
  values: Readonly<Record<string, FieldValue>>,
  flatten: boolean,
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  // Bei gemischten Formularen fällt der XFA-Teil weg, damit Programme die AcroForm-Felder zeigen.
  if (takeXfa(doc) === 'pure') throw new FormError('xfa');
  const form = doc.getForm();
  const charset = new Set(await standardFontCharset());
  for (const [name, value] of Object.entries(values)) {
    const texts = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
    // Zeilenumbrüche in mehrzeiligen Feldern sind keine Zeichen der Schrift
    const missing = unsupportedChars(texts.join('').replace(/[\r\n\t]/g, ''), charset);
    if (missing.length > 0) throw new FormError('charset', name, missing);
  }
  try {
    for (const [name, value] of Object.entries(values)) {
      const field = form.getFieldMaybe(name);
      if (!field || field.isReadOnly()) continue;
      if (field instanceof PDFTextField && typeof value === 'string') {
        const max = field.getMaxLength();
        field.setText(max === undefined ? value : value.slice(0, max));
      } else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
        if (value === '') field.clear();
        else if (field.getOptions().includes(value)) field.select(value);
      } else if (
        (field instanceof PDFDropdown || field instanceof PDFOptionList) &&
        Array.isArray(value)
      ) {
        const allowed = value.filter((v) => field.getOptions().includes(v));
        if (allowed.length === 0) field.clear();
        else field.select(field.isMultiselect() ? allowed : allowed.slice(0, 1));
      }
    }
    if (flatten) form.flatten();
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
