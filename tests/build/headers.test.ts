import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGlobalHeaders } from '../../build/headers.ts';

describe('parseGlobalHeaders', () => {
  it('liest nur den Block für /*', () => {
    const text = '# Kommentar\n/*\n  A: 1\n  B: x: y\n/nur-hier\n  C: 3\n';
    expect(parseGlobalHeaders(text)).toEqual({ A: '1', B: 'x: y' });
  });

  it('bricht bei Zeilen ohne Doppelpunkt ab', () => {
    expect(() => parseGlobalHeaders('/*\n  kaputt\n')).toThrow('Doppelpunkt');
  });
});

describe('public/_headers', () => {
  const headers = parseGlobalHeaders(
    readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8'),
  );
  const csp = headers['Content-Security-Policy'] ?? '';
  const directives = new Map(
    csp.split(';').map((d) => {
      const [name = '', ...values] = d.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );

  it('blockiert alle Netzwerkanfragen aus der Seite', () => {
    expect(directives.get('connect-src')).toEqual(["'none'"]);
    expect(directives.get('default-src')).toEqual(["'none'"]);
  });

  it('erlaubt keine fremden Quellen und keine Inline-Skripte', () => {
    expect(csp).not.toMatch(/https?:|\*|'unsafe-inline'|'unsafe-eval'/);
  });

  it('setzt die übrigen Sicherheits-Header', () => {
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
