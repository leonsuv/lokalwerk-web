# Plan Phase 1 – Lokalwerk

Status: **freigegeben** (Entscheidungen in Abschnitt 1). Verbindlich zusammen mit AGENTS.md. Bei Widerspruch gilt AGENTS.md, außer dieser Plan regelt ausdrücklich eine Ausnahme.

Ziel: öffentliche Website mit drei kostenlosen Werkzeugen (PDFs zusammenfügen, Fotos verkleinern, SEPA-Sammelüberweisung). Pro, Zahlung und Lizenzschlüssel sind **nicht** Teil dieser Phase.

---

## 1. Entscheidungen

### Allgemein

| Nr. | Frage | Entscheidung |
|---|---|---|
| A1 | Node.js | Freigegeben: `brew install node@24` (LTS) ausführen, danach `node -v` und `npm -v` prüfen. Paketmanager npm. `.nvmrc` mit `24`. Falls die Installation scheitert: anhalten und melden, nicht improvisieren. |
| A2 | Git und Dateinamen | Freigegeben: `git init`, dann umbenennen in `AGENTS.md`, `CLAUDE.md` und `prototype/lokalwerk-prototyp.html`. `.gitignore` für `node_modules/`, `dist/`, `.DS_Store`. Erster Commit direkt nach dem Umbenennen, noch vor jedem Code. |
| A3 | Dev-Abhängigkeiten für ESLint | Grundsätzlich freigegeben: `typescript-eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`. Angaben nach AGENTS.md Abschnitt 4 trotzdem vor der Installation kurz auflisten. |
| A4 | SheetJS | Freigegeben: aktuelles Archiv einmalig von cdn.sheetjs.com laden und unter `vendor/` ablegen. In `vendor/README.md` Version, Quelle, Datum und SHA-256 eintragen. Einbindung über den lokalen Pfad in `package.json`. |
| A5 | Offline | Variante **(a)**: Jede Seite lädt beim Öffnen alles, was sie braucht, danach keine Anfragen mehr, nichts wird auf dem Gerät gespeichert. Die Einschränkung bei der Ablage auf der Startseite ist akzeptiert. Kein Service Worker in Phase 1. |
| A6 | Kontrast | Freigegeben: Nur im Hellmodus zusätzliche, dunklere Text-Tokens (z. B. `--ok-ink`, `--err-ink`, `--pdf-ink`, `--img-ink`). Flächen, Icons und Dunkelmodus bleiben unverändert. Farbwerte samt Kontrastverhältnis vor dem Einbau vorlegen. **Werte freigegeben (24.09.2026), nur für Text, Dunkelmodus unverändert:** `--ok-ink` #137A4B, `--err-ink` #BC3C22, `--pdf-ink` #CF1D23, `--img-ink` #0B796A (jeweils ≥ 4,6:1 auf der eigenen hellen Fläche, weiß, `--bg` und `--surface2`). |
| A7 | Rechtstexte | Impressum und Datenschutz wörtlich aus dem Prototyp übernehmen, mit Platzhaltern und Entwurf-Kasten. Kontaktadresse ist **kontakt@lokalwerk.eu** (AGENTS.md gilt, der Prototyp wird ebenfalls angepasst). Rechtsseiten bekommen `noindex`, bis Leon sie fertiggestellt hat. **Die AGB-Seite wird in Phase 1 nicht gebaut**: nicht im Footer, nicht in der Sitemap. Den AGB-Text aus dem Prototyp unter `docs/agb-entwurf.md` ablegen. |
| A8 | Hell/Dunkel-Umschalter | Keiner in Phase 1. Die Seite folgt der Systemeinstellung. `color-scheme: light dark` setzen. |

### Beträge

