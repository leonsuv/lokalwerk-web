/**
 * PDF reparieren (Werkzeug „PDF reparieren“). Reine Logik ohne DOM, läuft im Web Worker und in
 * Tests.
 *
 * Ablauf: Zuerst versucht pdf-lib, die Datei direkt zu öffnen (mit `ignoreEncryption`, nur um
 * Verschlüsselung zu erkennen, und ohne Metadaten). Gelingt das nicht oder fehlen Seiten, wird
 * die Datei abgesucht: jedes `N G obj … endobj` wird übernommen, der Seitenbaum ab dem
 * Dokumentkatalog bzw. dem Wurzel-Seitenknoten durchlaufen und eine neue Datei mit frischer
 * Xref-Tabelle und Trailer gebaut. Daraus kopiert pdf-lib die Seiten, die sich vollständig
 * lesen lassen.
 *
 * Nicht repariert werden: verschlüsselte PDFs, Seiten in komprimierten Objektströmen
 * (ObjStm), wenn die Datei zusätzlich beschädigt ist, Seiten, deren Objekte fehlen, und Dateien
 * ohne lesbaren Seitenbaum. Solche Seiten werden nie erfunden, sie fehlen im Ergebnis und
 * stehen in der Meldung. Details: docs/pdf-lib.md und die Werkzeugseite.
 */

import {
  PDFArray,
  PDFContext,
  PDFDict,
  PDFDocument,
  PDFObject,
  PDFPage,
  PDFRef,
  PDFStream,
} from 'pdf-lib';
import { PdfError } from './merge.ts';

/** Fehler der Reparatur, Codes wie in der Meldungstabelle der Werkzeugseite */
export class RepairError extends Error {
  readonly code: 'nothing-readable';

  constructor(code: 'nothing-readable') {
    super(`Reparatur-Fehler: ${code}`);
    this.name = 'RepairError';
    this.code = code;
  }
}

export interface RepairResult {
  /** Die neue, gültige PDF */
  bytes: Uint8Array;
  /** Seiten, die pdf-lib direkt in der Datei findet; null, wenn die Datei nicht geöffnet werden kann */
  before: number | null;
  /** Seiten im Ergebnis */
  readable: number;
  /** Seitenzahl laut Seitenbaum der Datei (/Count), null, wenn nicht lesbar */
  claimed: number | null;
  /** Positionen im Seitenbaum (ab 1), deren Seite nicht übernommen werden konnte */
  lost: number[];
  /** Seiten, die laut /Count fehlen, aber nicht einzeln im Seitenbaum stehen */
  missing: number;
  /** true, wenn die Datei neu aus ihren Objekten aufgebaut werden musste */
  rebuilt: boolean;
}

/** Ein `N G obj … endobj` in der Datei, Bytepositionen (Ende exklusiv, nach „endobj“) */
export interface PdfObject {
  num: number;
  gen: number;
  start: number;
  end: number;
}

interface Inherited {
  MediaBox?: string;
  CropBox?: string;
  Resources?: string;
  Rotate?: string;
}

const INHERITABLE = ['MediaBox', 'CropBox', 'Resources', 'Rotate'] as const;

/** Ein Blatt des Seitenbaums mit den geerbten Angaben, die die Seite nicht selbst hat */
export interface TreeLeaf {
  num: number;
  /** Geerbte Angaben als Objekttext, nur für Schlüssel, die die Seite selbst nicht hat */
  missing: { key: string; value: string }[];
}

/** Ein Eintrag je Position im Seitenbaum; null, wenn der Eintrag fehlt oder kein Seitenobjekt ist */
export type TreeSlot = TreeLeaf | null;

export interface PageTree {
  slots: TreeSlot[];
  claimed: number | null;
  root: number | null;
}

/** Bytes als Zeichenkette mit einem Zeichen je Byte (Latin-1), damit Positionen Bytepositionen sind */
export function latin1(bytes: Uint8Array): string {
  let text = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return text;
}

