/**
 * Nachstellung älterer Browser für pdf.js (docs/pdfjs-kompatibilitaet.md, Abschnitt 3.4 und 5).
 * Aufruf: `npm run compat:pdfjs` (baut vorher). Nicht Teil von `npm run check`. Nach jedem
 * Update von pdfjs-dist laufen lassen und das Ergebnis im Bericht nennen (AGENTS.md Abschnitt 4).
 *
 * Ohne neue Abhängigkeit: `vite preview` und das installierte Chrome über das DevTools-Protokoll
 * (scripts/lib/chrome.mjs). Chrome-Pfad über die Umgebungsvariable CHROME.
 *
 * 1. Zeichnen: Für jede Umgebung wird eine Kopie des Builds ausgeliefert, in der vor pdf.js
 *    (Hauptthread und Worker) genau die APIs entfernt sind, die dieser Browser laut MDN noch
 *    nicht hat. Jede Seite der Test-PDFs muss Pixel für Pixel wie im unveränderten Browser
 *    aussehen. Nachgestellt werden nur fehlende APIs, nicht die Zeichen-Unterschiede echter
 *    Browser; die prüfen Gerätetests.
 * 2. Meldungen: Mit einem Browser unterhalb der Grenze (ohne Promise.withResolvers) zeigen alle
 *    Werkzeuge mit pdf.js den Hinweis „zu alt“ und nie „Die Datei ist beschädigt …“.
 *
 * Test-PDFs werden hier erzeugt: Text mit Standardschrift, Formular mit Link und gedrehter
 * Seite (pdf-lib), und ein Chrome-Druck mit eingebetteten TrueType-Schriften, Link und JPEG.
 */