| Nr. | Frage | Entscheidung |
|---|---|---|
| B1 | Mehrdeutige Beträge | Vorschlag angenommen. `1,234` und `1.234` sind Fehler mit der Meldung „Betrag ist nicht eindeutig. Schreib 1.234,00 oder 1,23.“ Mehr als zwei Nachkommastellen sind ein Fehler, es wird nie gerundet. Bei Excel-Zahlen nur Gleitkomma-Rauschen ausgleichen (Toleranz deutlich unter 0,001 Cent), eine echte dritte Nachkommastelle ist ein Fehler. |

### SEPA / pain.001.001.09

Grundsatz für alle S-Punkte: **Die offizielle Quelle entscheidet, nicht der Prototyp und nicht das Gedächtnis.** Wo unten „laut Spezifikation“ steht, liest Claude die Stelle nach, zitiert sie in `docs/sepa-entscheidungen.md` (Dokument, Version, Kapitel/Seite) und setzt sie so um. Widerspricht die Spezifikation einer Entscheidung hier, gilt die Spezifikation, und Claude meldet es.

| Nr. | Frage | Entscheidung |
|---|---|---|
| S1 | Quelle, XSD, Beispieldateien | Freigegeben: Claude lädt selbst herunter, ausschließlich von **ebics.de** (DFÜ-Vereinbarung Anlage 3, aktuell gültige Fassung, zugehörige XSD) und **europeanpaymentscouncil.eu** (SCT-Rulebook, Implementation Guidelines). Ablage unter `tests/fixtures/sepa/`, Quellen mit URL, Version und Abrufdatum in `tests/fixtures/SOURCES.md`. Lizenz- oder Nutzungshinweise der Dokumente beachten; PDFs der Spezifikation nicht ins Repo, falls die Bedingungen das ausschließen, dann nur Link und Versionsangabe. |
| S2 | Eigene Bank ohne BIC | Laut Spezifikation. Wenn die DK-Spezifikation für .09 eine Form ohne BIC vorsieht, genau diese verwenden. Wenn nicht, wird die BIC Pflichtfeld. Ergebnis melden. |
| S3 | Zeichensatz | Erlaubte Zeichen laut Spezifikation. Umschreibung: eigene, kleine Tabelle im Code (`sepa/charset.ts`), z. B. é→e, Ł→L, Ø→O, Æ→AE, Œ→OE, Å→A. Jede Ersetzung und jedes entfernte Zeichen wird pro Zeile als Warnung angezeigt, nie stillschweigend. Falls die Spezifikation eine Umschreibungstabelle nennt, hat sie Vorrang. |
| S4 | Länder außerhalb des EWR | Vorschlag angenommen: Empfänger-IBANs aus CH, GB, GI, MC, SM, VA, AD sowie weiteren Nicht-EWR-Ländern in Phase 1 mit klarer Meldung ausschließen: „Überweisungen in dieses Land brauchen zusätzliche Angaben und werden noch nicht unterstützt.“ |
| S5 | Länderliste, IBAN-Längen | Freigegeben: Länderliste aus der EPC-Liste der SEPA-Länder, IBAN-Längen aus der SWIFT IBAN Registry. Beide Quellen in die Quellentabelle von AGENTS.md aufnehmen. Liste in `sepa/iban-countries.ts` mit Kommentar zu Quelle und Stand. |
| S6 | Höchstbetrag | 999.999.999,99 € beibehalten, sofern das SCT-Rulebook das bestätigt. Fundstelle in `docs/sepa-entscheidungen.md`. |
| S7 | CreDtTm | Laut XSD und Spezifikation. Bevorzugt Ortszeit ohne Millisekunden. Das XSD-Testergebnis entscheidet; Zeitzone nur, wenn die Spezifikation sie verlangt oder empfiehlt. |
| S8 | BtchBookg | **Korrigiert (24.09.2026, O6):** Kein Kontrollkästchen. `BtchBookg` ist fest `true`. Grund: Laut Anlage 3 26.11, S. 99, wirkt `false` nur, wenn mit der Bank Einzelbuchung vereinbart ist (docs/sepa-entscheidungen.md). |
| S9 | Ausführungsdatum | Vorschlag angenommen: Standard nächster Werktag in Ortszeit, Datum in der Vergangenheit ist ein Fehler, keine Prüfung von Bankfeiertagen. **Ergänzt (O7):** Liegt das Datum mehr als 15 Tage in der Zukunft, erscheint eine Warnung (kein Fehler): „Banken müssen Aufträge mit einem Datum mehr als 15 Tage in der Zukunft nicht annehmen.“ |
| S10 | DACH | Vorschlag angenommen. Seite und Meta-Beschreibung sagen klar „für deutsche Banken“. Österreich und Schweiz später. |

