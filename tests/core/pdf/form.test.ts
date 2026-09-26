import { readFileSync } from 'node:fs';
import { degrees, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { fillForm, readForm } from '../../../src/core/pdf/form.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** Formular mit allen Feldarten auf zwei Seiten, eine davon gedreht */
async function makeForm(xfa: 'none' | 'hybrid' = 'none'): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('Mitgliedsantrag');
  const p1 = doc.addPage([600, 800]);
  const p2 = doc.addPage([600, 800]);
  p2.setRotation(degrees(90));
  const form = doc.getForm();
  const name = form.createTextField('person.name');
  name.addToPage(p1, { x: 60, y: 700, width: 240, height: 20 });
  name.acroField.dict.set(PDFName.of('TU'), PDFString.of('Vor- und Nachname'));
  name.enableRequired();
  const notes = form.createTextField('notiz');
  notes.enableMultiline();
  notes.addToPage(p1, { x: 60, y: 500, width: 300, height: 80 });
  const plz = form.createTextField('plz');
  plz.setMaxLength(5);
  plz.addToPage(p1, { x: 320, y: 700, width: 80, height: 20 });
  const ok = form.createCheckBox('einverstanden');
  ok.addToPage(p1, { x: 60, y: 450, width: 14, height: 14 });
  const beitrag = form.createRadioGroup('beitrag');
  beitrag.addOptionToPage('voll', p1, { x: 60, y: 400, width: 14, height: 14 });
  beitrag.addOptionToPage('ermaessigt', p1, { x: 120, y: 400, width: 14, height: 14 });
  const land = form.createDropdown('land');
  land.addOptions(['Deutschland', 'Österreich', 'Schweiz']);
  land.addToPage(p1, { x: 60, y: 350, width: 150, height: 20 });
  const tage = form.createOptionList('tage');
  tage.addOptions(['Montag', 'Mittwoch', 'Freitag']);
  tage.enableMultiselect();
  tage.addToPage(p2, { x: 60, y: 100, width: 150, height: 60 });
  const fest = form.createTextField('fest');
  fest.setText('bleibt');
  fest.enableReadOnly();
  fest.addToPage(p2, { x: 300, y: 100, width: 100, height: 20 });
  form.createButton('drucken').addToPage('Drucken', p2, { x: 400, y: 50, width: 80, height: 20 });
  const bytes = await doc.save();
  if (xfa === 'none') return bytes;
  // Erst nach dem Speichern: pdf-lib entfernt XFA beim Speichern eines Formulars selbst.
  const again = await PDFDocument.load(bytes, { updateMetadata: false });
  const acro = again.catalog.lookup(PDFName.of('AcroForm'));
  if (acro instanceof PDFDict) acro.set(PDFName.of('XFA'), again.context.obj([]));
  return again.save();
}