import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { degrees, PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { findChrome, pageApi, startChrome, wait, waitForHttp } from './lib/chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4195;
const BASE = `http://localhost:${PORT}`;
const CHROME = findChrome();
if (!existsSync(join(root, 'dist', 'index.html'))) {
  throw new Error('Kein Build gefunden. Erst `npm run build` (oder `npm run compat:pdfjs`).');
}
const work = mkdtempSync(join(tmpdir(), 'lokalwerk-pdfjs-compat-'));

/**
 * Umgebungen: APIs, die fehlen (MDN Browser Compat Data 8.1.3, docs/pdfjs-kompatibilitaet.md
 * Abschnitt 1.2). `expect: 'render'` heißt gleiche Seiten wie im unveränderten Browser,
 * `expect: 'unsupported'` heißt Meldung „zu alt“.
 * @type {{ name: string, missing: string[], expect: 'render' | 'unsupported' }[]}
 */
const ENVS = [
  {
    name: 'Chrome/Edge 125',
    missing: ['getOrInsert', 'sumPrecise', 'promiseTry', 'base64', 'urlParse', 'bytes', 'float16'],
    expect: 'render',
  },
  {
    name: 'Safari 18.0',
    missing: ['getOrInsert', 'sumPrecise', 'promiseTry', 'base64', 'iterator', 'float16'],
    expect: 'render',
  },
  {
    name: 'Firefox 128',
    missing: ['getOrInsert', 'sumPrecise', 'promiseTry', 'base64', 'iterator', 'float16'],
    expect: 'render',
  },
  {
    name: 'Chrome 118 / Safari 17.3 (unter der Grenze)',
    missing: [
      'getOrInsert',
      'sumPrecise',
      'promiseTry',
      'base64',
      'urlParse',
      'bytes',
      'float16',
      'iterator',
      'setMethods',
      'withResolvers',
    ],
    expect: 'unsupported',
  },
];

/** Entfernt APIs im jeweiligen Realm (Seite oder Worker); läuft vor pdf.js */
function prelude(/** @type {string[]} */ missing) {
  return `;(() => { const m = new Set(${JSON.stringify(missing)}); const g = globalThis;
  const IP = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
  const del = (o, ...k) => { for (const x of k) if (o) delete o[x]; };
  if (m.has('getOrInsert')) for (const C of [Map, WeakMap]) del(C.prototype, 'getOrInsert', 'getOrInsertComputed');
  if (m.has('sumPrecise')) del(Math, 'sumPrecise');
  if (m.has('promiseTry')) del(Promise, 'try');
  if (m.has('withResolvers')) del(Promise, 'withResolvers');
  if (m.has('base64')) { del(Uint8Array, 'fromBase64', 'fromHex'); del(Uint8Array.prototype, 'toBase64', 'toHex', 'setFromBase64', 'setFromHex'); }
  if (m.has('urlParse')) del(g.URL, 'parse');
  if (m.has('bytes')) { del(g.Response && Response.prototype, 'bytes'); del(g.Blob && Blob.prototype, 'bytes'); }
  if (m.has('float16')) del(g, 'Float16Array');
  if (m.has('iterator')) del(IP, 'map', 'filter', 'some', 'every', 'find', 'toArray', 'forEach', 'flatMap', 'reduce', 'take', 'drop');
  if (m.has('setMethods')) del(Set.prototype, 'union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom');
})();\n`;
}

// ---------------------------------------------------------------- Test-PDFs

async function pdfLibSamples() {
  const text = await PDFDocument.create({ updateMetadata: false });
  const helvetica = await text.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    text
      .addPage([595, 842])
      .drawText(`Seite ${i}: Beispieltext`, { x: 50, y: 760, size: 24, font: helvetica });
  }
  const form = await PDFDocument.create({ updateMetadata: false });
  const font = await form.embedFont(StandardFonts.Helvetica);
  const p1 = form.addPage([595, 842]);
  p1.drawText('Formular mit Feldern und Link', { x: 50, y: 780, size: 20, font });
  const fields = form.getForm();
  const name = fields.createTextField('name');
  name.setText('Anna Beispiel');
  name.addToPage(p1, { x: 50, y: 700, width: 250, height: 24 });
  const ok = fields.createCheckBox('ok');
  ok.check();
  ok.addToPage(p1, { x: 50, y: 650, width: 20, height: 20 });
  const link = form.context.register(
    form.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [50, 600, 250, 620],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://example.org/') },
    }),
  );
  p1.node.set(
    PDFName.of('Annots'),
    form.context.obj([...(p1.node.Annots()?.asArray() ?? []), link]),
  );
  const p2 = form.addPage([595, 842]);
  p2.drawText('Gedrehte Seite', { x: 50, y: 700, size: 30, font });
  p2.setRotation(degrees(90));
  const files = [
    ['text.pdf', await text.save()],
    ['formular-link-gedreht.pdf', await form.save()],
  ];
  return files.map(([file, bytes]) => {
    const path = join(work, /** @type {string} */ (file));
    writeFileSync(path, /** @type {Uint8Array} */ (bytes));
    return path;
  });
}

/** Chrome-Druck: eingebettete TrueType-Teilschriften (Math.sumPrecise im Worker), Link, JPEG */
async function printedSample(
  /** @type {import('./lib/chrome.mjs').PageApi} */ p,
  /** @type {import('./lib/chrome.mjs').Send} */ send,
) {
  await send('Page.navigate', { url: 'about:blank' });
  await p.waitFor(`document.readyState === 'complete'`);
  await p.evaluate(`(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 150;
    const g = c.getContext('2d'); g.fillStyle = '#3a55e0'; g.fillRect(0, 0, 300, 150); g.fillStyle = '#17935a'; g.fillRect(150, 0, 150, 150);
    document.body.innerHTML = '<h1 style="font-family:serif">Mietvertrag Beispiel</h1><p style="font-family:sans-serif">Umlaute äöü ÄÖÜ ß und das Eurozeichen €.</p><p style="font-family:monospace">0123456789</p><p><a href="https://example.org/">Link</a></p><img src="' + c.toDataURL('image/jpeg', 0.9) + '"><h2 style="page-break-before:always;font-family:sans-serif">Seite 2</h2>';
    return true; })()`);
  const { data } = /** @type {{ data: string }} */ (
    await send('Page.printToPDF', { printBackground: true })
  );
  const path = join(work, 'druck-truetype.pdf');
  writeFileSync(path, Buffer.from(data, 'base64'));
  return path;
}