### Entscheidungen nach Schritt 6 Teil 1 (24.09.2026)

Details und Fundstellen: `docs/sepa-entscheidungen.md`.

| Nr. | Frage | Entscheidung |
|---|---|---|
| F1 | Fassung Anlage 3 | Wir bauen gegen **Version 26.11** (gültig ab 15.11.2026). Die neue Regel „kein Textfeld nur aus Leerzeichen“ wird umgesetzt und getestet. |
| O1/O8 | Umschreibung | Die EPC-Tabelle EPC217-08 wird **nicht** in den Code übernommen, auch nicht auszugsweise; sie dient nur zum Nachlesen. Eigene Umschreibung: Unicode-Normalisierung (NFD) und Akzente entfernen, dazu eine selbst geschriebene Liste: Æ→AE, æ→ae, Œ→OE, œ→oe, Ø→O, ø→o, Ł→L, ł→l, Đ→D, đ→d, Þ→TH, þ→th, ẞ→SS. |
| O2 | Typografische Zeichen | – und — → `-`; „ “ ” ‘ ’ → `'`; … → `...`; geschütztes Leerzeichen und andere Leerzeichen → normales Leerzeichen. |
| O3 | Übrige Zeichen | `"` → `'`; `<` und `>` → `.`; alle übrigen Zeichen ohne Entsprechung → `.`. Jede Ersetzung erscheint als Warnung in der Zeile. |
| O4 | IBAN Registry | Leon lädt die SWIFT IBAN Registry selbst herunter und legt sie in `.local-specs/`. Bis dahin gelten die IBAN-Längen aus dem Prototyp, die Stelle ist im Code als offen markiert. |
| O5 | Randfälle Länder | Gibraltar (GI) wird wie die Nicht-EWR-Länder ausgeschlossen. Saint-Pierre-et-Miquelon wird nicht erwähnt. |
| O6 | Sammelbuchung | Siehe S8 (korrigiert): fest `true`, kein Kontrollkästchen. |
| O7 | Datum > 15 Tage | Warnung, siehe S9. |
| O9 | Nur eine Überweisung | Hinweis, kein Fehler: „Manche Banken lehnen Dateien mit nur einer Überweisung ab. Für eine einzelne Überweisung nutzt du besser direkt dein Onlinebanking.“ |
| O10 | Lokale Spezifikationen | Ordner `.local-specs/` (in `.gitignore`, nicht `out/`). Der XSD-Test wird ohne die Dateien übersprungen, mit deutlich sichtbarem Hinweis in der Testausgabe. Bezugsquellen stehen in `docs/lokale-spezifikationen.md`. |
| T1 | Tests der Textregeln | Weil das XSD allein nicht reicht, bekommt jede umgesetzte Textregel aus Anlage 3 einen eigenen Test. |

### Nachträge vor Schritt 0

