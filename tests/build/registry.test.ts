import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, type PageDef, type ToolInfo } from '../../build/pages.ts';
import { checkRegistry, iconIds } from '../../build/registry.ts';

const icons = iconIds(
  readFileSync(new URL('../../src/partials/icons.svg', import.meta.url), 'utf8'),
);

const tool = (over: Partial<ToolInfo> = {}): ToolInfo => ({
  id: 'a',
  name: 'Werkzeug A',
  short: 'Ein Satz.',
  category: 'pdf',
  icon: 'i-pdf',
  keywords: [],
  related: [],
  ...over,
});
const page = (id: string, over: Partial<ToolInfo> = {}): PageDef => ({
  file: `${id}/index.html`,
  url: `/${id}/`,
  title: `Titel ${id}`,
  description: `Beschreibung ${id}`,
  index: true,
  nav: 'werkzeuge',
  tool: tool({ id, name: `Werkzeug ${id}`, ...over }),
});

describe('iconIds', () => {
  it('liest die Symbol-IDs aus icons.svg', () => {
    expect(icons.has('i-pdf')).toBe(true);
    expect(icons.has('i-bank')).toBe(true);
    expect(icons.has('i-gibt-es-nicht')).toBe(false);
  });
});

describe('checkRegistry (plan-phase2.md Abschnitt 3.5)', () => {
  it('findet im echten Register nichts', () => {
    expect(checkRegistry(PAGES, icons)).toEqual([]);
  });

  it('verlangt mindestens ein verwandtes Werkzeug', () => {
    expect(checkRegistry([page('a')], icons)).toEqual(['/a/ (a): keine verwandten Werkzeuge']);
  });

  it('meldet Verweise ins Leere und auf sich selbst', () => {
    expect(checkRegistry([page('a', { related: ['b', 'a'] })], icons)).toEqual([
      '/a/ (a): verwandtes Werkzeug b gibt es nicht',
      '/a/ (a): verweist auf sich selbst',
    ]);
  });

  it('meldet fehlende Symbole und unbekannte Kategorien', () => {
    const problems = checkRegistry(
      [page('a', { icon: 'i-fehlt', category: 'xyz' as ToolInfo['category'] })],
      icons,
    );
    expect(problems).toContain('/a/ (a): Symbol i-fehlt fehlt in icons.svg');
    expect(problems).toContain('/a/ (a): unbekannte Kategorie xyz');
  });

  it('meldet doppelte Titel, Beschreibungen und Werkzeugnamen', () => {
    const a = page('a');
    const b = { ...page('b'), title: a.title, description: a.description };
    const c = page('c', { name: 'Werkzeug a' });
    const problems = checkRegistry([a, b, c], icons);
    expect(problems).toContain('Titel doppelt: Titel a');
    expect(problems).toContain('Meta-Beschreibung doppelt: Beschreibung a');
    expect(problems).toContain('Werkzeugname doppelt: Werkzeug a');
  });

  it('verlangt, dass id und URL zusammenpassen und Werkzeuge indexiert werden', () => {
    const wrong = { ...page('a'), url: '/b/', index: false };
    expect(checkRegistry([wrong], icons)).toEqual([
      '/b/ (a): id passt nicht zur URL',
      '/b/ (a): Werkzeugseiten müssen indexiert werden',
      '/b/ (a): keine verwandten Werkzeuge',
    ]);
  });
});