/**
 * Alle vollständigen Objekte der Datei. Ein Objekt ohne „endobj“ vor dem nächsten Objektkopf
 * ist abgeschnitten und wird ausgelassen. Bei mehrfachen Nummern gilt die letzte Fassung
 * (inkrementelle Updates).
 */
export function scanObjects(text: string): Map<number, PdfObject> {
  const heads = [...text.matchAll(/\b(\d{1,10})\s+(\d{1,5})\s+obj\b/g)];
  const objects = new Map<number, PdfObject>();
  heads.forEach((head, i) => {
    const start = head.index ?? 0;
    const bodyStart = start + head[0].length;
    const next = heads[i + 1]?.index ?? text.length;
    const endAt = text.indexOf('endobj', bodyStart);
    if (endAt === -1 || endAt > next) return;
    const num = Number(head[1]);
    objects.set(num, { num, gen: Number(head[2]), start, end: endAt + 'endobj'.length });
  });
  return objects;
}

/** Der Teil vor dem ersten „stream“-Schlüsselwort: Wörterbuch des Objekts */
function dictOf(text: string, obj: PdfObject): string {
  const body = text.slice(obj.start, obj.end);
  const at = body.search(/\bstream\b/);
  return at === -1 ? body : body.slice(0, at);
}

function typeOf(dict: string): string | null {
  const m = /\/Type\s*\/([A-Za-z]+)/.exec(dict);
  return m?.[1] ?? null;
}

/**
 * Wert eines Schlüssels aus einem Wörterbuch als Text: Zahl, Referenz, Feld oder
 * Wörterbuch. Null, wenn der Schlüssel fehlt oder nicht gelesen werden kann.
 */
export function valueOf(dict: string, key: string): string | null {
  const head = new RegExp(`/${key}(?![A-Za-z])\\s*`).exec(dict);
  if (!head) return null;
  const at = head.index + head[0].length;
  const open = dict[at];
  if (dict.startsWith('<<', at) || open === '[') {
    const [pairOpen, pairClose] = open === '[' ? ['[', ']'] : ['<<', '>>'];
    let depth = 0;
    for (let i = at; i < dict.length; i++) {
      if (dict.startsWith(pairOpen, i)) {
        depth++;
        i += pairOpen.length - 1;
      } else if (dict.startsWith(pairClose, i)) {
        depth--;
        i += pairClose.length - 1;
        if (depth === 0) return dict.slice(at, i + 1);
      }
    }
    return null;
  }
  const ref = /(\d+)\s+\d+\s+R(?![A-Za-z0-9])/y;
  ref.lastIndex = at;
  const r = ref.exec(dict);
  if (r) return r[0];
  const num = /-?\d+(?:\.\d+)?(?![\d.])/y;
  num.lastIndex = at;
  return num.exec(dict)?.[0] ?? null;
}

function refsIn(text: string): number[] {
  return [...text.matchAll(/(\d+)\s+\d+\s+R(?![A-Za-z0-9])/g)].map((m) => Number(m[1]));
}

const MAX_DEPTH = 64;

/**
 * Durchläuft einen Seitenbaum ab `num`. Jeder Kind-Eintrag wird zu einem Slot: ein Seitenobjekt
 * oder null (fehlt, zeigt auf kein Seitenobjekt, Schleife, zu tief verschachtelt).
 */
