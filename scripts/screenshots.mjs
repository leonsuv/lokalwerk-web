/**
 * Screenshots für die README (docs/screenshots/), reproduzierbar aus dem lokalen Build.
 * Aufruf: `npm run screenshots` (baut vorher). Nicht Teil von `npm run check`.
 *
 * Ohne neue Abhängigkeit: startet `vite preview` und das installierte Google Chrome im
 * Headless-Modus und steuert es über das DevTools-Protokoll (WebSocket von Node 24).
 * Chrome-Pfad über die Umgebungsvariable CHROME, sonst der übliche Pfad unter macOS bzw. Linux.
 *
 * Reproduzierbar: festes Datum (Montag, 28.09.2026, 10:00 Uhr) in der Seite, feste Fenstergröße,
 * alle Eingabedateien werden hier erzeugt (Beispiel-PDF mit pdf-lib, Landschaften per Canvas im
 * Browser, Überweisungsliste aus den Beispieldaten des Projekts). Keine echten Personen, keine
 * echten Kontodaten (IBANs aus docs/beispiel-ibans.md), keine lokalen Pfade in den Bildern.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * @typedef {(method: string, params?: Record<string, unknown>) => Promise<unknown>} Send
 * @typedef {{
 *   evaluate: (expression: string) => Promise<unknown>,
 *   waitFor: (expression: string, ms?: number) => Promise<void>,
 *   setFiles: (selector: string, files: string[]) => Promise<void>,
 *   setValue: (selector: string, value: string) => Promise<void>,
 *   drag: (selector: string, from: [number, number], to: [number, number]) => Promise<void>,
 * }} PageApi
 * @typedef {{ width: number, height: number, mobile: boolean }} View
 * @typedef {{
 *   name: string,
 *   url: string,
 *   view: View,
 *   themes: ReadonlyArray<'hell' | 'dunkel'>,
 *   prepare: (p: PageApi) => Promise<unknown>,
 * }} Shot
 * @typedef {[[number, number], [number, number]]} Box Rahmen als Anteile der Seite: oben links, unten rechts
 * @typedef {{ pdf: string, redact: Box[], csv: string, photos: string[] }} InputFiles
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'screenshots');
const PORT = 4193;
const BASE = `http://localhost:${PORT}`;
const FIXED_NOW = '2026-09-28T10:00:00+02:00';

const CHROME =
  process.env['CHROME'] ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));
if (!CHROME) throw new Error('Google Chrome nicht gefunden. Pfad in CHROME angeben.');
if (!existsSync(join(root, 'dist', 'index.html'))) {
  throw new Error('Kein Build gefunden. Erst `npm run build` (oder `npm run screenshots`).');
}

const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const work = mkdtempSync(join(tmpdir(), 'lokalwerk-screenshots-'));

// ---------------------------------------------------------------- Eingabedateien

/**
 * Beispiel-PDF zum Schwärzen: ein Protokoll mit Beispielnamen und einer Beispiel-IBAN. Gibt die
 * Lage von Name und IBAN auf der Seite zurück, aus den Schriftmaßen berechnet.
 * @returns {Promise<{ file: string, redact: Box[] }>}
 */
async function makeSamplePdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.2);
  let y = 770;
  const { width: pageWidth, height: pageHeight } = page.getSize();
  /** @type {Box[]} */
  const targets = [];
  /** Rahmen um `part` innerhalb von `text` in der Zeile, die als Nächstes geschrieben wird */
  const mark = (/** @type {string} */ text, /** @type {string} */ part, size = 11) => {
    const x = 60 + font.widthOfTextAtSize(text.slice(0, text.indexOf(part)), size);
    const w = font.widthOfTextAtSize(part, size);
    const pad = 3;
    targets.push([
      [(x - pad) / pageWidth, (pageHeight - y - size - pad) / pageHeight],
      [(x + w + 2 * pad) / pageWidth, (pageHeight - y + pad + 1) / pageHeight],
    ]);
  };
  /**
   * @param {string} text
   * @param {number} size
   * @param {import('pdf-lib').PDFFont} f
   * @param {number} gap
   */
  const line = (text, size = 11, f = font, gap = 18) => {
    page.drawText(text, { x: 60, y, size, font: f, color: ink });
    y -= gap;
  };
  line('Förderverein Beispiel e.V.', 10, font, 30);
  line('Protokoll der Mitgliederversammlung', 18, bold, 34);
  line('Datum: 14. September 2026, 19:00 Uhr, Vereinsheim', 11, font, 28);
  line('1. Kassenbericht', 13, bold, 22);
  mark('Die Kassenwartin Anna Beispiel stellt den Kassenbericht vor.', 'Anna Beispiel');
  line('Die Kassenwartin Anna Beispiel stellt den Kassenbericht vor.');
  line('Kontostand zum 31. August 2026: 4.812,35 Euro.');
  mark('Vereinskonto: DE50 3456 7890 0123 4567 89', 'DE50 3456 7890 0123 4567 89');
  line('Vereinskonto: DE50 3456 7890 0123 4567 89', 11, font, 28);
  line('2. Beschlüsse', 13, bold, 22);
  line('Der Mitgliedsbeitrag bleibt unverändert bei 36 Euro im Jahr.');
  line('Das Sommerfest findet am 4. Juli 2027 statt.', 11, font, 28);
  line('3. Verschiedenes', 13, bold, 22);
  line('Rückfragen an den Vorstand per E-Mail.');
  const file = join(work, 'protokoll-beispiel.pdf');
  writeFileSync(file, await doc.save());
  return { file, redact: targets };
}