| Nr. | Frage | Entscheidung |
|---|---|---|
| N1 | Node verlinken | `node@24` ist bei Homebrew keg-only. Freigegeben: `brew link --force --overwrite node@24` (ersetzt die alten, kaputten Links auf node 25.9.0_2). `~/.zshrc` wird nicht verändert. |
| N2 | Git-Identität | Nur für dieses Repo setzen (`git config user.name` / `user.email`), nicht global. Erledigt: `Leon Suvorkov <kontakt@lokalwerk.eu>`. |
| N3 | Positivliste in `check-dist.mjs` | Erlaubt sind nur reine Namensraum- und Schema-Adressen (z. B. schemas.openxmlformats.org, `http://www.w3.org/2001/XMLSchema-instance`), jede als exakte Adresse mit Begründung und Fundstelle, keine Platzhalter-Muster. Gilt nur für JavaScript, in HTML und CSS keine Ausnahmen. Jede neue Ausnahme nur nach Rückfrage. **Erweiterung (freigegeben 24.09.2026):** Auch `.svg` und `.xml` werden geprüft. Für diese Dateitypen sind genau `http://www.w3.org/2000/svg` und `http://www.sitemaps.org/schemas/sitemap/0.9` erlaubt, jeweils mit Begründung in der Positivliste. SVG-Dateien dürfen keine `<script>`-Elemente, keine Event-Attribute (`on…`) und keine externen `href`/`xlink:href` enthalten. **Kategorie „tote Adressen in Bibliotheken“ (freigegeben 24.09.2026):** nur zulässig, wenn alle Punkte erfüllt sind: exakte Adresse, kein Muster; gilt nur in dem Bundle-Teil, der diese Bibliothek enthält, nicht global; Begründung mit Fundstelle im Bibliothekscode; ein Test belegt, dass die Stelle bei uns nicht ausgeführt wird bzw. die Adresse nicht in erzeugten Dateien landet; jede weitere Ausnahme dieser Art nur nach Rückfrage. Erste Ausnahme: `https://github.com/Hopding/pdf-lib`, nur im PDF-Worker (siehe docs/pdf-lib.md, Nr. 9). |
| N4 | Laden der Bibliotheken | Werkzeugseiten laden ihre Bibliotheken und Worker direkt nach dem ersten Anzeigen, nicht erst bei Bedarf, damit sie offline funktionieren (A5). Die Startseite lädt keine davon. |
| N5 | Abhängigkeiten | Freigegeben am 24.09.2026, exakt gepinnt, `package-lock.json` wird committet. Siehe „Freigegebene Abhängigkeiten“ unten. |

### Freigegebene Abhängigkeiten

Nur zur Entwicklung (werden nicht ausgeliefert), Schritt 1:

| Paket | Version | Lizenz |
|---|---|---|
| vite | 8.3.1 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| vitest | 5.0.1 | MIT |
| eslint | 10.11.0 | MIT |
| @eslint/js | 10.0.1 | MIT |
| typescript-eslint | 8.70.1 | MIT |
| globals | 17.12.0 | MIT |
| eslint-config-prettier | 10.1.8 | MIT |
| prettier | 3.9.9 | MIT |
| @types/node | 24.13.6 | MIT |

**Notiz TypeScript:** Wir bleiben bei TypeScript 6.0.3, weil typescript-eslint 8.70.1 nur TypeScript `>=4.8.4 <6.1.0` unterstützt. Wechsel auf TypeScript 7, sobald typescript-eslint es unterstützt.

Für spätere Schritte vorab freigegeben:

| Paket | Version | Lizenz | Schritt | Bedingung |
|---|---|---|---|---|
| @fontsource/onest | 5.3.1 | OFL-1.1 | 2 | Nur die 5 WOFF2-Dateien werden ausgeliefert, dazu OFL.txt |
| pdf-lib | 1.17.1 | MIT | 4 | Nicht mehr gepflegt: bekannte offene Probleme, die uns betreffen können, in `docs/` festhalten und im Code darauf verweisen. Bundle-Größe pro Werkzeugseite nach dem Einbau melden. |
| SheetJS CE (xlsx) | 0.20.3 | Apache-2.0 | 6 | Ablage unter `vendor/` (A4). Bundle-Größe pro Werkzeugseite nach dem Einbau melden. |