function walk(
  text: string,
  objects: Map<number, PdfObject>,
  num: number,
  inherited: Inherited,
  slots: TreeSlot[],
  seen: Set<number>,
  depth: number,
): void {
  const obj = objects.get(num);
  if (!obj || seen.has(num) || depth > MAX_DEPTH) {
    slots.push(null);
    return;
  }
  seen.add(num);
  const dict = dictOf(text, obj);
  const type = typeOf(dict);
  const own: Inherited = {};
  for (const key of INHERITABLE) {
    const value = valueOf(dict, key);
    if (value !== null) own[key] = value;
  }
  if (type === 'Pages') {
    const kids = valueOf(dict, 'Kids');
    const merged = { ...inherited, ...own };
    if (kids === null || !kids.startsWith('[')) return;
    for (const kid of refsIn(kids)) walk(text, objects, kid, merged, slots, seen, depth + 1);
    return;
  }
  if (type !== 'Page') {
    slots.push(null);
    return;
  }
  const effective = { ...inherited, ...own };
  const missing = INHERITABLE.filter(
    (key) => own[key] === undefined && effective[key] !== undefined,
  ).map((key) => ({ key, value: effective[key] ?? '' }));
  slots.push({ num, missing });
}

/** Wurzel-Seitenknoten: Zuerst die Seiten des Katalogs, sonst jeder Seitenknoten ohne Eltern */
function rootCandidates(text: string, objects: Map<number, PdfObject>): number[] {
  const candidates: number[] = [];
  let catalog: PdfObject | undefined;
  for (const obj of objects.values()) {
    const dict = dictOf(text, obj);
    if (typeOf(dict) === 'Catalog') catalog = obj;
  }
  if (catalog) {
    const pages = valueOf(dictOf(text, catalog), 'Pages');
    const num = pages ? Number(/^\d+/.exec(pages)?.[0]) : NaN;
    if (Number.isFinite(num)) candidates.push(num);
  }
  for (const obj of objects.values()) {
    const dict = dictOf(text, obj);
    if (typeOf(dict) === 'Pages' && valueOf(dict, 'Parent') === null) candidates.push(obj.num);
  }
  return [...new Set(candidates)].slice(0, 8);
}

/**
 * Seitenbaum der Datei. Nimmt von den Kandidaten den Wurzelknoten mit den meisten lesbaren
 * Seiten. „claimed“ ist der /Count dieses Knotens, falls er lesbar ist.
 */
export function readPageTree(text: string, objects: Map<number, PdfObject>): PageTree {
  let best: PageTree = { slots: [], claimed: null, root: null };
  let bestReadable = 0;
  for (const root of rootCandidates(text, objects)) {
    const slots: TreeSlot[] = [];
    walk(text, objects, root, {}, slots, new Set(), 0);
    const readable = slots.filter((s) => s !== null).length;
    if (readable <= bestReadable) continue;
    const count = valueOf(dictOf(text, objects.get(root) as PdfObject), 'Count');
    const claimed = count !== null && /^\d+$/.test(count) ? Number(count) : null;
    best = { slots, claimed, root };
    bestReadable = readable;
  }
  return best;
}

/** Schreibt einen Wert als Text in einen Objekttext, direkt nach dem ersten „<<“ */
function inject(objectText: string, entries: string): string {
  const at = objectText.indexOf('<<');
  if (at === -1) return objectText;
  return objectText.slice(0, at + 2) + entries + objectText.slice(at + 2);
}

/**
 * Baut aus den Objekten eine neue, vollständige Datei: Kopfzeile, alle übernommenen Objekte,
 * ein Seitenknoten mit den lesbaren Seiten, ein Katalog und eine frische Xref-Tabelle mit
 * Trailer. Geerbte Angaben (MediaBox, Resources …) werden in die Seite geschrieben, damit sie
 * nach dem Flachziehen des Baums erhalten bleiben.
 */
