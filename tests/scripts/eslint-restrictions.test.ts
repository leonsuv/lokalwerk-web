import { Linter } from 'eslint';
import globals from 'globals';
import { describe, expect, it } from 'vitest';
import { networkAndStorageRules } from '../../eslint.restrictions.js';

const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, [
    {
      languageOptions: { globals: { ...globals.browser, ...globals.worker } },
      rules: networkAndStorageRules,
    },
  ]);

describe('ESLint-Verbote für src/', () => {
  it.each([
    'fetch("/x")',
    'window.fetch("/x")',
    'globalThis["fetch"]("/x")',
    'new XMLHttpRequest()',
    'new WebSocket("wss://x")',
    'new EventSource("/x")',
    'navigator.sendBeacon("/x", "")',
    'navigator.serviceWorker.register("/sw.js")',
    'localStorage.setItem("a", "b")',
    'window.sessionStorage.clear()',
    'indexedDB.open("x")',
    'caches.open("x")',
    'document.cookie = "a=b"',
  ])('verbietet %s', (code) => {
    expect(lint(code).length).toBeGreaterThan(0);
  });

  it('lässt normalen Code zu', () => {
    expect(lint('const url = URL.createObjectURL(new Blob([]));\nconsole.log(url);')).toEqual([]);
  });
});
