/**
 * ESLint-Regeln, die Netzwerkzugriffe, Tracking-Wege und Browser-Speicher im
 * ausgelieferten Code verbieten (AGENTS.md Regel 1, 3 und 5; plan.md Abschnitt 5).
 * Eigene Datei, damit tests/scripts/eslint-restrictions.test.ts sie direkt prüfen kann.
 *
 * Browser-Speicher ist nur auf ausdrücklichen Wunsch des Nutzers erlaubt; in Phase 1
 * gibt es keinen solchen Fall. Eine spätere Ausnahme gehört mit eslint-disable und
 * Begründung an genau die eine Stelle.
 */

const NETWORK = 'Keine Netzwerkanfragen zur Laufzeit (AGENTS.md Regel 1).';
const STORAGE = 'Kein Browser-Speicher ohne ausdrücklichen Nutzerwunsch (AGENTS.md Regel 5).';
const COOKIES = 'Keine Cookies (AGENTS.md Regel 3).';

/** @type {Record<string, string>} */
const FORBIDDEN = {
  fetch: NETWORK,
  XMLHttpRequest: NETWORK,
  WebSocket: NETWORK,
  EventSource: NETWORK,
  sendBeacon: NETWORK,
  serviceWorker: 'Kein Service Worker in Phase 1 (plan.md A5).',
  localStorage: STORAGE,
  sessionStorage: STORAGE,
  indexedDB: STORAGE,
  caches: STORAGE,
  cookie: COOKIES,
};

const GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
];

/** @type {import('eslint').Linter.RulesRecord} */
export const networkAndStorageRules = {
  'no-restricted-globals': [
    'error',
    ...GLOBALS.map((name) => ({ name, message: `${name}: ${FORBIDDEN[name]}` })),
  ],
  // Erfasst auch Zugriffe über window, self, globalThis, navigator und document.
  'no-restricted-syntax': [
    'error',
    ...Object.entries(FORBIDDEN).flatMap(([name, message]) => [
      {
        selector: `MemberExpression[computed=false][property.name='${name}']`,
        message: `${name}: ${message}`,
      },
      {
        selector: `MemberExpression[computed=true][property.value='${name}']`,
        message: `${name}: ${message}`,
      },
    ]),
  ],
};
