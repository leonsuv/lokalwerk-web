/**
 * Gemeinsame Helfer für Skripte, die das gebaute Projekt im Browser prüfen (scripts/screenshots.mjs,
 * scripts/perf-werkstatt.mjs): `vite preview` starten und das installierte Google Chrome im
 * Headless-Modus über das DevTools-Protokoll steuern (WebSocket von Node 24). Keine Abhängigkeit.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {(method: string, params?: Record<string, unknown>) => Promise<unknown>} Send
 * @typedef {{
 *   evaluate: (expression: string) => Promise<unknown>,
 *   waitFor: (expression: string, ms?: number) => Promise<void>,
 *   setFiles: (selector: string, files: string[]) => Promise<void>,
 *   setValue: (selector: string, value: string) => Promise<void>,
 *   drag: (selector: string, from: [number, number], to: [number, number]) => Promise<void>,
 *   click: (selector: string, keys?: { shift?: boolean }) => Promise<void>,
 * }} PageApi
 */

export const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome-Pfad über die Umgebungsvariable CHROME, sonst der übliche Pfad unter macOS bzw. Linux */
export function findChrome() {
  const chrome =
    process.env['CHROME'] ??
    [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ].find((p) => existsSync(p));
  if (!chrome) throw new Error('Google Chrome nicht gefunden. Pfad in CHROME angeben.');
  return chrome;
}

export function startPreview(/** @type {string} */ root, /** @type {number} */ port) {
  const vite = join(root, 'node_modules', '.bin', 'vite');
  return spawn(vite, ['preview', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
}

export async function waitForHttp(/** @type {string} */ url, ms = 20000) {
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

export async function startChrome(
  /** @type {string} */ chromePath,
  /** @type {string} */ userDataDir,
) {
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
      `--user-data-dir=${userDataDir}`,
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

/** @returns {PageApi} */
export function pageApi(/** @type {Send} */ send) {
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
    /** Klick mit der Maus in die Mitte des Elements, auf Wunsch mit Umschalt */
    async click(selector, { shift = false } = {}) {
      const [x, y] = /** @type {[number, number]} */ (
        await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2]; })()`)
      );
      const at = { x, y, button: 'left', clickCount: 1, modifiers: shift ? 8 : 0 };
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, buttons: 0 });
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