// ---------------------------------------------------------------- Ablauf

/** Kopie des Builds mit Vorspann vor pdf.js, ausgeliefert mit den Produktions-Headern */
function serve(/** @type {string} */ name, /** @type {string} */ before) {
  const dir = join(work, name.replace(/\W+/g, '-'));
  cpSync(join(root, 'dist'), dir, { recursive: true });
  const assets = readdirSync(join(dir, 'assets'));
  const chunks = assets.filter((f) => /^pdfjs(\.worker)?-[\w-]+\.js$/.test(f));
  if (chunks.length !== 2)
    throw new Error(`pdf.js-Dateien im Build nicht gefunden: ${chunks.join(', ')}`);
  for (const f of chunks) {
    const file = join(dir, 'assets', f);
    writeFileSync(file, before + readFileSync(file, 'utf8'));
  }
  const vite = join(root, 'node_modules', '.bin', 'vite');
  const proc = spawn(vite, ['preview', '--port', String(PORT), '--strictPort', '--outDir', dir], {
    cwd: root,
    stdio: 'ignore',
  });
  return { proc, main: chunks.find((f) => !f.includes('worker')) ?? '' };
}

/** Zeichnet alle Seiten aller Test-PDFs; Fingerabdruck je Seite oder Fehlertext */
async function renderAll(
  /** @type {import('./lib/chrome.mjs').PageApi} */ p,
  /** @type {string} */ main,
  /** @type {string[]} */ files,
) {
  /** @type {Record<string, string[] | string>} */
  const out = {};
  for (const file of files) {
    const b64 = readFileSync(file).toString('base64');
    const result = /** @type {{ pages?: string[], error?: string }} */ (
      await p.evaluate(`(async () => { try {
        const m = await import('/assets/${main}');
        const doc = await m.openPdf(Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0)));
        const pages = [];
        for (let n = 1; n <= doc.numPages; n++) pages.push((await m.renderPageAt(doc, n, { scale: 1, background: '#fff' })).toDataURL('image/png'));
        await m.closePdf(doc);
        return { pages };
      } catch (e) { return { error: (e && (e.code || e.name)) + ': ' + String(e && e.message).slice(0, 120) }; } })()`)
    );
    const name = file.split('/').pop() ?? file;
    out[name] =
      result.error ?? (result.pages ?? []).map((d) => createHash('sha256').update(d).digest('hex'));
  }
  return out;
}

/** @type {Array<[string, string, 'preview' | 'tool']>} */
const TOOLS = [
  ['/pdf-seiten-bearbeiten/', '#org-input', 'preview'],
  ['/pdf-formular-ausfuellen/', '#form-input', 'preview'],
  ['/pdf-werkstatt/', '#ws-input', 'preview'],
  ['/pdf-schwaerzen/', '#red-input', 'tool'],
  ['/pdf-zu-bildern/', '#img-input', 'tool'],
  ['/pdf-unterschreiben/', '#sig-input', 'tool'],
];
const TOO_OLD = /Dein Browser ist zu alt für (die Vorschau|dieses Werkzeug)\./;