/** Überweisungsliste aus den Beispieldaten des Projekts, dazu eine Zeile mit Akzenten */
function makeTransferCsv() {
  const rows = [
    ['Empfänger', 'IBAN', 'Betrag', 'Verwendungszweck'],
    [
      'Sportverein Musterstadt e.V.',
      'DE89 3704 0044 0532 0130 00',
      '120,00',
      'Hallenmiete September',
    ],
    ['Anna Beispiel', 'DE50345678900123456789', '45,50', 'Auslagen Sommerfest'],
    ['Kiosk am Markt GmbH', 'DE89 1234 5678 1049 6387 12', '1.234,56', 'Rechnung 2026-117'],
    ['Tom Test', 'DE69234567891234567801', '30', 'Fahrtkosten'],
    ['Gärtnerei Grün', 'AT611904300234573201', '89,90', 'Rechnung 88'],
    ['Café Lumière', 'DE15 8765 4321 0000 2020 51', '64,00', 'Crêpes für das Sommerfest'],
  ];
  const bom = String.fromCodePoint(0xfeff);
  const file = join(work, 'ueberweisungen-beispiel.csv');
  writeFileSync(file, `${bom}${rows.map((r) => r.join(';')).join('\r\n')}\r\n`);
  return file;
}

/** Gezeichnete Landschaften ohne Personen, im Browser erzeugt (deterministisch) */
const LANDSCAPE_SCRIPT = `(async () => {
  const palettes = [
    ['#8ec5fc', '#e0c3fc', '#f6d365', '#4b7f52', '#2f5d3a', '#1e3d28'],
    ['#fda085', '#f6d365', '#fff1c1', '#8a6f4d', '#5c4a36', '#3b2f24'],
    ['#1e3c72', '#2a5298', '#f5f7fa', '#3d5a80', '#293241', '#1b2432'],
    ['#a1c4fd', '#c2e9fb', '#fff9c4', '#6a994e', '#386641', '#1f3d24'],
  ];
  const out = [];
  for (const [i, p] of palettes.entries()) {
    const c = document.createElement('canvas');
    c.width = 3000; c.height = 2000;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 1300);
    sky.addColorStop(0, p[0]); sky.addColorStop(1, p[1]);
    g.fillStyle = sky; g.fillRect(0, 0, 3000, 2000);
    g.fillStyle = p[2]; g.beginPath(); g.arc(2200 - i * 350, 520 + i * 60, 170, 0, Math.PI * 2); g.fill();
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = p[3 + layer];
      g.beginPath(); g.moveTo(0, 2000);
      for (let x = 0; x <= 3000; x += 20) {
        const y = 1050 + layer * 280 + Math.sin(x / (420 - layer * 90) + i + layer) * (160 - layer * 30)
          + Math.sin(x / 97 + layer * 3) * 18;
        g.lineTo(x, y);
      }
      g.lineTo(3000, 2000); g.closePath(); g.fill();
    }
    let seed = 7 + i;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let k = 0; k < 4000; k++) g.fillRect(rnd() * 3000, rnd() * 2000, 2, 2);
    out.push(c.toDataURL('image/jpeg', 0.95).split(',')[1]);
  }
  return out;
})()`;

// ---------------------------------------------------------------- Server und Browser

function startPreview() {
  const vite = join(root, 'node_modules', '.bin', 'vite');
  return spawn(vite, ['preview', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
}

async function waitForHttp(/** @type {string} */ url, ms = 20000) {
  for (let t = 0; t < ms; t += 250) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // noch nicht bereit
    }
    await wait(250);
  }
  throw new Error(`${url} antwortet nicht`);
}