describe('readForm', () => {
  it('liest Feldarten, Beschriftung, Eigenschaften und Lesereihenfolge', async () => {
    const info = await readForm(await makeForm());
    expect(info).toMatchObject({ pages: 2, signed: false, xfa: 'none' });
    expect(info.fields.map((f) => [f.name, f.kind, f.page])).toEqual([
      ['person.name', 'text', 1],
      ['plz', 'text', 1],
      ['notiz', 'text', 1],
      ['einverstanden', 'checkbox', 1],
      ['beitrag', 'radio', 1],
      ['land', 'dropdown', 1],
      ['tage', 'list', 2],
      ['fest', 'text', 2],
    ]);
    const byName = Object.fromEntries(info.fields.map((f) => [f.name, f]));
    expect(byName['person.name']).toMatchObject({ label: 'Vor- und Nachname', required: true });
    expect(byName['plz']?.maxLength).toBe(5);
    expect(byName['notiz']?.multiline).toBe(true);
    expect(byName['beitrag']?.options).toEqual(['voll', 'ermaessigt']);
    expect(byName['tage']).toMatchObject({
      multiselect: true,
      options: ['Montag', 'Mittwoch', 'Freitag'],
    });
    expect(byName['fest']).toMatchObject({ readOnly: true, value: 'bleibt' });
  });

  it('rechnet die Lage des Feldes auf die sichtbare Seite um (auch gedreht)', async () => {
    const info = await readForm(await makeForm());
    const name = info.fields.find((f) => f.name === 'person.name');
    // x 60..300 von 600, y 700..720 von 800 (von oben: 80..100)
    expect(name?.rect?.x).toBeCloseTo(0.1);
    expect(name?.rect?.w).toBeCloseTo(0.4);
    expect(name?.rect?.y).toBeCloseTo(80 / 800);
    expect(name?.rect?.h).toBeCloseTo(20 / 800);
    // Seite 2 um 90° gedreht: sichtbar 800 breit, 600 hoch
    const tage = info.fields.find((f) => f.name === 'tage');
    expect(tage?.rect?.w).toBeCloseTo(60 / 800);
    expect(tage?.rect?.h).toBeCloseTo(150 / 600);
  });

  it('erkennt gemischte und reine XFA-Formulare', async () => {
    expect((await readForm(await makeForm('hybrid'))).xfa).toBe('hybrid');
    const pure = await PDFDocument.create();
    pure.addPage();
    pure.catalog.set(
      PDFName.of('AcroForm'),
      pure.context.obj({ Fields: [], XFA: pure.context.obj([]) }),
    );
    expect(await readForm(await pure.save())).toMatchObject({ xfa: 'pure', fields: [] });
  });

  it('lehnt verschlüsselte PDFs ab', async () => {
    await expect(readForm(fixture('passwort-zum-oeffnen.pdf'))).rejects.toMatchObject({
      code: 'encrypted',
    });
  });
});

describe('fillForm', () => {
  const values = {
    'person.name': 'Jürgen Müller-Weiß',
    plz: '5067812',
    notiz: 'Zeile eins\nZeile zwei',
    einverstanden: true,
    beitrag: 'ermaessigt',
    land: ['Österreich'],
    tage: ['Montag', 'Freitag'],
    fest: 'geändert',
  };

  it('setzt alle Werte, kürzt auf die Höchstlänge und lässt schreibgeschützte Felder', async () => {
    const out = await fillForm(await makeForm(), values, false);
    const info = await readForm(out);
    const got = Object.fromEntries(info.fields.map((f) => [f.name, f.value]));
    expect(got).toEqual({
      'person.name': 'Jürgen Müller-Weiß',
      plz: '50678',
      notiz: 'Zeile eins\nZeile zwei',
      einverstanden: true,
      beitrag: 'ermaessigt',
      land: ['Österreich'],
      tage: ['Montag', 'Freitag'],
      fest: 'bleibt',
    });
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    expect(doc.getTitle()).toBe('Mitgliedsantrag');
  });

  it('schreibt die Felder fest: danach gibt es keine Felder mehr', async () => {
    const out = await fillForm(await makeForm(), values, true);
    expect((await readForm(out)).fields).toEqual([]);
  });

  it('meldet Zeichen, die Helvetica nicht kann, statt sie zu ersetzen (E8a)', async () => {
    await expect(
      fillForm(await makeForm(), { 'person.name': 'Łukasz Nowak' }, false),
    ).rejects.toMatchObject({
      code: 'charset',
      field: 'person.name',
      chars: ['Ł'],
    });
  });

  it('entfernt bei gemischten Formularen den XFA-Teil, lehnt reine XFA-Formulare ab', async () => {
    const out = await fillForm(await makeForm('hybrid'), { plz: '12345' }, false);
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'));
    expect(acro instanceof PDFDict && acro.has(PDFName.of('XFA'))).toBe(false);
    const pure = await PDFDocument.create();
    pure.addPage();
    pure.catalog.set(
      PDFName.of('AcroForm'),
      pure.context.obj({ Fields: [], XFA: pure.context.obj([]) }),
    );
    await expect(fillForm(await pure.save(), {}, false)).rejects.toMatchObject({ code: 'xfa' });
  });
});