/** @type {string[]} */
const failures = [];
/** @type {Awaited<ReturnType<typeof startChrome>> | undefined} */
let chrome;
/** @type {import('node:child_process').ChildProcess | undefined} */
let preview;
try {
  chrome = await startChrome(CHROME, join(work, 'chrome'));
  const { send } = chrome;
  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');
  chrome.ws.addEventListener('message', (event) => {
    const raw = /** @type {unknown} */ (JSON.parse(String(event.data)));
    const m = /** @type {{ method?: string }} */ (raw);
    if (m.method === 'Page.javascriptDialogOpening')
      void send('Page.handleJavaScriptDialog', { accept: true });
  });
  const p = pageApi(send);
  const files = [...(await pdfLibSamples()), await printedSample(p, send)];

  // 1. Zeichnen
  /** @type {Record<string, string[] | string> | undefined} */
  let reference;
  for (const env of [{ name: 'unveränderter Browser', missing: [], expect: 'render' }, ...ENVS]) {
    const served = serve(env.name, prelude(env.missing));
    preview = served.proc;
    await waitForHttp(`${BASE}/`);
    await send('Page.navigate', { url: `${BASE}/pdf-seiten-bearbeiten/` });
    await p.waitFor(`document.readyState === 'complete'`);
    const result = await renderAll(p, served.main, files);
    preview.kill();
    await wait(300);
    reference ??= result;
    const lines = Object.entries(result).map(([file, r]) => {
      const ref = reference?.[file];
      if (typeof r === 'string') {
        const fine = env.expect === 'unsupported' && r.startsWith('unsupported');
        if (!fine) failures.push(`${env.name}, ${file}: ${r}`);
        return `${file}: ${fine ? 'Meldung „zu alt“' : `FEHLER ${r}`}`;
      }
      if (env.expect === 'unsupported') {
        failures.push(`${env.name}, ${file}: gezeichnet statt „zu alt“`);
        return `${file}: gezeichnet, erwartet war „zu alt“`;
      }
      const diff = Array.isArray(ref) ? r.filter((h, i) => h !== ref[i]).length : r.length;
      if (diff > 0)
        failures.push(`${env.name}, ${file}: ${diff} Seiten anders als im unveränderten Browser`);
      return `${file}: ${diff === 0 ? `${r.length} Seiten gleich` : `${diff} von ${r.length} Seiten ANDERS`}`;
    });
    console.log(`${env.name}\n  ${lines.join('\n  ')}`);
  }

  // 2. Meldungen in den Werkzeugen unter der Grenze
  const { identifier } = /** @type {{ identifier: string }} */ (
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'delete Promise.withResolvers;' })
  );
  const served = serve('meldungen', '');
  preview = served.proc;
  await waitForHttp(`${BASE}/`);
  console.log('Meldungen ohne Promise.withResolvers (unter der Grenze)');
  for (const [url, input, kind] of TOOLS) {
    await send('Page.navigate', { url: BASE + url });
    await p.waitFor(`document.readyState === 'complete'`);
    // Formular ausfüllen braucht eine PDF mit Feldern, sonst gilt die Datei nicht als geladen
    await p.setFiles(input, [(url.includes('formular') ? files[1] : files[0]) ?? '']);
    await wait(2500);
    const text = /** @type {string} */ (
      await p.evaluate(`document.querySelector('main').innerText`)
    );
    const note = /** @type {string} */ (
      await p.evaluate(
        `document.querySelector('.pdfjs-unsupported:not([hidden])')?.textContent ?? ''`,
      )
    );
    const problems = [];
    if (!TOO_OLD.test(note)) problems.push('kein Hinweis „zu alt“');
    if (/beschädigt/.test(text)) problems.push('„beschädigt“ wird angezeigt');
    if (kind === 'preview' && !note.includes('Speichern funktioniert trotzdem.'))
      problems.push('Zusatz „Speichern funktioniert trotzdem.“ fehlt');
    if (kind === 'tool' && !note.includes('dieses Werkzeug'))
      problems.push('Hinweis für das Werkzeug fehlt');
    for (const problem of problems) failures.push(`${url}: ${problem}`);
    console.log(`  ${url}: ${problems.length === 0 ? `„${note.trim()}“` : problems.join('; ')}`);
  }
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
} finally {
  preview?.kill();
  chrome?.ws.close();
  if (chrome) {
    const exited = new Promise((r) => chrome?.proc.once('exit', r));
    chrome.proc.kill();
    await Promise.race([exited, wait(5000)]);
  }
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} Abweichung(en):\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('\nAlle Umgebungen wie erwartet.');
}