Für alle drei gilt: Version im jeweiligen Schritt erneut prüfen. Hat sich etwas geändert, vorher fragen.

### Datenschutz und Hosting

- Phase 1 ändert nichts an der Datenverarbeitung. Datenschutzerklärung Abschnitt 2 (Hoster) füllt **Leon** aus, Claude lässt den Platzhalter stehen und weist im Abschlussbericht darauf hin.
- Cloudflare: Web Analytics, E-Mail-Adressen-Verschleierung (Email Obfuscation) und Rocket Loader bleiben aus. Das kommt als Checkliste in `docs/deployment.md`.

---

## 2. Architektur

- Jede URL ist eine echte HTML-Datei, kein clientseitiger Router. Vite baut alle Seiten unter `pages/`.
- Kopf, Fuß und Icons existieren nur einmal (`src/partials/`). Ein eigenes, kleines Vite-Plugin (`build/html-partials.ts`, ca. 50 Zeilen) setzt sie beim Build ein. Titel und Meta-Beschreibungen stehen zentral in `build/pages.ts`. Keine Template-Bibliothek.
- Jedes Werkzeug hat eine `main.html` (Kopfbereich, Arbeitsbereich, Erklärtext), die die Werkzeugseite beim Build einbindet und die Startseite für die Dateiübergabe nutzt.
- Rechenintensives im Web Worker: PDF zusammenfügen, Fotos verkleinern (OffscreenCanvas, sonst Haupt-Thread als Rückfall), Excel einlesen.
- CSV wird mit eigenem Code gelesen. SheetJS wird nur für .xlsx, .xls und .ods nachgeladen, nur auf der SEPA-Seite.
- `src/core/` greift nie auf das DOM zu. Uhrzeit und Zufallswerte werden als Parameter übergeben, damit Tests deterministisch sind.
- Der Prototyp liegt unter `prototype/` und wird nie gebaut oder ausgeliefert.

### Ordnerstruktur

```
lokalwerk-web/
├─ AGENTS.md, CLAUDE.md, plan.md
├─ package.json, tsconfig.json, vite.config.ts, eslint.config.js,
│  .prettierrc, .nvmrc, .gitignore
├─ build/        html-partials.ts, pages.ts
├─ scripts/      check-dist.mjs, validate-xsd.sh
├─ pages/        index.html, 404.html, <werkzeug>/index.html, pro/, impressum/, datenschutz/
├─ src/
│  ├─ core/      format, files, csv, sheet, sepa, xml, pdf, images
│  ├─ ui/        dom, toast, dropzone, download, local-counter, worker-client
│  ├─ partials/  header.html, footer.html, icons.svg
│  ├─ tools/
│  │  ├─ home/                     page.ts
│  │  ├─ pdf-zusammenfuegen/       main.html, page.ts, merge.worker.ts
│  │  ├─ fotos-verkleinern/        main.html, page.ts, resize.worker.ts
│  │  └─ sepa-sammelueberweisung/  main.html, page.ts, sheet.worker.ts, sample.ts
│  └─ styles/    tokens.css, fonts.css, base.css, components.css, layout.css, legal.css
├─ public/       fonts/ (5 × WOFF2 + OFL.txt), favicon.svg, robots.txt, sitemap.xml, _headers
├─ vendor/       SheetJS-Archiv + README.md
├─ docs/         agb-entwurf.md, sepa-entscheidungen.md, deployment.md
├─ tests/        core/… (spiegelt src/core), fixtures/ (+ SOURCES.md)
└─ prototype/    lokalwerk-prototyp.html (nur Referenz)
```

---

## 3. Seiten und URLs

