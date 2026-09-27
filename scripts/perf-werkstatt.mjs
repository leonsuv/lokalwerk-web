/**
 * Leistungstest der PDF-Werkstatt (plan-phase3.md Abschnitt 10). Aufruf: `npm run perf:werkstatt`
 * (baut vorher). Nicht Teil von `npm run check`: Zeiten hängen vom Rechner ab.
 *
 * Fünf erzeugte PDFs mit je 100 Seiten (500 Seiten), Chrome headless über das DevTools-Protokoll
 * (scripts/lib/chrome.mjs). Gemessen wird gegen die Ziele aus dem Plan:
 *   - erste sichtbare Vorschaubilder nach der Dateiauswahl: unter 1 s
 *   - keine langen Aufgaben (Long Tasks) über 100 ms beim Scrollen und beim Ziehen
 *   - 100 Seiten verschieben bis zur Anzeige: unter 50 ms
 *   - gezeichnete Vorschaubilder nach dem Scrollen durch alle Seiten: höchstens 200
 *   - Export von 500 Seiten (nur Messwert, kein Ziel im Plan)
 *
 * Drittes Szenario (Abschluss Stufe 2): dieselben Text-PDFs mit Operationen im Arbeitsbereich,
 * Stempel auf allen Seiten von Dokument 1, Seitenzahlen auf Dokument 2, 20 Seiten mit
 * Unterschrift in Dokument 3 und Dokument 4 geschwärzt. Danach dieselben Messungen.
 */

import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  findChrome,
  pageApi,
  startChrome,
  startPreview,
  wait,
  waitForHttp,
} from './lib/chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4194;
const BASE = `http://localhost:${PORT}`;
const DOCS = 5;
const PAGES = 100;
const THUMB_LIMIT = 200;
const work = mkdtempSync(join(tmpdir(), 'lokalwerk-perf-'));

/**
 * Beispiel-PDFs: ohne `scans` Text auf jeder Seite wie bei Schreiben aus dem Büro; mit `scans`
 * trägt jede Seite ein eigenes eingebettetes JPEG wie ein gescanntes Dokument.
 * @param {string} prefix
 * @param {Uint8Array[]} [scans]
 */
async function makePdfs(prefix, scans) {
  const names = ['Vertrag', 'Anlagen', 'Rechnungen', 'Protokoll', 'Handbuch'];
  const files = [];
  for (let d = 0; d < DOCS; d++) {
    const doc = await PDFDocument.create({ updateMetadata: false });
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= PAGES; i++) {
      const page = doc.addPage([595.28, 841.89]);
      const scan = scans?.[(d * PAGES + i) % scans.length];
      if (scan) {
        // Je Seite neu eingebettet: so groß wie echte Scans, nicht einmal geteilt
        const image = await doc.embedJpg(scan);
        page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
      } else {
        for (let l = 0; l < 30; l++) {
          page.drawText('Beispieltext für den Leistungstest der PDF-Werkstatt, Zeile ' + (l + 1), {
            x: 56,
            y: 730 - l * 20,
            size: 11,
            font,
            color: rgb(0.3, 0.32, 0.4),
          });
        }
      }
      page.drawText(`${names[d] ?? 'Dokument'}, Seite ${i}`, {
        x: 56,
        y: 770,
        size: 22,
        font: bold,
      });
    }
    const file = join(work, `${prefix}-${names[d] ?? d}.pdf`);
    writeFileSync(file, await doc.save());
    files.push(file);
  }
  return files;
}

