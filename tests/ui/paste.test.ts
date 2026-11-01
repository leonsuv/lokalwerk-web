import { describe, expect, it } from 'vitest';
import { isEditableTarget, pastedFiles } from '../../src/ui/paste.ts';

const file = (name: string) => ({ name }) as File;

describe('isEditableTarget', () => {
  it('erkennt Eingabefelder und bearbeitbare Elemente', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'textarea' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
  it('lässt Seitenfläche, Knöpfe und leere Ziele nicht als Eingabefeld gelten', () => {
    expect(isEditableTarget({ tagName: 'BODY' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});

describe('pastedFiles', () => {
  it('liefert die Dateien aus der Zwischenablage', () => {
    const files = [file('a.pdf'), file('b.pdf')];
    expect(pastedFiles({ clipboardData: { files }, target: { tagName: 'BODY' } })).toEqual(files);
  });
  it('ignoriert Einfügen in Eingabefelder, auch mit Dateien', () => {
    expect(
      pastedFiles({ clipboardData: { files: [file('a.pdf')] }, target: { tagName: 'INPUT' } }),
    ).toEqual([]);
  });
  it('liefert nichts ohne Zwischenablage oder ohne Dateien (nur Text)', () => {
    expect(pastedFiles({ clipboardData: null, target: null })).toEqual([]);
    expect(pastedFiles({ clipboardData: { files: [] }, target: { tagName: 'BODY' } })).toEqual([]);
  });
});