| URL | Seite | `<title>` | Index |
|---|---|---|---|
| `/` | Startseite | Lokalwerk – Dateien bearbeiten, ohne Upload | ja |
| `/pdf-zusammenfuegen/` | Werkzeug | PDFs zusammenfügen, ohne Upload – Lokalwerk | ja |
| `/fotos-verkleinern/` | Werkzeug | Fotos verkleinern und Metadaten entfernen – Lokalwerk | ja |
| `/sepa-sammelueberweisung/` | Werkzeug | SEPA-Sammelüberweisung aus Excel oder CSV – Lokalwerk | ja |
| `/pro/` | Infoseite | Lokalwerk Pro | ja |
| `/impressum/` | Rechtstext | Impressum – Lokalwerk | noindex |
| `/datenschutz/` | Rechtstext | Datenschutzerklärung – Lokalwerk | noindex |
| `404.html` | Fehlerseite | Seite nicht gefunden – Lokalwerk | noindex |

Dazu `robots.txt`, `sitemap.xml` (nur indexierte Seiten) und `favicon.svg` (Schild-Logo aus dem Prototyp).

Meta-Beschreibungen und Erklärtexte unter den Werkzeugen (sachlich, du-Form, 100–150 Wörter) schreibt Claude als Entwurf und legt sie Leon gesammelt zur Freigabe vor, bevor die jeweilige Seite als fertig gilt.

---

## 4. Module in `src/core/`

| Modul | Inhalt |
|---|---|
| `format/bytes.ts`, `format/money.ts` | „1,4 MB“ und „1.234,56 €“ aus ganzen Cent |
| `files/classify.ts` | Ablage auf der Startseite: nur PDFs, nur Fotos oder genau eine Tabelle, sonst Meldung |
| `csv/decode.ts` | UTF-8 streng, sonst Windows-1252; BOM; UTF-16 (Excel „Unicode-Text“) |
| `csv/delimiter.ts` | `;`, `,` und Tab, beachtet Anführungszeichen, prüft mehrere Zeilen |
| `csv/parse.ts` | RFC 4180: Felder in Anführungszeichen, Umbrüche im Feld, `""` |
| `sheet/table.ts` | Leere Zeilen entfernen, Kopfzeile lesen, leere Überschriften als „Spalte n“ |
| `sheet/xlsx.ts` | Schmaler Adapter um SheetJS: erstes Blatt als Zeilen mit Text |
| `sepa/iban.ts`, `sepa/iban-countries.ts` | Normalisieren, Länge je Land, Modulo 97, Fehlergrund als Code, Nicht-EWR-Ausschluss (S4) |
| `sepa/bic.ts` | Format mit 8 oder 11 Zeichen |
| `sepa/amount.ts` | Text und Excel-Zahlen in ganze Cent, ohne Gleitkomma bei Text, Regeln aus B1 |
| `sepa/charset.ts` | Zeichensatz laut Spezifikation, Umschreibungstabelle, Kürzen, meldet Ersetzungen und Kürzungen |
| `sepa/columns.ts` | Vorschlag der Spaltenzuordnung anhand der Überschriften |
| `sepa/transfers.ts` | Zeilenprüfung: Fehler, Warnungen, Summe, ausgeschlossene Zeilen |
| `sepa/dates.ts` | Nächster Werktag in Ortszeit, Datumsprüfung (S9) |
| `sepa/ids.ts` | MsgId, PmtInfId, EndToEndId (max. 35 Zeichen) |
| `sepa/pain001.ts` | Erzeugung pain.001.001.09 inkl. BtchBookg-Option (S8) |
| `xml/escape.ts` | XML-Escaping |
| `pdf/merge.ts` | Seiten zählen, zusammenfügen (pdf-lib), verschlüsselte und beschädigte Dateien erkennen |
| `images/resize.ts` | Zielgröße und Name der Ausgabedatei, tatsächlichen Ausgabetyp prüfen (WebP-Rückfall) |
| `images/metadata-check.ts` | Prüft jedes fertige Foto auf EXIF-/GPS-Reste, bevor es zum Speichern angeboten wird |

---

## 5. Tests

Vitest in Node.

