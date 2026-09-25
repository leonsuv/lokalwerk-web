/**
 * Übersicht /werkzeuge/: filtert die beim Build erzeugte Liste lokal (plan-phase2.md
 * Abschnitt 3.3). Der Suchtext jedes Werkzeugs steht in `data-search`. Keine Anfrage,
 * nichts wird gespeichert.
 */

import { matchesQuery } from '../../core/search/match.ts';
import { $, $$ } from '../../ui/dom.ts';

const input = $<HTMLInputElement>('#tool-search-input');
const status = $('#tool-search-status');
const sections = $$('#tool-overview .tool-category');

function filter(): void {
  const query = input.value;
  let visible = 0;
  for (const section of sections) {
    let inSection = 0;
    for (const item of $$<HTMLLIElement>('li[data-search]', section)) {
      const match = matchesQuery(query, item.dataset.search ?? '');
      item.hidden = !match;
      if (match) inSection += 1;
    }
    section.hidden = inSection === 0;
    visible += inSection;
  }
  if (query.trim() === '') status.textContent = '';
  else if (visible === 0)
    status.textContent =
      'Kein Werkzeug gefunden. Versuch ein anderes Wort, zum Beispiel „PDF“, „Foto“ oder „Excel“.';
  else status.textContent = `${visible} ${visible === 1 ? 'Werkzeug' : 'Werkzeuge'} gefunden.`;
}

input.addEventListener('input', filter);
$('#tool-search').hidden = false;
// Der Browser kann beim Zurückgehen einen alten Suchbegriff wieder einsetzen.
filter();