/** Erzeugt im Browser JPEGs in der Art gescannter A4-Seiten (150 dpi), als Base64 */
const SCAN_SCRIPT = `(async () => {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const c = document.createElement('canvas');
    c.width = 1240; c.height = 1754;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, c.width, c.height);
    let seed = 7 + v;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(80,70,60,' + (rnd() * 0.12) + ')'; g.fillRect(rnd() * c.width, rnd() * c.height, 2, 2); }
    g.fillStyle = '#222'; g.font = '28px serif';
    for (let l = 0; l < 48; l++) g.fillText('Gescannte Seite ' + (v + 1) + ', Zeile ' + (l + 1) + ' mit Beispieltext für den Test', 110, 220 + l * 30 + rnd() * 2);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    out.push(btoa(bin));
  }
  return out;
})()`;

/** @typedef {{ name: string, value: string, target: string, ok: boolean | null }} Row */

/**
 * Operationen der Stufe 2 über die Oberfläche anlegen und ihre Dauer messen.
 * @param {import('./lib/chrome.mjs').Send} send
 * @param {ReturnType<typeof pageApi>} p
 * @param {() => Promise<number>} now
 * @param {(from: number, to: number) => Promise<number[]>} longTasks
 * @returns {Promise<Row[]>}
 */
async function applyOps(send, p, now, longTasks) {
  /** @type {Row[]} */
  const rows = [];
  /** Werkzeug über „Werkzeuge“ für das Dokument der ersten Seite von Spalte `col` öffnen */
  const openTool = async (/** @type {number} */ col, /** @type {string} */ label) => {
    await p.evaluate(
      `document.querySelectorAll('.ws-col')[${col}].querySelector('.ws-page').click()`,
    );
    await p.evaluate(`document.querySelector('[data-cmd="tools"]').click()`);
    await p.waitFor(`!document.querySelector('#ws-menu').hidden`);
    await p.evaluate(
      `[...document.querySelectorAll('#ws-menu [role=menuitem]')].find((b) => b.textContent.startsWith(${JSON.stringify(label)})).click()`,
    );
    await p.waitFor(`!document.querySelector('#ws-tool').hidden`);
    await wait(300);
  };
  /** Klick und zwei Bilder später messen (wie „100 Seiten verschieben“) */
  const timedClick = async (/** @type {string} */ expr) =>
    /** @type {number} */ (
      await p.evaluate(
        `(async () => { const t = performance.now(); ${expr}.click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t; })()`,
      )
    );
  const key = async (/** @type {string} */ k) => {
    const code = `Key${k.toUpperCase()}`;
    const vk = k.toUpperCase().charCodeAt(0);
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: k,
      code,
      text: k,
      windowsVirtualKeyCode: vk,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: k,
      code,
      windowsVirtualKeyCode: vk,
    });
  };

  // Stempel (Standard: quer „ENTWURF“) auf alle 100 Seiten von Dokument 1
  await openTool(0, 'Stempel');
  await p.evaluate(
    `(() => { const f = [...document.querySelectorAll('#ws-tool-body input')].find((i) => /seiten/i.test(document.querySelector('label[for="' + i.id + '"]')?.textContent ?? '')); f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  let from = await now();
  const stampMs = await timedClick(`document.querySelector('#ws-tool-body .btn:not(.ghost)')`);
  await wait(2000);
  let long = await longTasks(from, await now());
  rows.push({
    name: 'Stempel auf 100 Seiten bis zur Anzeige',
    value: `${Math.round(stampMs)} ms`,
    target: 'unter 50 ms',
    ok: stampMs < 50,
  });
  rows.push({
    name: 'Lange Aufgaben beim Neuzeichnen danach',
    value: long.length ? `${long.length}, längste ${Math.max(...long)} ms` : 'keine',
    target: 'keine über 100 ms',
    ok: long.every((d) => d <= 100),
  });

  // Seitenzahlen auf Dokument 2 (Standardeinstellung)
  await openTool(1, 'Seitenzahlen');
  const numbersMs = await timedClick(`document.querySelector('#ws-tool-body .btn:not(.ghost)')`);
  rows.push({
    name: 'Seitenzahlen auf 100 Seiten bis zur Anzeige',
    value: `${Math.round(numbersMs)} ms`,
    target: 'unter 50 ms',
    ok: numbersMs < 50,
  });

  // Unterschrift auf Seite 1 von Dokument 3, dann 19-mal duplizieren (D)
  await openTool(2, 'Unterschrift');
  await p.drag('#sig-pad', [0.1, 0.7], [0.9, 0.3]);
  await wait(300);
  await p.evaluate(`document.querySelector('#ws-tool-body .btn:not(.ghost)').click()`);
  await p.waitFor(`document.querySelector('#ws-sign').open`);
  await wait(500);
  await p.evaluate(`document.querySelector('#ws-sign-add').click()`);
  await p.evaluate(`document.querySelector('#ws-sign-ok').click()`);
  await wait(300);
  await p.evaluate(`document.querySelectorAll('.ws-col')[2].querySelector('.ws-page').focus()`);
  for (let i = 0; i < 19; i++) await key('d');
  await wait(1000);
  const signed = /** @type {number} */ (
    await p.evaluate(
      `[...document.querySelectorAll('.ws-ops')].filter((o) => (o.dataset.marks ?? '').includes('sign')).length`,
    )
  );
  rows.push({
    name: 'Seiten mit Unterschrift',
    value: String(signed),
    target: '20',
    ok: signed === 20,
  });

  // Dokument 4 schwärzen: ein Bereich auf Seite 1, gerastert werden alle 100 Seiten
  await openTool(3, 'Schwärzen');
  await p.evaluate(
    `[...document.querySelectorAll('#ws-tool-body .btn')].find((b) => b.textContent.startsWith('Bereiche festlegen')).click()`,
  );
  await p.waitFor(`document.querySelector('#ws-redact').open`);
  await wait(500);
  await p.evaluate(`document.querySelector('#ws-redact-add').click()`);
  await p.evaluate(`document.querySelector('#ws-redact-ok').click()`);
  await wait(200);
  from = await now();
  await p.evaluate(
    `[...document.querySelectorAll('#ws-tool-body .btn')].find((b) => b.textContent.startsWith('Dokument schwärzen')).click()`,
  );
  await p.waitFor(`document.querySelector('#ws-tool').hidden`, 300000);
  const redactMs = (await now()) - from;
  long = await longTasks(from, await now());
  rows.push({
    name: 'Schwärzen von 100 Seiten (200 dpi)',
    value: `${(redactMs / 1000).toFixed(1)} s`,
    target: '–',
    ok: null,
  });
  rows.push({
    name: 'Lange Aufgaben beim Schwärzen',
    value: long.length ? `${long.length}, längste ${Math.max(...long)} ms` : 'keine',
    target: '– (Rastern im Hauptthread)',
    ok: null,
  });
  await wait(1000);
  return rows;
}

/**
 * Misst ein Szenario in einer frisch geladenen Werkstatt.
 * @param {import('./lib/chrome.mjs').Send} send
 * @param {string[]} files
 * @param {boolean} [ops] vor den Messungen Operationen der Stufe 2 anlegen
 * @returns {Promise<Row[]>}
 */
async function measure(send, files, ops = false) {
  const p = pageApi(send);
  /** @type {Row[]} */
  const rows = [];
  await send('Page.navigate', { url: `${BASE}/pdf-werkstatt/` });
  await p.waitFor(`document.readyState === 'complete'`);
  await wait(500);

  const now = async () => /** @type {number} */ (await p.evaluate('performance.now()'));
  /** Lange Aufgaben zwischen zwei Zeitpunkten der Seite */
  const longTasks = async (/** @type {number} */ from, /** @type {number} */ to) =>
    /** @type {number[]} */ (
      await p.evaluate(
        `window.__long.filter(([s]) => s >= ${from} && s <= ${to}).map(([, d]) => Math.round(d))`,
      )
    );
  const canvases = async () =>
    /** @type {number} */ (
      await p.evaluate(
        `[...document.querySelectorAll('.ws-paper canvas')].filter((c) => c.width > 0).length`,
      )
    );

  // 1. Laden bis zu den ersten sichtbaren Vorschaubildern. Zeitpunkte in der Seite selbst
  // (MutationObserver), damit das Abfragen über das Protokoll die Messung nicht verzerrt.
  await p.evaluate(`(() => {
    window.__times = {};
    new MutationObserver(() => {
      const t = performance.now();
      if (!window.__times.tiles && document.querySelectorAll('.ws-page').length === ${DOCS * PAGES}) window.__times.tiles = t;
      if (!window.__times.first && document.querySelector('.ws-paper canvas')) window.__times.first = t;
    }).observe(document.querySelector('#ws-board'), { childList: true, subtree: true });
  })()`);
  const start = await now();
  await p.setFiles('#ws-input', files);
  await p.waitFor(`window.__times.first`, 60000);
  const times = /** @type {{ tiles: number, first: number }} */ (
    await p.evaluate('window.__times')
  );
  const tiles = times.tiles - start;
  const first = times.first - start;
  // Alle Kacheln im sichtbaren Bereich gezeichnet
  await p.waitFor(
    `[...document.querySelectorAll('.ws-page')].filter((t) => { const r = t.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).every((t) => t.querySelector('canvas'))`,
    30000,
  );
  const visible = (await now()) - start;
  rows.push({
    name: 'Alle Kacheln angelegt (500 Seiten)',
    value: `${Math.round(tiles)} ms`,
    target: '–',
    ok: null,
  });
  rows.push({
    name: 'Erste Vorschaubilder sichtbar',
    value: `${Math.round(first)} ms`,
    target: 'unter 1000 ms',
    ok: first < 1000,
  });
  rows.push({
    name: 'Alle sichtbaren Vorschaubilder',
    value: `${Math.round(visible)} ms`,
    target: '–',
    ok: null,
  });

  if (ops) rows.push(...(await applyOps(send, p, now, longTasks)));

  // 2. Scrollen durch alle Spalten mit dem Mausrad; höchste Zahl gleichzeitig gezeichneter Bilder
  await p.evaluate(
    `window.scrollTo(0, document.querySelector('.ws-board').getBoundingClientRect().top + scrollY - 140)`,
  );
  const scrollStart = await now();
  let maxCanvases = 0;
  for (let d = 0; d < DOCS; d++) {
    await p.evaluate(
      `document.querySelectorAll('.ws-col')[${d}].scrollIntoView({ inline: 'nearest', block: 'nearest' })`,
    );
    const box = /** @type {[number, number]} */ (
      await p.evaluate(
        `(() => { const r = document.querySelectorAll('.ws-col-body')[${d}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
      )
    );
    for (let i = 0; i < 40; i++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: box[0],
        y: box[1],
        deltaX: 0,
        deltaY: 450,
      });
      await wait(60);
      if (i % 5 === 0) maxCanvases = Math.max(maxCanvases, await canvases());
    }
    await wait(400);
    maxCanvases = Math.max(maxCanvases, await canvases());
  }
  const scrollLong = await longTasks(scrollStart, await now());
  rows.push({
    name: 'Lange Aufgaben beim Scrollen',
    value: scrollLong.length
      ? `${scrollLong.length}, längste ${Math.max(...scrollLong)} ms`
      : 'keine',
    target: 'keine über 100 ms',
    ok: scrollLong.every((d) => d <= 100),
  });
  rows.push({
    name: 'Gezeichnete Vorschaubilder (höchstens gleichzeitig)',
    value: String(maxCanvases),
    target: `höchstens ${THUMB_LIMIT}`,
    ok: maxCanvases <= THUMB_LIMIT,
  });

  // 3. Ziehen: 20 Seiten aus Spalte 1 in Spalte 2
  await p.evaluate(
    `(() => { const b = document.querySelectorAll('.ws-col-body'); for (const x of b) x.scrollTop = 0; document.querySelector('.ws-board').scrollLeft = 0; })()`,
  );
  await wait(500);
  await p.evaluate(
    `(() => { const t = document.querySelectorAll('.ws-col')[0].querySelectorAll('.ws-page'); t[0].click(); t[19].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); })()`,
  );
  // Umschalt-Klick legt den Fokus auf Seite 20 und scrollt dorthin: wieder nach oben
  await p.evaluate(`document.querySelectorAll('.ws-col-body')[0].scrollTop = 0`);
  await wait(300);
  const dragStart = await now();
  const from = /** @type {[number, number]} */ (
    await p.evaluate(
      `(() => { const t = document.querySelectorAll('.ws-col')[0].querySelectorAll('.ws-page')[1]; t.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
    )
  );
  const to = /** @type {[number, number]} */ (
    await p.evaluate(
      `(() => { const r = document.querySelectorAll('.ws-col')[1].querySelectorAll('.ws-page')[2].getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2, innerHeight]; })()`,
    )
  );
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0], y: from[1] });
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: from[0],
    y: from[1],
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i <= 40; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / 40;
    const y = from[1] + ((to[1] - from[1]) * i) / 40;
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
      button: 'left',
      buttons: 1,
    });
    await wait(16);
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: to[0],
    y: to[1],
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await wait(500);
  const moved = /** @type {number} */ (
    await p.evaluate(`document.querySelectorAll('.ws-col')[1].querySelectorAll('.ws-page').length`)
  );
  const dragLong = await longTasks(dragStart, await now());
  rows.push({
    name: 'Lange Aufgaben beim Ziehen von 20 Seiten',
    value: `${dragLong.length ? `${dragLong.length}, längste ${Math.max(...dragLong)} ms` : 'keine'} (Spalte 2: ${moved} Seiten)`,
    target: 'keine über 100 ms',
    ok: dragLong.every((d) => d <= 100) && moved === PAGES + 20,
  });

  // 4. 100 Seiten verschieben („Verschieben nach …“) bis zur Anzeige (zwei Bilder später)
  await p.evaluate(
    `(() => { const t = document.querySelectorAll('.ws-col')[2].querySelectorAll('.ws-page'); t[0].click(); t[0].focus(); t[99].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); })()`,
  );
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'm',
    code: 'KeyM',
    text: 'm',
    windowsVirtualKeyCode: 77,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'm',
    code: 'KeyM',
    windowsVirtualKeyCode: 77,
  });
  await p.waitFor(`document.querySelector('#ws-move').open`);
  await p.evaluate(
    `(() => { document.querySelectorAll('#ws-move-docs input')[4].checked = true; document.querySelector('#ws-move-pos-end').checked = true; })()`,
  );
  const moveMs = /** @type {number} */ (
    await p.evaluate(
      `(async () => { const t = performance.now(); document.querySelector('#ws-move-ok').click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t; })()`,
    )
  );
  const last = /** @type {number} */ (
    await p.evaluate(`document.querySelectorAll('.ws-col')[4].querySelectorAll('.ws-page').length`)
  );
  rows.push({
    name: '100 Seiten verschieben bis zur Anzeige',
    value: `${Math.round(moveMs)} ms (Ziel-Dokument: ${last} Seiten)`,
    target: 'unter 50 ms',
    ok: moveMs < 50 && last === PAGES + 100,
  });

  // 5. Export aller 500 Seiten als eine neue PDF („Auswahl als neue PDF“)
  await p.evaluate(
    `(() => { const all = document.querySelectorAll('.ws-page'); all[0].click(); all[all.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); })()`,
  );
  const exportMs = /** @type {number} */ (
    await p.evaluate(
      `(async () => { const t = performance.now(); document.querySelector('#toast').textContent = ''; document.querySelector('#ws-export-sel').click(); while (!document.querySelector('#toast').textContent.startsWith('Fertig')) await new Promise((r) => setTimeout(r, 20)); return performance.now() - t; })()`,
    )
  );
  const exported = /** @type {number} */ (
    await p.evaluate(`document.querySelectorAll('.ws-page.sel').length`)
  );
  rows.push({
    name: 'Export von 500 Seiten als neue PDF',
    value: `${(exportMs / 1000).toFixed(1)} s (${exported} Seiten ausgewählt)`,
    target: '–',
    ok: null,
  });

  const heap = /** @type {number | null} */ (
    await p.evaluate(`performance.memory ? performance.memory.usedJSHeapSize : null`)
  );
  if (heap)
    rows.push({
      name: 'JS-Speicher der Seite am Ende',
      value: `${Math.round(heap / 1024 / 1024)} MB`,
      target: '–',
      ok: null,
    });

  return rows;
}

const preview = startPreview(root, PORT);
/** @type {Awaited<ReturnType<typeof startChrome>> | undefined} */
let chrome;
try {
  await waitForHttp(`${BASE}/`);
  chrome = await startChrome(findChrome(), join(work, 'chrome'));
  const { send } = chrome;
  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await send('Browser.setDownloadBehavior', { behavior: 'deny' });
  // Zwischen den Szenarien wird die Werkstatt mit ungesicherter Arbeit verlassen: Warnung bestätigen
  chrome.ws.addEventListener('message', (event) => {
    const raw = /** @type {unknown} */ (JSON.parse(String(event.data)));
    const message = /** @type {{ method?: string }} */ (raw);
    if (message.method === 'Page.javascriptDialogOpening') {
      void send('Page.handleJavaScriptDialog', { accept: true });
    }
  });
  // Lange Aufgaben im Hauptthread mitschreiben, ab dem Laden der Seite
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__long = []; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });`,
  });
  const text = await makePdfs('text');
  await send('Page.navigate', { url: `${BASE}/` });
  await pageApi(send).waitFor(`document.readyState === 'complete'`);
  const scanJpegs = /** @type {string[]} */ (await pageApi(send).evaluate(SCAN_SCRIPT)).map(
    (b64) => new Uint8Array(Buffer.from(b64, 'base64')),
  );
  const scans = await makePdfs('scan', scanJpegs);
  const size = (/** @type {string[]} */ list) =>
    `${(list.reduce((n, f) => n + statSync(f).size, 0) / 1024 / 1024).toFixed(1)} MB`;
  const scenarios = [
    { label: `Text-PDFs (${size(text)})`, files: text },
    { label: `Scans, ein JPEG je Seite (${size(scans)})`, files: scans },
    {
      label: 'Text-PDFs mit Stempel, Seitenzahlen, Unterschriften und einem geschwärzten Dokument',
      files: text,
      ops: true,
    },
  ];
  console.log(
    `\nPDF-Werkstatt, ${DOCS} × ${PAGES} Seiten, Chrome headless, 1440 × 900 bei doppelter Pixeldichte`,
  );
  for (const { label, files, ops } of scenarios) {
    const rows = await measure(send, files, ops);
    const width = Math.max(...rows.map((r) => r.name.length));
    console.log(`\n${label}\n`);
    for (const r of rows) {
      const mark = r.ok === null ? '   ' : r.ok ? 'ok ' : 'NEIN';
      console.log(
        `${mark.padEnd(4)} ${r.name.padEnd(width)}  ${r.value.padEnd(38)}  Ziel: ${r.target}`,
      );
    }
    if (rows.some((r) => r.ok === false)) process.exitCode = 1;
  }
} finally {
  chrome?.ws.close();
  if (chrome) {
    const exited = new Promise((r) => chrome?.proc.once('exit', r));
    chrome.proc.kill('SIGKILL');
    await Promise.race([exited, wait(5000)]);
  }
  preview.kill();
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
