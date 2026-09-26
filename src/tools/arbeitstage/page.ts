/**
 * Werkzeugseite „Arbeitstage-Rechner“ (plan-phase2.md Werkzeug 29, E12: nur Arbeitstage mit
 * landesweiten Feiertagen, regionale als abwählbare Zusätze, keine BGB-Fristen). Reine Rechnung
 * auf der Seite, ohne Worker; Feiertage aus core/dates/holidays.ts (docs/feiertage-recht.md).
 */

import { dayNumber, formatGermanDate, isoFromDay, isoWeekday } from '../../core/dates/civil.ts';
import { LAENDER, REGIONAL, type Land } from '../../core/dates/holidays.ts';
import { countWorkdays } from '../../core/dates/workdays.ts';
import { $, $$ } from '../../ui/dom.ts';

const landSelect = $<HTMLSelectElement>('#wd-land');
const fromInput = $<HTMLInputElement>('#wd-from');
const toInput = $<HTMLInputElement>('#wd-to');
const weekButtons = $$<HTMLButtonElement>('button[data-saturday]');

const ERRORS = {
  invalid: 'Gib zwei vollständige Daten ein.',
  order: '„Bis“ liegt vor „Von“. Tausche die beiden Daten.',
  range: 'Der Rechner kennt die Feiertage der Jahre 2018 bis 2035. Wähle einen Zeitraum darin.',
} as const;

/** Hinweis beim Ergebnis für Länder mit Feiertagen, die nur in Teilen des Landes gelten */
const REGIONAL_INTRO: Partial<Record<Land, string>> = {
  BY: 'In vielen Gemeinden in Bayern ist auch Mariä Himmelfahrt ein Feiertag, in der Stadt Augsburg außerdem das Friedensfest. Gilt das bei dir, wähle es hier dazu.',
  SN: 'In bestimmten Gemeinden in Sachsen ist auch Fronleichnam ein Feiertag. Gilt das bei dir, wähle es hier dazu.',
  TH: 'In bestimmten Gemeinden in Thüringen ist auch Fronleichnam ein Feiertag. Gilt das bei dir, wähle es hier dazu.',
};

let saturday = false;
const regional = new Set<string>();

landSelect.replaceChildren(
  new Option('Bundesland wählen', ''),
  ...LAENDER.map((l) => new Option(l.name, l.code)),
);
// Vorgabe: das laufende Kalenderjahr
const year = Math.min(2035, Math.max(2018, new Date().getFullYear()));
fromInput.value = isoFromDay(dayNumber(year, 1, 1));
toInput.value = isoFromDay(dayNumber(year, 12, 31));

function renderRegional(land: Land | null): void {
  const options = land ? (REGIONAL[land] ?? []) : [];
  $('#wd-regional-box').hidden = options.length === 0;
  $('#wd-regional-intro').textContent = land ? (REGIONAL_INTRO[land] ?? '') : '';
  $('#wd-regional').replaceChildren(
    ...options.map((o) => {
      const wrap = document.createElement('div');
      wrap.className = 'mt-s';
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = o.id;
      box.checked = regional.has(o.id);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.id = `wd-regional-${o.id}`;
      hint.textContent = o.where;
      box.setAttribute('aria-describedby', hint.id);
      label.append(box, o.name);
      wrap.append(label, hint);
      return wrap;
    }),
  );
}

function cell(text: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function render(): void {
  const land = (landSelect.value || null) as Land | null;
  for (const b of weekButtons)
    b.setAttribute('aria-pressed', String((b.dataset.saturday === 'true') === saturday));
  $('#wd-rest-label').textContent = saturday ? 'Sonntage' : 'Samstage und Sonntage';
  const error = $('#wd-error');
  const reset = () => {
    for (const id of ['#wd-workdays', '#wd-days', '#wd-rest', '#wd-holidays'])
      $(id).textContent = '–';
    $('#wd-list-box').hidden = true;
  };
  if (!land) {
    error.hidden = true;
    reset();
    $('#wd-live').textContent = '';
    return;
  }
  const result = countWorkdays(fromInput.value, toInput.value, { land, saturday, regional });
  if (!result.ok) {
    error.hidden = false;
    error.textContent = ERRORS[result.code];
    reset();
    return;
  }
  error.hidden = true;
  const counted = result.holidays.filter((h) => h.counted).length;
  $('#wd-workdays').textContent = String(result.workdays);
  $('#wd-days').textContent = String(result.calendarDays);
  $('#wd-rest').textContent = String(result.restDays);
  $('#wd-holidays').textContent = String(counted);
  $('#wd-live').textContent = `${result.workdays} Arbeitstage`;
  $('#wd-list-box').hidden = false;
  $('#wd-list-empty').hidden = result.holidays.length > 0;
  $('#wd-table-wrap').hidden = result.holidays.length === 0;
  $('#wd-table tbody').replaceChildren(
    ...result.holidays.map((h) => {
      const tr = document.createElement('tr');
      const effect = h.counted
        ? 'kein Arbeitstag'
        : isoWeekday(h.day) === 6
          ? 'fällt auf einen Samstag'
          : 'fällt auf einen Sonntag';
      tr.append(cell(formatGermanDate(h.day)), cell(h.names.join(', ')), cell(effect));
      return tr;
    }),
  );
}

landSelect.addEventListener('change', () => {
  regional.clear();
  renderRegional((landSelect.value || null) as Land | null);
  render();
});
$('#wd-regional').addEventListener('change', (e) => {
  const box = e.target as HTMLInputElement;
  if (box.checked) regional.add(box.value);
  else regional.delete(box.value);
  render();
});
for (const input of [fromInput, toInput]) input.addEventListener('input', render);
for (const b of weekButtons) {
  b.addEventListener('click', () => {
    saturday = b.dataset.saturday === 'true';
    render();
  });
}
render();