async function startChrome(/** @type {string} */ chromePath) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--lang=de-DE',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${join(work, 'chrome')}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  /** @type {string | undefined} */
  let wsUrl;
  for (let t = 0; t < 15000 && !wsUrl; t += 200) {
    try {
      const list = /** @type {{ type: string, webSocketDebuggerUrl?: string }[]} */ (
        await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      );
      wsUrl = list.find((x) => x.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      await wait(200);
    }
  }
  if (!wsUrl) throw new Error('Chrome startet nicht');
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  /** @type {Map<number, (m: { error?: { message: string }, result?: unknown }) => void>} */
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const raw = /** @type {unknown} */ (JSON.parse(String(e.data)));
    const m = /** @type {{ id?: number, error?: { message: string }, result?: unknown }} */ (raw);
    const done = m.id === undefined ? undefined : pending.get(m.id);
    if (m.id !== undefined && done) {
      pending.delete(m.id);
      done(m);
    }
  });
  /** @type {Send} */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (m) =>
        m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result),
      );
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { proc, ws, send };
}

// ---------------------------------------------------------------- Schritte

/** @returns {PageApi} */
function pageApi(/** @type {Send} */ send) {
  /** @param {string} expression */
  const evaluate = async (expression) => {
    const r = /** @type {{ result: { value?: unknown }, exceptionDetails?: { text: string } }} */ (
      await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    );
    if (r.exceptionDetails) throw new Error(`Fehler in der Seite: ${r.exceptionDetails.text}`);
    return r.result.value;
  };
  /** @param {string} expression */
  const waitFor = async (expression, ms = 15000) => {
    for (let t = 0; t < ms; t += 100) {
      if (await evaluate(`!!(${expression})`)) return;
      await wait(100);
    }
    throw new Error(`Zeitüberschreitung: ${expression}`);
  };
  /** @param {string} selector */
  const nodeId = async (selector) => {
    const doc = /** @type {{ root: { nodeId: number } }} */ (
      await send('DOM.getDocument', { depth: -1 })
    );
    const found = /** @type {{ nodeId: number }} */ (
      await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector })
    );
    if (!found.nodeId) throw new Error(`Nicht gefunden: ${selector}`);
    return found.nodeId;
  };
  return {
    evaluate,
    waitFor,
    async setFiles(selector, files) {
      await send('DOM.setFileInputFiles', { nodeId: await nodeId(selector), files });
    },
    async setValue(selector, value) {
      await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
        e.value = ${JSON.stringify(value)};
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    },
    /** Ziehen mit der Maus, Koordinaten als Anteile des Elements */
    async drag(selector, [x1, y1], [x2, y2]) {
      const box = /** @type {[number, number, number, number]} */ (
        await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
          return [r.left, r.top, r.width, r.height]; })()`)
      );
      const [l, t, w, h] = box;
      const a = { x: l + x1 * w, y: t + y1 * h };
      const b = { x: l + x2 * w, y: t + y2 * h };
      const mouse = { button: 'left', clickCount: 1 };
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...a, ...mouse, buttons: 1 });
      for (const f of [0.33, 0.66, 1]) {
        const at = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at, ...mouse, buttons: 1 });
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...b, ...mouse, buttons: 0 });
    },
  };
}

// ---------------------------------------------------------------- Aufnahmen

/** @type {View} */
const DESKTOP = { width: 1280, height: 800, mobile: false };
/** @type {View} */
const PHONE = { width: 390, height: 844, mobile: true };
const BOTH = /** @type {const} */ (['hell', 'dunkel']);
const LIGHT = /** @type {const} */ (['hell']);

/** @returns {Shot[]} */
function shots(/** @type {InputFiles} */ files) {
  return [
    {
      name: 'startseite',
      url: '/',
      view: DESKTOP,
      themes: BOTH,
      prepare: (p) => p.waitFor(`document.querySelector('.local-pill')`),
    },
    {
      name: 'werkzeuge-suche',
      url: '/werkzeuge/',
      view: DESKTOP,
      themes: BOTH,
      prepare: async (p) => {
        await p.waitFor(`!document.querySelector('#tool-search').hidden`);
        await p.setValue('#tool-search-input', 'pdf');
        await wait(300);
      },
    },
    {
      name: 'sepa',
      url: '/sepa-sammelueberweisung/',
      view: { ...DESKTOP, height: 1100 },
      themes: BOTH,
      prepare: async (p) => {
        await p.setFiles('#sepa-input', [files.csv]);
        await p.waitFor(`document.querySelectorAll('table tbody tr').length >= 6`);
        await p.setValue('#s-name', 'Förderverein Beispiel e.V.');
        await p.setValue('#s-iban', 'DE69 2345 6789 1234 5678 00');
        await wait(500);
        // Bei 1280 px scrollt die Tabelle in ihrem Rahmen; ganz rechts stehen Fehler und Hinweise
        await p.evaluate(`(() => { window.scrollTo(0, 0);
          const wrap = document.querySelector('#sepa-table').parentElement;
          wrap.scrollLeft = wrap.scrollWidth; })()`);
        await wait(300);
      },
    },
    {
      name: 'pdf-schwaerzen',
      url: '/pdf-schwaerzen/',
      view: { ...DESKTOP, height: 1000 },
      themes: BOTH,
      prepare: async (p) => {
        await p.setFiles('#red-input', [files.pdf]);
        await p.waitFor(
          `!document.querySelector('#red-editor').hidden && document.querySelector('#red-canvas').width > 100`,
        );
        await wait(800);
        await p.evaluate(`window.scrollTo(0, 0)`);
        await wait(300);
        // Name der Kassenwartin und Kontonummer schwärzen
        for (const [from, to] of files.redact) await p.drag('#red-layer', from, to);
        await p.evaluate(`document.activeElement?.blur()`);
        await wait(400);
      },
    },
    {
      name: 'fotos-verkleinern',
      url: '/fotos-verkleinern/',
      view: { ...DESKTOP, height: 1000 },
      themes: BOTH,
      prepare: async (p) => {
        await p.setFiles('#img-input', files.photos);
        await p.waitFor(
          `document.querySelectorAll('#img-list img').length >= 4 && !/^0 B$/.test(document.querySelector('#img-saved').textContent)`,
          30000,
        );
        await wait(800);
      },
    },
    {
      name: 'kontrast-pruefen',
      url: '/kontrast-pruefen/',
      view: DESKTOP,
      themes: BOTH,
      prepare: async (p) => {
        await p.setValue('#con-fg', '#5A6380');
        await p.setValue('#con-bg', '#FFFFFF');
        await p.waitFor(`document.querySelector('#con-ratio').textContent.trim() !== '–'`);
        await wait(300);
      },
    },
    {
      name: 'handy-startseite',
      url: '/',
      view: PHONE,
      themes: LIGHT,
      prepare: (p) => p.waitFor(`document.querySelector('.local-pill')`),
    },
    {
      name: 'handy-arbeitstage',
      url: '/arbeitstage/',
      view: PHONE,
      themes: LIGHT,
      prepare: async (p) => {
        await p.setValue('#wd-land', 'BY');
        await p.waitFor(`document.querySelector('#wd-workdays').textContent.trim() !== '–'`);
        await p.evaluate(
          `document.querySelector('.card.side').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70)`,
        );
        await wait(300);
      },
    },
  ];
}

// ---------------------------------------------------------------- Ablauf

const preview = startPreview();
/** @type {Awaited<ReturnType<typeof startChrome>> | undefined} */
let chrome;
try {
  await waitForHttp(`${BASE}/`);
  chrome = await startChrome(CHROME);
  const { send } = chrome;
  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');
  // Festes Datum in jeder Seite (vor den Skripten der Seite, unabhängig von der CSP)
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { const fixed = new Date(${JSON.stringify(FIXED_NOW)}).getTime(); const Real = Date;
      class FixedDate extends Real { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
      FixedDate.UTC = Real.UTC; FixedDate.parse = Real.parse; globalThis.Date = FixedDate; })();`,
  });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Berlin' });

  const p = pageApi(send);
  const photos = /** @type {string[]} */ (await p.evaluate(LANDSCAPE_SCRIPT));
  const sample = await makeSamplePdf();
  /** @type {InputFiles} */
  const files = {
    pdf: sample.file,
    redact: sample.redact,
    csv: makeTransferCsv(),
    photos: photos.map((b64, i) => {
      const file = join(work, `landschaft-${i + 1}.jpg`);
      writeFileSync(file, Buffer.from(b64, 'base64'));
      return file;
    }),
  };

  mkdirSync(outDir, { recursive: true });
  /** @type {string[]} */
  const written = [];
  for (const shot of shots(files)) {
    for (const theme of shot.themes) {
      const { width, height, mobile } = shot.view;
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'prefers-color-scheme', value: theme === 'dunkel' ? 'dark' : 'light' },
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ],
      });
      await send('Page.navigate', { url: `${BASE}${shot.url}` });
      await p.waitFor(`document.readyState === 'complete'`);
      await p.evaluate(`document.fonts.ready.then(() => true)`);
      await shot.prepare(p);
      const shotData = /** @type {{ data: string }} */ (
        await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false })
      );
      const file = join(outDir, `${shot.name}-${theme}.png`);
      writeFileSync(file, Buffer.from(shotData.data, 'base64'));
      written.push(file);
    }
  }
  let total = 0;
  for (const file of written) {
    const size = statSync(file).size;
    total += size;
    console.log(`${(size / 1024).toFixed(0).padStart(5)} KB  ${file.slice(root.length + 1)}`);
  }
  console.log(`${(total / 1024).toFixed(0).padStart(5)} KB  zusammen (${written.length} Dateien)`);
} finally {
  chrome?.ws.close();
  if (chrome) {
    const exited = new Promise((r) => chrome?.proc.once('exit', r));
    chrome.proc.kill();
    await Promise.race([exited, wait(5000)]);
  }
  preview.kill();
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
