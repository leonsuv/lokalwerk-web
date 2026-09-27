import { describe, expect, it } from 'vitest';
import {
  blankLikeNeighbour,
  exportDone,
  lossNote,
  pageLabel,
  selected,
} from '../../src/tools/pdf-werkstatt/texts.ts';

const facts = (form = false, outline = false, signed = false) => ({
  form,
  xfa: false,
  outline,
  signed,
});

describe('Texte der PDF-Werkstatt', () => {
  it('Hinweis vor dem Export nennt je Datei, was verloren geht', () => {
    expect(lossNote([{ name: 'a.pdf', facts: facts(true, true) }])).toBe(
      'a.pdf enthält Formularfelder und Lesezeichen. Diese Angaben sind in neu zusammengesetzten PDFs nicht mehr enthalten, wie beim Zusammenfügen.',
    );
    expect(lossNote([{ name: 'b.pdf', facts: facts(true, true, true) }])).toContain(
      'Formularfelder, Lesezeichen und eine digitale Signatur',
    );
    const many = ['1', '2', '3', '4', '5'].map((n) => ({ name: `${n}.pdf`, facts: facts(true) }));
    expect(lossNote(many)).toContain('Weitere 2 Dateien ebenso.');
  });

  it('Exportmeldung nennt unverändert übernommene Dokumente (W12)', () => {
    expect(exportDone(['a.pdf'], 0, false)).toBe('Fertig: a.pdf ist gespeichert.');
    expect(exportDone(['a.pdf'], 1, false)).toBe(
      'Fertig: a.pdf ist gespeichert. Es war unverändert: Gespeichert ist die Originaldatei.',
    );
    expect(exportDone(['a.pdf', 'b.pdf', 'c.pdf'], 2, true)).toBe(
      'Fertig: 3 Dokumente sind als ZIP gespeichert. 2 davon waren unverändert und sind die Originaldatei.',
    );
  });

  it('Beschriftungen, Auswahl und Leerseite', () => {
    expect(
      pageLabel({ position: 3, count: 12, source: { name: 'A.pdf', page: 1 }, rotate: 90 }),
    ).toBe('Seite 3 von 12, aus A.pdf Seite 1, gedreht um 90 Grad');
    expect(pageLabel({ position: 1, count: 1, source: null, rotate: 0 })).toBe(
      'Seite 1 von 1, leere Seite',
    );
    expect(selected(3, 2)).toBe('3 Seiten aus 2 Dokumenten ausgewählt');
    expect(selected(0, 0)).toBe('Auswahl aufgehoben');
    expect(blankLikeNeighbour(595.28, 841.89)).toBe('Wie die Nachbarseite (21,0 × 29,7 cm)');
  });
});