**IBAN:** gültige Beispiele je Land aus offizieller Quelle; falsche Prüfziffer, falsche Länge, unbekanntes Land, leeres Feld; Normalisierung von Kleinbuchstaben und Leerzeichen; Nicht-EWR-Ausschluss; alle IBANs der Beispieldaten (Zeile 5 muss durchfallen).

**Beträge:** `1.234,56`, `1234,56`, `1,234.56`, `12.50`, `12,5`, `30`, `€ 1.234,56`, `1 234,56` (auch mit geschütztem Leerzeichen); Excel-Gleitkomma-Rauschen; negative Werte, Text, leer, Höchstbetrag; mehrdeutige Fälle nach B1 (`1,234`, `1.234`, `33,333` → Fehler).

**Zeichensatz:** erlaubte Zeichen bleiben; Umschreibungen laut Tabelle; Zeilenumbrüche und Emoji entfernt; Kürzung auf 70/140/35 wird gemeldet.

**CSV:** alle drei Trennzeichen, Trennzeichen in Anführungszeichen, Umbrüche im Feld; BOM, Windows-1252-Umlaute, UTF-16, CRLF; leere Datei, nur Kopfzeile, leere Zeilen dazwischen.

**Excel:** im Test mit SheetJS erzeugte Dateien mit leeren Zeilen, Zahlen- und Textzellen.

**pain.001:** Vergleich mit fester Referenzausgabe; NbOfTxs und CtrlSum stimmen; fehlerhafte Zeilen fehlen; `&` korrekt maskiert; BtchBookg an/aus; Prüfung gegen das offizielle DK-XSD mit `xmllint` (`scripts/validate-xsd.sh`); Abgleich mit offiziellen Beispieldateien.

**PDF:** zwei im Test erzeugte PDFs zusammenfügen, Seitenzahl und Reihenfolge prüfen; leere, beschädigte und verschlüsselte Datei.

**Sonstiges:** nächster Werktag (Freitagabend → Montag, auch um 23:30 Uhr); Zielgröße der Fotos; Metadaten-Prüfung mit JPEG mit und ohne EXIF; Dateizuordnung der Startseite; Formatierung.

### Automatische Schutzmechanismen

