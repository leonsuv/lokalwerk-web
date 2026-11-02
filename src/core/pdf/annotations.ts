/**
 * Anmerkungen einer PDF auflisten und entfernen (Werkzeug „PDF-Kommentare entfernen“). Ohne DOM,
 * läuft im Worker.
 *
 * Anmerkungen stehen im Eintrag /Annots jeder Seite (ISO 32000-2, Abschnitt 12.5). Entfernt wird
 * der Verweis aus diesem Array; das Objekt selbst wird gelöscht. Beim Speichern schreibt pdf-lib
 * nur die noch erreichbaren Objekte, frühere Speicherstände fallen ebenfalls weg.
 *
 * Formularfelder (Untertyp Widget) werden nie entfernt: Sie gehören zum Formular. Popup-Fenster
 * werden mit ihrer Notiz oder Markierung entfernt und nicht einzeln angeboten.
 *
 * Anzeigetexte stehen nur in der Liste auf dem Bildschirm; sie verlassen das Gerät nie.
 */

import {
  classifyAnnotation,
  planRemoval,
  shortText,
  type AnnotEntry,
  type AnnotationItem,
  type AnnotationListing,
} from './annotation-model.ts';
export * from './annotation-model.ts';

import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
  type PDFObject,
} from 'pdf-lib';
import { loadPdf } from './merge.ts';

const refKey = (ref: PDFRef): string => `${ref.objectNumber} ${ref.generationNumber}`;

function textOf(value: PDFObject | undefined): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  return null;
}

/** Die Anmerkungen einer Seite in der Reihenfolge von /Annots; ein Eintrag je Position. */
function readPage(
  doc: PDFDocument,
  page: ReturnType<PDFDocument['getPages']>[number],
): { entry: AnnotEntry; text: string | null }[] {
  const annots = page.node.Annots();
  if (!annots) return [];
  const out: { entry: AnnotEntry; text: string | null }[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    const annot = doc.context.lookup(ref);
    if (!(annot instanceof PDFDict)) {
      out.push({ entry: { subtype: '', ref: null, popup: null }, text: null });
      continue;
    }
    const subtype = annot.lookup(PDFName.of('Subtype'));
    const popup = annot.get(PDFName.of('Popup'));
    out.push({
      entry: {
        subtype: subtype instanceof PDFName ? subtype.decodeText() : '',
        ref: ref instanceof PDFRef ? refKey(ref) : null,
        popup: popup instanceof PDFRef ? refKey(popup) : null,
      },
      text: textOf(annot.lookup(PDFName.of('Contents'))),
    });
  }
  return out;
}

/** Listet alle Anmerkungen einer PDF. Popup-Fenster bleiben außen vor, Formularfelder zählen nur. */
export async function listAnnotations(bytes: Uint8Array): Promise<AnnotationListing> {
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  const items: AnnotationItem[] = [];
  let formFields = 0;
  pages.forEach((page, p) => {
    for (const { entry, text } of readPage(doc, page)) {
      const kind = classifyAnnotation(entry.subtype);
      if (kind.group === 'form') formFields++;
      if (kind.group === 'form' || kind.group === 'popup') continue;
      items.push({
        page: p + 1,
        subtype: entry.subtype,
        label: kind.label,
        group: kind.group,
        text: shortText(text),
      });
    }
  });
  return { pages: pages.length, items, formFields };
}

/**
 * Entfernt die Anmerkungen der gewählten Untertypen aus allen Seiten und liefert die neue Datei
 * und die Zahl der entfernten Anmerkungen. Formularfelder bleiben immer erhalten. Wirft PdfError.
 */
export async function removeAnnotations(
  bytes: Uint8Array,
  selected: ReadonlySet<string>,
): Promise<{ bytes: Uint8Array; removed: number }> {
  const doc = await loadPdf(bytes);
  let removed = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const drop = planRemoval(
      readPage(doc, page).map((e) => e.entry),
      selected,
    );
    for (let i = annots.size() - 1; i >= 0; i--) {
      if (!drop.has(i)) continue;
      const ref = annots.get(i);
      annots.remove(i);
      if (ref instanceof PDFRef) doc.context.delete(ref);
    }
    removed += drop.size;
  }
  return { bytes: await doc.save(), removed };
}