export function assembleRebuilt(
  text: string,
  objects: Map<number, PdfObject>,
  leaves: TreeLeaf[],
): string {
  const maxNum = Math.max(0, ...objects.keys());
  const pagesNum = maxNum + 1;
  const catalogNum = maxNum + 2;
  const size = maxNum + 3;
  const patched = new Map<number, string>();
  for (const leaf of leaves) {
    const obj = objects.get(leaf.num);
    if (!obj || leaf.missing.length === 0) continue;
    const entries = leaf.missing.map((m) => `/${m.key} ${m.value} `).join('');
    patched.set(leaf.num, inject(text.slice(obj.start, obj.end), entries));
  }
  const header = '%PDF-1.7\n%âãÏÓ\n';
  const parts: string[] = [header];
  const offsets = new Array<number>(size).fill(-1);
  const gens = new Array<number>(size).fill(65535);
  let pos = header.length;
  const keep = [...objects.values()].sort((a, b) => a.num - b.num);
  for (const obj of keep) {
    const body = patched.get(obj.num) ?? text.slice(obj.start, obj.end);
    offsets[obj.num] = pos;
    gens[obj.num] = obj.gen;
    parts.push(body, '\n');
    pos += body.length + 1;
  }
  const kids = leaves.map((l) => `${l.num} 0 R`).join(' ');
  const pagesObj = `${pagesNum} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${leaves.length} >>\nendobj\n`;
  offsets[pagesNum] = pos;
  gens[pagesNum] = 0;
  parts.push(pagesObj);
  pos += pagesObj.length;
  const catalogObj = `${catalogNum} 0 obj\n<< /Type /Catalog /Pages ${pagesNum} 0 R >>\nendobj\n`;
  offsets[catalogNum] = pos;
  gens[catalogNum] = 0;
  parts.push(catalogObj);
  pos += catalogObj.length;
  const xrefAt = pos;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n < size; n++) {
    const off = offsets[n] ?? -1;
    xref +=
      off >= 0
        ? `${String(off).padStart(10, '0')} ${String(gens[n] ?? 0).padStart(5, '0')} n \n`
        : '0000000000 65535 f \n';
  }
  parts.push(
    xref,
    `trailer\n<< /Size ${size} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  );
  return parts.join('');
}

/** Zeichenkette mit Latin-1-Zeichen als Bytes */
export function toBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** Seiten, die pdf-lib direkt aus der Datei lesen kann; null, wenn das nicht geht */
export async function countDirect(bytes: Uint8Array): Promise<number | null> {
  if (bytes.length === 0) throw new PdfError('empty');
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (doc.isEncrypted) throw new PdfError('encrypted');
    return doc.getPageCount();
  } catch (error) {
    if (error instanceof PdfError) throw error;
    return null;
  }
}

interface Copied {
  bytes: Uint8Array;
  readable: number;
  lost: number[];
}

/** Schlüssel, die zurück zur Seite oder zum Baum zeigen und nicht zum Seiteninhalt gehören */
const BACK_LINKS = new Set(['Parent', 'P']);

/**
 * Ob ein Objekt, das die Seite braucht (Inhalt, Schriften, Bilder …), in der Datei fehlt.
 * Rückverweise (/Parent, /P) zählen nicht, sonst würde jede Seite zum ganzen Baum.
 */
export function hasBrokenRef(
  context: PDFContext,
  node: PDFObject,
  seen = new Set<string>(),
): boolean {
  if (node instanceof PDFRef) {
    if (seen.has(node.tag)) return false;
    seen.add(node.tag);
    const target = context.lookup(node);
    if (target === undefined) return true;
    return hasBrokenRef(context, target, seen);
  }
  if (node instanceof PDFStream) return hasBrokenRef(context, node.dict, seen);
  if (node instanceof PDFDict) {
    for (const [key, value] of node.entries()) {
      if (BACK_LINKS.has(key.decodeText())) continue;
      if (hasBrokenRef(context, value, seen)) return true;
    }
    return false;
  }
  if (node instanceof PDFArray) {
    for (let i = 0; i < node.size(); i++) {
      if (hasBrokenRef(context, node.get(i), seen)) return true;
    }
  }
  return false;
}

/**
 * Kopiert Seite für Seite aus `source` in ein neues Dokument. `positions[i]` ist die Position
 * im Seitenbaum der i-ten Quellseite (ab 1). Seiten, die sich nicht kopieren lassen oder deren
 * Objekte fehlen, gehen in `lost`; sie werden nie durch leere Seiten ersetzt.
 */
async function copyPages(source: PDFDocument, positions: number[]): Promise<Copied> {
  const out = await PDFDocument.create({ updateMetadata: false });
  const lost: number[] = [];
  let readable = 0;
  const pages: PDFPage[] = (() => {
    try {
      return source.getPages();
    } catch {
      return [];
    }
  })();
  for (let i = 0; i < positions.length; i++) {
    try {
      const page = pages[i];
      if (!page || hasBrokenRef(source.context, page.node)) throw new Error('broken');
      const [copied] = await out.copyPages(source, [i]);
      if (!copied) throw new Error('copy');
      out.addPage(copied);
      readable++;
    } catch {
      lost.push(positions[i] ?? i + 1);
    }
  }
  return { bytes: await out.save(), readable, lost };
}

interface Attempt extends Copied {
  before: number | null;
  missingCount: number;
}

/**
 * Repariert eine PDF. Wirft PdfError („empty“, „encrypted“) oder RepairError („nothing-readable“),
 * wenn keine Seite zu retten ist.
 */
export async function repairPdf(bytes: Uint8Array): Promise<RepairResult> {
  if (bytes.length === 0) throw new PdfError('empty');
  const text = latin1(bytes);
  const objects = scanObjects(text);
  const tree = readPageTree(text, objects);
  const claimed = tree.claimed;

  let direct: Attempt | null;
  let before: number | null = null;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (doc.isEncrypted) throw new PdfError('encrypted');
    before = doc.getPageCount();
    const positions = Array.from({ length: before }, (_, i) => i + 1);
    const copied = await copyPages(doc, positions);
    direct = {
      ...copied,
      before,
      missingCount: claimed === null ? 0 : Math.max(0, claimed - before),
    };
  } catch (error) {
    if (error instanceof PdfError) throw error;
    direct = null;
  }

  if (direct !== null && direct.readable > 0 && (claimed === null || direct.readable >= claimed)) {
    return finish(direct, claimed, false);
  }
  // Ohne Ergebnis aus pdf-lib: verschlüsselte Dateien nicht aus den Rohobjekten retten.
  if (direct === null && /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(text)) {
    throw new PdfError('encrypted');
  }

  let rebuilt: Attempt | null = null;
  if (tree.root !== null) {
    const leaves = tree.slots.filter((s): s is TreeLeaf => s !== null);
    const positions = tree.slots.flatMap((s, i) => (s === null ? [] : [i + 1]));
    const lostSlots = tree.slots.flatMap((s, i) => (s === null ? [i + 1] : []));
    try {
      const doc = await PDFDocument.load(toBytes(assembleRebuilt(text, objects, leaves)), {
        ignoreEncryption: true,
        updateMetadata: false,
      });
      const copied = await copyPages(doc, positions);
      rebuilt = {
        ...copied,
        before,
        lost: [...lostSlots, ...copied.lost].sort((a, b) => a - b),
        missingCount: claimed === null ? 0 : Math.max(0, claimed - tree.slots.length),
      };
    } catch {
      rebuilt = null;
    }
  }

  // Bei Gleichstand gewinnt der Neuaufbau: er kennt die Positionen der fehlenden Seiten.
  const best = rebuilt !== null && rebuilt.readable >= (direct?.readable ?? 0) ? rebuilt : direct;
  if (best === null || best.readable === 0) throw new RepairError('nothing-readable');
  return finish(best, claimed, best === rebuilt);
}

function finish(attempt: Attempt, claimed: number | null, rebuilt: boolean): RepairResult {
  return {
    bytes: attempt.bytes,
    before: attempt.before,
    readable: attempt.readable,
    claimed,
    lost: attempt.lost,
    missing: attempt.missingCount,
    rebuilt,
  };
}