- **ESLint** verbietet in `src/`: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`.
- **`scripts/check-dist.mjs`** durchsucht HTML, CSS und JS im Build nach Adressen fremder Domains und bricht den Build ab.
- **`public/_headers`** setzt eine Content-Security-Policy mit `connect-src 'none'` und ohne fremde Quellen. Worker, Blob-URLs und Fonts so erlauben, wie die Werkzeuge es brauchen, nicht breiter.

---

## 6. Reihenfolge

Nach jedem Schritt: kurzer Bericht nach AGENTS.md, Tests grün, Commit.

0. **Voraussetzungen:** Node (A1), `git init`, Umbenennen (A2), erster Commit.
1. **Gerüst:** Vite mit mehreren Seiten, TypeScript strict, Vitest, ESLint, Prettier, `_headers`, Prüfskript, leere Seiten mit Titeln.
2. **Designsystem:** Tokens inkl. Kontrast-Tokens (A6, Werte vorher vorlegen), Onest selbst gehostet (5 Schnitte, Latin-Subset, WOFF2 aus `@fontsource/onest`, dazu OFL.txt), Grundstile und Bausteine (Kopfzeile mit Plakette, Footer, Icons, Buttons, Karten, Ablagefläche, Toast).
3. **Statische Seiten:** Startseite (noch ohne Ablage-Logik), Pro, Impressum, Datenschutz, 404. AGB-Text nach `docs/agb-entwurf.md`.
4. **PDFs zusammenfügen:** `core/pdf`, Worker, Seite.
5. **Fotos verkleinern:** `core/images`, Worker, Seite.
6. **SEPA-Grundlagen:** Spezifikation laden (S1), `docs/sepa-entscheidungen.md` anlegen und S2, S3, S5, S6, S7 dort klären. **Danach anhalten und Ergebnis vorlegen.** Erst nach Freigabe: IBAN, BIC, Beträge, Zeichensatz, CSV, Excel-Adapter.
7. **pain.001 und Zeilenprüfung** inkl. XSD-Test.
8. **SEPA-Werkzeugseite** inkl. Hinweis „für deutsche Banken“ sowie Warnung (Datum > 15 Tage, O7) und Hinweis (nur eine Überweisung, O9). Sammelbuchung fest `true` (S8).
9. **Ablage auf der Startseite:** lädt das Werkzeug-Modul nach, setzt dessen `main.html` ein, ändert Titel und URL per `history.pushState`, übergibt die Datei im Arbeitsspeicher. Zurück-Taste lädt die Startseite neu, alle anderen Links sind normale Seitenwechsel.
10. **Endprüfung:** Netzwerk-Tab (keine fremden Domains), Offline-Test nach Variante (a), beide Farbmodi, 360 px Breite, Tastaturbedienung. Erklärtexte und Meta-Beschreibungen gesammelt zur Freigabe vorlegen. `docs/deployment.md` mit Cloudflare-Checkliste.

---

## 7. Abweichungen vom Prototyp

Optik und Texte bleiben gleich, mit diesen Ausnahmen:

- Footer „Lokalwerk“ statt „Lokalwerk, Prototyp“, ohne AGB-Link. „Prototyp:“ vor dem SEPA-Hinweis entfällt.
- `window.claude`-Speichercode entfällt, gespeichert wird über den normalen Browser-Download.
- Kontaktadresse überall `kontakt@lokalwerk.eu`.
- Neu: Hinweis „für deutsche Banken“ (S10). Kein Kontrollkästchen für die Sammelbuchung (S8 korrigiert).

Behobene Fehler:

- Ablageflächen zeigen beim Tab-Fokus einen sichtbaren Rahmen.
- Standard-Ausführungsdatum wird in Ortszeit statt UTC berechnet.
- Mehrdeutige Beträge werden nicht mehr stillschweigend gerundet (B1).
- WebP-Rückfall: tatsächlichen Dateityp prüfen, WebP bei fehlender Unterstützung mit Hinweis abschalten.
- `color-scheme` gesetzt, damit Datumsfeld und Auswahllisten im Dunkelmodus dunkel sind.
- Inline-`style`-Attribute werden zu CSS-Klassen (Content-Security-Policy).
- Fehlermeldungen konkret nach AGENTS.md Abschnitt 7, z. B. „Dieses Bildformat kann dein Browser nicht öffnen. Speichere das Foto als JPEG und versuch es noch einmal.“

---

## 8. Anhaltepunkte

Claude hält an und wartet auf Freigabe:

- nach Schritt 0 (Node, Git, Umbenennung erledigt),
- vor der Installation jeder Abhängigkeit (Angaben nach AGENTS.md Abschnitt 4),
- vor dem Einbau der Kontrast-Tokens (A6),
- nach Schritt 6 Teil 1 (SEPA-Spezifikation gelesen, `docs/sepa-entscheidungen.md` vorgelegt),
- nach Schritt 10 (Texte zur Freigabe, Abschlussbericht).

## 9. Aufgaben für Leon (nicht für Claude)

- Platzhalter in Impressum und Datenschutz ausfüllen (Name, Anschrift, Telefon, Hoster-Abschnitt mit Cloudflare).
- Namen „Lokalwerk“ im DPMAregister und bei TMview prüfen.
- Domain lokalwerk.eu registrieren, Cloudflare-Konto anlegen, Einstellungen laut `docs/deployment.md`.
- Gewerbe anmelden, bevor Pro Geld kostet.
- SEPA-Datei einmal mit echten Daten im Onlinebanking hochladen und prüfen (nicht freigeben).
- Rechtstexte vor dem Livegang professionell prüfen oder über einen Rechtstext-Dienst erstellen lassen.
