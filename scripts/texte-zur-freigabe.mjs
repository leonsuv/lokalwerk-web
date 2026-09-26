/**
 * Erzeugt docs/texte-zur-freigabe.md aus dem Seitenregister (build/pages.ts) und den
 * Erklärtexten der Werkzeuge (src/tools/*\/main.html). Aufruf: node scripts/texte-zur-freigabe.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGES, TOOL_PAGES } from '../build/pages.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const TOOLS = TOOL_PAGES.map((p) => ({
  name: p.tool.name,
  file: `src/tools/${p.tool.id}/main.html`,
  page: p,
}));
/** Seiten und Werkzeuge, deren Texte seit der Freigabe am 25.09.2026 neu oder geändert sind */
const PHASE1 = new Set([
  '/pdf-zusammenfuegen/',
  '/fotos-verkleinern/',
  '/sepa-sammelueberweisung/',
  '/pro/',
  '/impressum/',
  '/datenschutz/',
  '/lizenzen/',
  '/404.html',
]);
/** Paket 1 bis 3: alle neuen Texte freigegeben von Leon am 25.09.2026 */
const NEW = 'NEU, freigegeben von Leon am 25.09.2026';
/** Paket 4: neue Werkzeuge, Texte noch zur Freigabe */
const PAKET4 = new Set([
  '/pdf-seiten-bearbeiten/',
  '/pdf-zu-bildern/',
  '/pdf-schwaerzen/',
  '/pdf-unterschreiben/',
  '/pdf-formular-ausfuellen/',
]);
const P4 = 'NEU, Paket 4, zur Freigabe';
const markFor = (/** @type {string} */ url) => (PHASE1.has(url) ? '' : PAKET4.has(url) ? P4 : NEW);
const clean = (/** @type {string} */ html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const out = [
  '# Texte zur Freigabe',
  '',
  'Status: Texte der Phase 1 **freigegeben von Leon am 25.09.2026**. Neue und geänderte Texte aus Phase 2, Paket 1 bis 3, sind mit „NEU, freigegeben von Leon am 25.09.2026“ markiert und damit ebenfalls **freigegeben**. Geändert wurden in Phase-1-Werkzeugen nur der Erklärtext von Fotos verkleinern (ZIP) und die Pro-Listen (ZIP gestrichen), siehe „Weitere Texte“. Nachtrag vom 26.09.2026: Änderungen nach Vorgabe von Leon (Startseiten-Titel, PDF teilen, Prüfsumme, Duplikate finden) sind eingearbeitet, siehe „Weitere Texte“. **Paket 4 (ab 26.09.2026): neue Texte mit „NEU, Paket 4, zur Freigabe“ markiert.**',
  '',
  'Erzeugt mit `node scripts/texte-zur-freigabe.mjs` aus `build/pages.ts` und den Werkzeug-Markups.',
  '',
  '## Titel und Meta-Beschreibungen (`build/pages.ts`)',
  '',
  '| URL | Titel | Meta-Beschreibung | Zeichen | Index |',
  '|---|---|---|---|---|',
  ...PAGES.map(
    (p) =>
      `| ${markFor(p.url) ? `**${markFor(p.url)}** ` : ''}\`${p.url}\` | ${p.title.replace(/\|/g, '\\|')} | ${p.description} | ${p.description.length} | ${p.index ? 'ja' : 'noindex'} |`,
  ),
];

for (const { name, file, page } of TOOLS) {
  const html = readFileSync(`${root}/${file}`, 'utf8');
  const top = /<h1>[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/.exec(html);
  const section = html.slice(html.indexOf('<section class="explain"'));
  const mark = markFor(page.url) ? ` – ${markFor(page.url)}` : '';
  out.push('', `## ${name}${mark} (\`${file}\`)`, '');
  out.push(`Karte: „${page.tool.name}“ – „${page.tool.short}“`, '');
  if (top?.[1]) out.push(`Unterzeile im Kopf: „${clean(top[1])}“`, '');
  let words = 0;
  for (const m of section.matchAll(/<(h2|p)[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = clean(m[2] ?? '');
    if (m[1] === 'p') words += text.split(' ').length;
    out.push(m[1] === 'h2' ? `**${text}**` : text, '');
  }
  out.push(`_(Erklärtext: ${words} Wörter)_`);
}

out.push(
  '',
  '## Weitere Texte',
  '',
  '| Stelle | Text | Datei |',
  '|---|---|---|',
  `| **${NEW}** Startseite, Ablagefläche | „PDF, Foto oder Excel-Liste. Danach wählst du, was du damit machen möchtest.“ (vorher: „… Das passende Werkzeug öffnet sich automatisch.“) | \`pages/index.html\` |`,
  `| **${NEW}** Startseite, Auswahl nach dem Ablegen | Überschrift „2 PDFs ausgewählt“ (Zahl und Art je nach Ablage), „Was möchtest du damit machen?“, Knopf „Andere Dateien wählen“ | \`pages/index.html\`, \`src/tools/home/page.ts\` |`,
  `| **${NEW}** Startseite, Meldung | „Für 2 Tabellen auf einmal gibt es kein Werkzeug. Lege nur eine Datei ab.“ | \`src/tools/home/page.ts\` |`,
  `| **${NEW}** Startseite, unter den Karten | Knopf „Alle Werkzeuge ansehen“ | \`pages/index.html\` |`,
  `| **${NEW}** Startseite, Pro-Band | Punkt „Alle Fotos auf einmal als ZIP speichern“ gestrichen (E3) | \`pages/index.html\` |`,
  `| **${NEW}** Pro-Seite | Punkt „ZIP-Export – Alle verkleinerten Fotos mit einem Klick speichern.“ gestrichen, Nummern angepasst (E3). Unterzeile jetzt „Für alle, die Überweisungen und PDFs regelmäßig bearbeiten.“ (Fotos gestrichen, Leon 25.09.2026, P1-3). Meta-Beschreibung ebenso ohne „Fotos“ (Leon 25.09.2026) | \`pages/pro/index.html\` |`,
  `| **${NEW}** Fotos verkleinern | Knopf „Alle Fotos als ZIP speichern“ statt Hinweis „Alle Fotos als ZIP speichern: mit Lokalwerk Pro“; Meldungen „3 Fotos als ZIP gespeichert.“, „… 1 wird noch verkleinert und ist nicht enthalten.“, „Die ZIP-Datei wäre zu groß. Speichere die Fotos in kleineren Gruppen.“; im Erklärtext Ergänzung „… oder mit „Alle Fotos als ZIP speichern“ zusammen in einer Datei.“ | \`src/tools/fotos-verkleinern/\` |`,
  `| **${NEW}** /werkzeuge/, Kopf | „Alle Werkzeuge“ – „Jedes Werkzeug läuft direkt in deinem Browser. Deine Dateien werden nicht hochgeladen.“ | \`pages/werkzeuge/index.html\` |`,
  `| **${NEW}** /werkzeuge/, Suche | Beschriftung „Werkzeug suchen“, Platzhalter „zum Beispiel PDF, Foto oder CSV“, Meldungen „3 Werkzeuge gefunden.“ und „Kein Werkzeug gefunden. Versuch ein anderes Wort, zum Beispiel „PDF“, „Foto“ oder „Excel“.“ | \`pages/werkzeuge/index.html\`, \`src/tools/werkzeuge/page.ts\` |`,
  `| **${NEW}** /werkzeuge/, Kategorien | „PDF“, „Fotos und Bilder“, „Tabellen und Listen“, „Zahlungsverkehr und Verein“, „Alltag und Sicherheit“; Zähler „4 Werkzeuge“ | \`build/pages.ts\` |`,
  `| **${NEW}** Paket 2, Meldungen | Passwort-Generator: „Passwort kopiert. Es bleibt in der Zwischenablage, bis du etwas anderes kopierst.“, „Entspricht dem BSI-Beispiel: …“, „Kürzer oder einfacher als die BSI-Beispiele“; Prüfsumme: „Stimmt überein (SHA-256).“, „Stimmt nicht überein (SHA-256). Die Datei ist verändert, unvollständig oder eine andere.“; Textvergleich: „Die Texte unterscheiden sich in zu vielen Zeilen. Vergleiche kürzere Abschnitte.“; Kontrast: „erfüllt“ / „nicht erfüllt“ | \`src/tools/<werkzeug>/page.ts\` |`,
  `| **${NEW}** Paket 3, Meldungen | Seitenzahlen/Stempel: „Diese PDF ist digital signiert. Nach dem Einfügen der Seitenzahlen ist die Signatur ungültig. …“, „Diese Zeichen kann die PDF-Schrift nicht darstellen: „Ł“, „ź“. Ersetze sie, zum Beispiel Ł durch L.“; CSV reparieren: „2 Zellen werden beim Speichern so geändert. Mit „So lassen“ bleibt alles unverändert.“, „Diese Zeilen haben nicht 3 Spalten wie die meisten: … Prüfe sie im Tabellenprogramm.“; Duplikate: „2 Gruppen mit zusammen 4 Zeilen.“, „Keine doppelten Einträge gefunden.“ | \`src/tools/<werkzeug>/\` |`,
  `| **${NEW}** Unter jedem Werkzeug | Überschrift „Passt dazu“ mit Karten | \`build/tool-blocks.ts\` |`,
  `| **${NEW}** „Alle Werkzeuge“-Verweise | zeigen jetzt auf /werkzeuge/ statt auf die Startseite (Text unverändert) | alle Seiten |`,
  '| **Nachtrag 26.09.2026, Vorgabe von Leon** Startseite, Titel | „PDF, Fotos, Tabellen und SEPA kostenlos im Browser bearbeiten \\| Lokalwerk“ | `build/pages.ts` |',
  '| **Nachtrag 26.09.2026, Vorgabe von Leon** PDF teilen | „Die PDF wird direkt in deinem Browser aufgeteilt und nicht hochgeladen.“ Dazu „teilen“ im Fließtext durch „aufteilen“ ersetzt, damit es nicht nach Weitergeben klingt: „Füge die PDF hinzu, die du aufteilen möchtest.“, Beschriftung „So aufteilen“, „Verschlüsselte PDFs lassen sich nicht aufteilen.“, „Es wird eine PDF auf einmal aufgeteilt: die erste.“, „Wird aufgeteilt …“, Dateiname „…-aufgeteilt.zip“. Titel und Name bleiben. | `src/tools/pdf-teilen/` |',
  '| **Nachtrag 26.09.2026, Vorgabe von Leon** Prüfsumme | „Stimmen sie überein, ist die Datei unverändert und vollständig angekommen, vorausgesetzt, die Vergleichs-Prüfsumme stammt aus einer vertrauenswürdigen Quelle, etwa der offiziellen Seite des Herstellers.“ | `src/tools/pruefsumme/main.html` |',
  '| **Nachtrag 26.09.2026, Vorgabe von Leon** Duplikate finden | „… mit einer zusätzlichen Spalte, die doppelte Einträge markiert.“ | `src/tools/duplikate-finden/main.html` |',
  '| **Nachtrag 26.09.2026, Vorgabe von Leon** Passwort-Generator | Standardlänge war schon 20 Zeichen mit allen vier Zeichenarten, keine Änderung | `src/tools/passwort-generator/main.html` |',
  '| **Nachtrag 26.09.2026, Vorgabe von Leon** Lizenzseite, „Verwendet für“ | nennt jetzt die Werkzeuge aus dem Seitenregister, die die Bibliothek tatsächlich laden (vom Build geprüft), z. B. „SEPA-Sammelüberweisung, Excel und CSV umwandeln, Duplikate finden“; nicht ausgelieferte Pakete stehen nicht mehr auf der Seite | `build/licenses.ts` |',
  `| **${P4}** PDF-Seiten bearbeiten, Meldungen | „Seite 2 gelöscht.“, „Alle Änderungen zurückgesetzt.“, „Keine Vorschau möglich“, „Fertig: Die PDF mit 3 Seiten ist gespeichert.“, „Es wird eine PDF auf einmal bearbeitet: die erste.“; Knopf-Beschriftungen für Screenreader „Seite 3, Position 1: nach links drehen / nach rechts drehen / nach vorn schieben / nach hinten schieben / löschen“ | \`src/tools/pdf-seiten-bearbeiten/page.ts\` |`,
  `| **${P4}** PDF zu Bildern, Meldungen | „Seite 1 ist sehr groß und wurde mit 208 statt 300 dpi gespeichert.“, „Fertig: Das Bild ist gespeichert.“, „Fertig: 2 Bilder als ZIP gespeichert.“, „Die Bilder konnten nicht erzeugt werden. Wähle eine geringere Auflösung oder weniger Seiten auf einmal.“, „Die ZIP-Datei wäre zu groß. Wähle weniger Seiten oder eine geringere Auflösung.“, „Es wird eine PDF auf einmal umgewandelt: die erste.“; Auswahl „72 dpi, für den Bildschirm“, „150 dpi, Standard“, „300 dpi, für den Druck“ | \`src/tools/pdf-zu-bildern/\` |`,
  `| **${P4}** PDF schwärzen, Meldungen | „Fertig: Die geschwärzte PDF ist gespeichert. Prüf sie, bevor du sie weitergibst.“, „Die geschwärzte PDF konnte nicht erzeugt werden. Wähle eine geringere Auflösung und versuch es noch einmal.“; Hinweis rechts „Prüf die neue PDF, bevor du sie weitergibst: Sind alle Stellen vollständig schwarz? Das Werkzeug schwärzt nur die Bereiche, die du markierst.“; Bedienhinweis „Zieh mit Maus, Stift oder Finger einen Bereich über die Stelle. Ohne Maus: …“; Screenreader „Bereich 1 auf Seite 2“, „Bereich 1 auf Seite 2 löschen“ | \`src/tools/pdf-schwaerzen/\` |`,
  `| **${P4}** Stempel und Wasserzeichen, Verweis | „ein Werkzeug, das die Seiten in Bilder umwandelt“ verlinkt jetzt auf /pdf-schwaerzen/ (Vorgabe von Leon, 26.09.2026; Wortlaut unverändert) | \`src/tools/pdf-stempel/main.html\` |`,
  `| **${P4}** Unterschrift einfügen, rechtlicher Hinweis (Entscheidung nötig, siehe docs/unterschrift-recht.md) | Hinweis rechts: „Das ist ein Bild deiner Unterschrift, keine digitale Signatur: Die Datei wird nicht signiert, und es ist weder eine fortgeschrittene noch eine qualifizierte elektronische Signatur. Wo das Gesetz die Schriftform verlangt, ersetzt es die eigenhändige Unterschrift nicht.“ Nicht „keine elektronische Signatur“, weil ein eingefügtes Bild nach Art. 3 Nr. 10 eIDAS eine (einfache) elektronische Signatur sein kann. | \`src/tools/pdf-unterschreiben/main.html\` |`,
  `| **${P4}** Unterschrift einfügen, Meldungen | „Fertig: Die PDF mit Unterschrift ist gespeichert.“, „Auf dem Bild ist keine Unterschrift zu erkennen. Wähle ein anderes Bild.“, „Das Bild konnte nicht gelesen werden. Wähle ein PNG- oder JPEG-Bild.“, „Diese PDF ist digital signiert. Nach dem Einfügen der Unterschrift ist die vorhandene Signatur ungültig.“; Bedienhinweise zur Zeichenfläche und zum Verschieben; Screenreader „Unterschrift 1 auf Seite 2“ | \`src/tools/pdf-unterschreiben/\` |`,
  '| 404-Seite | „Diese Seite gibt es nicht.“ / „Die Adresse ist falsch geschrieben oder die Seite wurde verschoben.“ / Button „Zu allen Werkzeugen“ (zeigt jetzt auf /werkzeuge/) | `pages/404.html` |',
  '| Lizenzseite, Einleitung | siehe Datei | `pages/lizenzen/index.html` |',
  '| SEPA, Hinweis nur eine Überweisung | Wortlaut aus plan.md O9 | `src/tools/sepa-sammelueberweisung/messages.ts` |',
  '| SEPA, Warnung Datum | Wortlaut aus plan.md O7 | `src/tools/sepa-sammelueberweisung/messages.ts` |',
  '| Fehler- und Hinweismeldungen | alle Meldungen der Werkzeuge; **NEU, freigegeben von Leon am 25.09.2026** die Meldungen der neuen Werkzeuge in `src/tools/<werkzeug>/page.ts` | `src/tools/*/page.ts`, `src/tools/sepa-sammelueberweisung/messages.ts` |',
  '',
);
writeFileSync(`${root}/docs/texte-zur-freigabe.md`, out.join('\n'));
console.log('docs/texte-zur-freigabe.md erzeugt');
