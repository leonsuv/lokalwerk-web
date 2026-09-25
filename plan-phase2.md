# Plan Phase 2 – Lokalwerk

Stand: 25.09.2026. Plan von Leon am 25.09.2026 freigegeben, mit den Entscheidungen E1–E18 unten. AGENTS.md und plan.md gelten unverändert weiter, auch die Anhaltepunkte aus plan.md Abschnitt 8. Leon gibt die Pakete einzeln frei (Abschnitt 6). **Paket 1 ist freigegeben.**

Ausdrücklich ausgeschlossen bleiben E-Rechnung und alles rund um Rechnungen. Kandidaten, die daran grenzen, sind im Text markiert (17 GiroCode, 24 Etiketten).

## Entscheidungen vom 25.09.2026

Antworten auf die Fragen aus Abschnitt 7. Wo Abschnitte 1–6 davon abweichen, gilt diese Liste.

| Nr. | Frage | Entscheidung |
|---|---|---|
| E1 | GiroCode und Rechnungen | Bauen, ohne jeden Rechnungsbezug: Spenden, Beiträge, Aushänge, Auslagen. Keine Rechnungsfelder, keine Beispiele mit Rechnungen. |
| E2 | Name | Titel neutral „QR-Code für Überweisungen (EPC-QR-Code)“. Das Wort „GiroCode“ vorerst **nirgends** verwenden, auch nicht im Erklärtext. Leon prüft die Marke im DPMA-Register. |
| E3 | ZIP | Variante c: ZIP überall kostenlos, eigene Implementierung ohne Kompression. „ZIP-Export“ auf der Pro-Seite und der Startseite streichen, ebenso den Pro-Hinweis im Werkzeug Fotos verkleinern. Neue Texte zur Freigabe vorlegen. |
| E4 | WebAssembly für pdf.js | `'wasm-unsafe-eval'` nur auf den Seiten mit pdf.js ist grundsätzlich freigegeben. Vorher Testergebnisse beider Varianten (mit/ohne WASM) vorlegen; Leon entscheidet dann endgültig. |
| E5 | QR-Bibliothek | uqr 0.1.3 freigegeben. |
| E6 | XML-Leser, pako | Eigener Leser in `core/xml/`, der DOCTYPE und externe Entitäten strikt ablehnt. pako als direkte Abhängigkeit freigegeben. |
| E7 | exifr | Freigegeben, Variante lite. Grenzen in `docs/` vermerken wie bei pdf-lib. |
| E8 | Schriften in erzeugten PDFs | Variante a: Zeichen außerhalb von WinAnsi mit klarer Meldung ablehnen. |
| E9 | Bankleitzahlendatei | Leon fragt bei der Bundesbank nach. Bis dahin 16 als reiner IBAN-Listen-Prüfer ohne Bankdaten, so gebaut, dass die Bankdaten später ergänzt werden können. |
| E10 | Etiketten | Nur Maße, keine Herstellerartikelnummern. |
| E11 | Passphrasen | Später, nicht in Phase 2. |
| E12 | Fristen | Zuerst nur der Arbeitstage-Rechner mit landesweiten Feiertagen. BGB-Fristen erst nach Rechtsprüfung. |
| E13 | Kategorieseiten | Vorerst nur `/werkzeuge/` mit Sprungmarken. |
| E14 | check-dist | Bibliotheks-Adresslisten gelten für jede Datei, die die Bibliothek laut `shipped-packages.ts` enthält. Mit Test, dass die Liste in einem Worker ohne die Bibliothek nicht greift. |
| E15 | Farben | Ocker und Violett vorläufig freigegeben. Vor dem Commit Screenshots der Übersichtsseite in beiden Modi vorlegen; danach endgültige Freigabe. |
| E16 | Startseiten-Titel | Mit Paket 1 erweitern, neue Texte zur Freigabe. |
| E17 | Lastschrift | Fachlogik und Tests in Paket 7. Leon legt die Unterlagen nach `.local-specs/dk/`. |
| E18 | HEIC | Gestrichen. |

### Paket 1 im Einzelnen

Reihenfolge der Schritte. Nach jedem Schritt: Tests, Build mit check-dist, Sichtprüfung. Am Ende: Audit aller Seiten (hell/dunkel, 360/1280 px, Netzwerk-Tab, Tastatur), Texte zur Freigabe, Screenshots der Übersichtsseite (E15), dann Halt.

| Schritt | Inhalt |
|---|---|
| 0 | Register um Werkzeugangaben erweitern, Kategorien mit Ocker und Violett, `/werkzeuge/` mit Sprungmarken und lokaler Suche, Verwandte-Werkzeuge-Block, Auswahl nach Dateityp auf der Startseite, „Alle Werkzeuge“ zeigt auf `/werkzeuge/`, check-dist nach E14 |
| 1 | ZIP ohne Kompression in `core/zip/` (E3), „Alle als ZIP speichern“ in Fotos verkleinern, „ZIP-Export“ auf Pro-Seite und Startseite streichen |
| 2 | 22 Excel ↔ CSV |
| 3 | 1 PDF teilen / Seiten extrahieren |
| 4 | 3 Bilder zu PDF |
| 5 | 8 PDF-Metadaten anzeigen und entfernen |
| 6 | 12 Bildformate umwandeln |
| 7 | Endprüfung, Texte zur Freigabe, Screenshots |

Commits: Die neuen Farbwerte (`src/styles/tokens.css`) werden erst nach Leons endgültiger Freigabe (E15) committet. Bis dahin enthalten die Commits der Schritte alles andere.

### Stand Paket 1 (25.09.2026)

| Schritt | Stand |
|---|---|
| 0 | fertig, committet |
| 1 | fertig, committet |
| 2 | fertig, committet nach Freigabe der drei Namensräume (P1-1) |
| 3–6 | fertig, committet |
| 7 | Audit aller Seiten ohne Befund (bis auf das bekannte Datumsfeld aus Phase 1), Texte zur Freigabe in `docs/texte-zur-freigabe.md`, Screenshots für E15 |

Abweichungen vom Plan, die beim Bauen entschieden wurden:
- Lokale Suche nur auf `/werkzeuge/`, nicht auf der Startseite (Abschnitt 3.3). Die Startseite zeigt ausgewählte Karten und „Alle Werkzeuge ansehen“; eine zweite Suche dort hätte nur diese Karten gefiltert.
- Excel ↔ CSV erkennt Zahlen und Datumswerte spaltenweise: Eine Spalte wird nur umgewandelt, wenn alle Werte darin eindeutig sind (sonst stünden in einer PLZ-Spalte Zahlen und Text gemischt).
- Die Metadaten-Prüfung liest jetzt auch PNG (für Bildformat umwandeln).
- „Kommentare und Markierungen“ bleiben beim Entfernen von PDF-Metadaten erhalten und werden angezeigt; ein Entfernen wäre eine eigene Funktion (Formularfelder und Verweise hängen daran).

Entscheidungen zu Paket 1 (25.09.2026):
- **P1-1:** Die drei Namensräume sind als Ergänzung zu Gruppe A1 freigegeben; Schritt 2 ist im Hauptzweig.
- **P1-2:** „SheetJS“ soll nicht in den Dateieigenschaften stehen. SheetJS 0.20.3 hat dafür keine Option: `write_ext_props` setzt `Application` fest auf „SheetJS“ (`node_modules/xlsx/xlsx.mjs`, Zeile 6001), nachdem die Workbook-Eigenschaften gelesen wurden; `docProps/app.xml` wird immer geschrieben. Geprüft am 25.09.2026, auch mit `Props: { Application: … }`. Bibliothekscode bleibt unverändert; **offen**, Lösungsweg entscheidet Leon.
- **P1-3:** „Fotos“ aus der Pro-Unterzeile gestrichen. Übrige Texte prüft Leon.
- **P1-4:** Ocker und Violett endgültig freigegeben, in AGENTS.md Abschnitt 6 eingetragen (Ocker nie für Warnungen).
- **Fokus Datumsfeld:** Fehler behoben. Tab springt im Datumsfeld zuletzt auf das Kalendersymbol; dann trifft `:focus` nicht mehr zu. Die Fokusregel gilt jetzt auch für `:focus-within`. Offen: Der Fokusring im Dunkelmodus (`--primary-soft`, 1,21:1 zur Karte) ist schwach; Vorschlag im Bericht.

## 0. Wie dieser Plan zu lesen ist

- **Suchbegriffe** sind Vermutungen. Ich habe kein Werkzeug für Suchvolumen benutzt und keine Zahlen erhoben.
- **Bibliotheken:** Ich habe nichts installiert. Die Pakete lagen nur zur Ansicht im Scratchpad dieser Sitzung. Versionen, Lizenzen und Stände stammen aus der npm-Registry (abgefragt am 25.09.2026), Größen aus eigener Messung der Dateien, Netzwerkcode aus einer Textsuche nach `fetch(`, `XMLHttpRequest`, `sendBeacon` und `WebSocket`. Vor jeder Freigabe prüfe ich das erneut, wie in AGENTS.md Abschnitt 4 verlangt.
- **Aufwand:**
  - S: ein Schritt, höchstens ein Tag
  - M: zwei bis drei Tage
  - L: eine Woche oder mehr, oder mit offenen fachlichen Fragen
- **Quellen:** Wo „vor dem Bau prüfen“ steht, habe ich die Quelle noch nicht im Wortlaut gelesen. Ich baue dann nichts aus dem Gedächtnis.
- **Gemeinsame Risiken aller Werkzeuge:** große Dateien, Speichergrenzen und Safari-Eigenheiten. Sie werden nicht bei jedem Werkzeug wiederholt, sondern gelten nach plan.md Abschnitt 5 und AGENTS.md Abschnitt 8.

## 1. Übersicht und Empfehlung

| Nr. | Werkzeug | Kategorie | Aufwand | Kostenlos/Pro | Empfehlung | Paket |
|---|---|---|---|---|---|---|
| 1 | PDF teilen / Seiten extrahieren | PDF | S | kostenlos | bauen | 1 |
| 2 | PDF-Seiten drehen, sortieren, löschen | PDF | M | kostenlos | bauen | 4 |
| 3 | Bilder zu PDF | PDF | M | kostenlos | bauen | 1 |
| 4 | PDF zu Bildern | PDF | M | kostenlos | bauen | 4 |
| 5 | PDF schwärzen | PDF | L | kostenlos | bauen | 4 |
| 6 | Seitenzahlen einfügen | PDF | M | kostenlos | bauen | 3 |
| 7 | Stempel / Wasserzeichen | PDF | M | kostenlos | bauen | 3 |
| 8 | PDF-Metadaten anzeigen/entfernen | PDF | S | kostenlos | bauen | 1 |
| 9 | PDF verkleinern | PDF | L | kostenlos | später | – |
| 10 | Unterschrift einfügen | PDF | M | kostenlos | bauen | 4 |
| 11 | HEIC zu JPG | Fotos | L | – | gestrichen (E18) | – |
| 12 | Bildformate umwandeln | Fotos | S | kostenlos | bauen | 1 |
| 13 | Fotos zuschneiden/drehen | Fotos | M | kostenlos | bauen | 6 |
| 14 | Gesichter/Kennzeichen verpixeln | Fotos | M | kostenlos (Automatik später Pro) | bauen | 6 |
| 15 | Foto-Metadaten anzeigen | Fotos | S | kostenlos | bauen | 6 |
| 16 | IBAN-Liste prüfen (Bankdaten später, E9) | Zahlungsverkehr | S | kostenlos | bauen | 5 |
| 17 | QR-Code für Überweisungen (EPC-QR-Code) | Zahlungsverkehr | S | kostenlos | bauen, ohne Rechnungsbezug (E1, E2) | 5 |
| 18 | camt.053 zu Excel/CSV | Zahlungsverkehr | L | kostenlos | bauen | 7 |
| 19 | SEPA-Lastschrift (pain.008) | Zahlungsverkehr | L | Pro | bauen, mit Pro | 7 |
| 20 | Zuwendungsbestätigung | Verein | L | – | später | – |
| 21 | CSV reparieren | Tabellen | S | kostenlos | bauen | 3 |
| 22 | Excel ↔ CSV | Tabellen | S | kostenlos | bauen | 1 |
| 23 | Duplikate finden | Tabellen | M | kostenlos | bauen | 3 |
| 24 | Etiketten-PDF aus Liste | Tabellen | M | kostenlos | bauen | 7 |
| 25 | Passwort-Generator | Alltag | S | kostenlos | bauen | 2 |
| 26 | Prüfsumme | Alltag | M | kostenlos | bauen | 2 |
| 27 | Textvergleich | Alltag | M | kostenlos | bauen | 2 |
| 28 | QR-Code (Link, WLAN, Kontakt) | Alltag | S | kostenlos | bauen | 5 |
| 29 | Arbeitstage-Rechner (BGB-Fristen später, E12) | Alltag | M | kostenlos | bauen | 7 |
| 30 | Kontrast-Prüfer | Alltag | S | kostenlos | bauen | 2 |
| A | Ausweiskopie datensparsam | Fotos | M | kostenlos | bauen | 6 |
| B | PDF-Formular ausfüllen | PDF | M | kostenlos | bauen | 4 |
| C | Dokument mit dem Handy scannen | PDF | L | kostenlos | bauen | 6 |
| D | SEPA-Text prüfen | Zahlungsverkehr | S | kostenlos | in 16 aufgehen lassen | 5 |
| E | Gläubiger-ID prüfen | Zahlungsverkehr | S | kostenlos | bauen | 5 |

## 2. Werkzeuge im Einzelnen

Bestehende Module in `src/core/` heißen unten kurz, z. B. `pdf/merge`, `sepa/iban`, `csv/parse`.

### PDF

**1 PDF teilen / Seiten extrahieren**
- Zweck: Einzelne Seiten oder Bereiche aus einer PDF herausholen oder sie in mehrere Dateien aufteilen, z. B. für Büros, die einen Sammelscan auf Vorgänge verteilen.
- Suchbegriff (vermutet): „pdf teilen“, „pdf seiten extrahieren“, „pdf trennen“.
- Module:
  - Neu: `pdf/split.ts` (Seitenbereiche wie „1-3, 5, 8-“ parsen und prüfen, Seiten per `copyPages` in neue Dokumente übernehmen) und `pdf/page-ranges.ts` (reine Funktion, gut testbar).
  - Wiederverwendet: `pdf/merge` (Laden, Fehlerarten, Verschlüsselung erkennen), `ui/dropzone`, `ui/worker-protocol`, `ui/download`.
- Bibliotheken: pdf-lib (freigegeben).
- Quelle: ISO 32000-2 nur mittelbar. pdf-lib-Grenzen aus docs/pdf-lib.md gelten. Formularfelder und Lesezeichen gehen beim Kopieren verloren; das ist dort als Grenze 1–9 dokumentiert und wird hier angezeigt.
- Risiken und Grenzen:
  - Mehrere Ergebnisdateien brauchen entweder mehrere Downloads oder ein ZIP. ZIP ist auf /pro/ als Pro-Funktion für Fotos angekündigt (Frage 3).
  - Verschlüsselte PDFs werden abgelehnt, wie beim Zusammenfügen.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen**. Nutzt fast nur vorhandenen Code, großes Suchinteresse. Ohne Vorschau: Auswahl über Seitenzahlen, Seitenanzahl wird angezeigt.

**2 PDF-Seiten drehen, sortieren, löschen (mit Vorschau)**
- Zweck: Seiten einer PDF als Vorschaubilder sehen, per Maus oder Tastatur umsortieren, drehen oder löschen.
- Suchbegriff: „pdf seiten drehen“, „pdf seiten löschen“, „pdf seiten sortieren“.
- Module:
  - Neu: `pdf/organize.ts` (Seitenfolge und Drehung als reine Daten anwenden, pdf-lib `setRotation`) und `ui/page-grid.ts` (Vorschau-Raster, sortierbar per Tastatur).
  - Wiederverwendet: die Sortierlogik und Tastaturbedienung der Dateiliste aus PDF zusammenfügen.
- Bibliotheken:
  - pdf-lib (freigegeben).
  - **pdfjs-dist 6.3.289** (in AGENTS.md freigegeben, aber noch nicht eingebunden): Apache-2.0, zuletzt geändert am 29.08.2026. `pdf.min.mjs` hat 459 KB (131 KB gzip), `pdf.worker.min.mjs` 1,27 MB (374 KB gzip). Keine Abhängigkeiten.
  - Netzwerk: pdf.js lädt CMaps, Standardschriften und WASM-Dateien per `fetch` nach. Das muss abgeschaltet oder durch lokale Fabriken ersetzt werden (Abschnitt 5.1).
- Quelle: ISO 32000-2 (Seitendrehung `/Rotate` in 90-Grad-Schritten).
- Risiken:
  - Viele Seiten bedeuten viel Speicher für die Vorschaubilder. Kleine Vorschauen rendern und nur sichtbare Seiten zeichnen (IntersectionObserver).
  - Die Tastaturbedienung beim Sortieren muss WCAG 2.2 erfüllen (2.5.7 Ziehbewegungen: es braucht eine Alternative ohne Ziehen).
- Aufwand: M (plus einmalig S für die pdf.js-Einbindung, die 4, 5, 10 und B mitnutzen).
- Kostenlos.
- Empfehlung: **bauen** in Paket 4. Hoher Nutzen, und die Vorschau ist Grundlage für 4, 5, 10 und B.

**3 Bilder zu PDF**
- Zweck: Fotos oder Scans (JPG, PNG, auch WebP über Umwandlung) zu einer PDF zusammenfassen, z. B. Belege für die Steuerberatung.
- Suchbegriff: „jpg in pdf umwandeln“, „bilder zu pdf“, „fotos als pdf“.
- Module:
  - Neu: `pdf/from-images.ts` (Seitengröße: DIN A4 hoch/quer oder Bildgröße; Rand; Einpassen).
  - Wiederverwendet:
    - `images/resize` (Ausrichtung nach EXIF, Verkleinern vor dem Einbetten)
    - `files/classify`
    - Dateiliste und Sortierung aus PDF zusammenfügen
- Bibliotheken: pdf-lib (`embedJpg`, `embedPng`). Andere Formate werden vorher über die Canvas in JPG oder PNG umgewandelt.
- Quelle: DIN A4 = 210 × 297 mm (ISO 216), in PDF-Punkten 595,28 × 841,89.
- Risiken:
  - JPG wird ohne Neukodierung eingebettet, wenn keine Verkleinerung gewählt ist. Dabei wird die EXIF-Drehung nicht angewandt, also muss gedreht und neu kodiert werden, wenn die Ausrichtung nicht 1 ist.
  - Metadaten im eingebetteten JPG bleiben erhalten. Standardmäßig entfernen, wie beim Fotos-Verkleinern.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen**. Verbindet zwei bestehende Werkzeuge, großes Suchinteresse.

**4 PDF zu Bildern**
- Zweck: Jede Seite einer PDF als JPG oder PNG speichern, z. B. für Präsentationen oder Webseiten.
- Suchbegriff: „pdf in jpg umwandeln“, „pdf zu png“.
- Module: neu `pdf/render.ts` (UI-nah, pdf.js im Worker) und `images/encode.ts` (gemeinsam mit 12). Wiederverwendet `format/bytes`.
- Bibliotheken: pdfjs-dist (wie 2).
- Quelle: keine Norm nötig. Auflösung in dpi = Punkte / 72 × dpi.
- Risiken:
  - Mehrere Ergebnisdateien führen zur ZIP-Frage 3.
  - Große Seiten bei 300 dpi überschreiten Canvas-Grenzen (Safari begrenzt die Canvas-Fläche). Grenze erkennen und die Auflösung verständlich herabsetzen.
  - Schriften, die pdf.js ohne Standardschrift-Daten ersetzt, können leicht anders aussehen (Abschnitt 5.1).
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 4.

**5 PDF schwärzen**
- Zweck: Bereiche einer PDF sicher unkenntlich machen, z. B. Kontonummern oder Namen vor der Weitergabe. Zielgruppe: Kanzleien, Verwaltungen, Vereine.
- Suchbegriff: „pdf schwärzen“, „pdf text schwärzen kostenlos“.
- Module:
  - Neu: `pdf/redact.ts`. Seiten rendern (pdf.js), Rechtecke in Seitenkoordinaten entgegennehmen, auf das gerenderte Bild schwärzen und eine neue PDF nur aus Bildern bauen (pdf-lib).
  - Neu: `ui/rect-editor.ts` (Rechtecke zeichnen, per Tastatur verschieben und in der Größe ändern; gemeinsam mit 14 und A).
  - Wiederverwendet: `pdf/from-images` aus 3.
- Bibliotheken: pdfjs-dist, pdf-lib.
- Quelle: ISO 32000-2 für Koordinaten. Für Schwärzen gibt es keine Norm, auf die ich mich stützen würde. Die BSI-Hinweise zum Schwärzen (falls vorhanden) prüfe ich vor dem Bau, statt sie zu zitieren.
- Risiken:
  - **Haftung:** Der Nutzer verlässt sich darauf, dass nichts mehr lesbar ist. Deshalb wird die ganze Seite gerastert: kein Text, keine Metadaten, keine Formularfelder, keine Anhänge, keine Ebenen bleiben übrig. Das ist technisch garantierbar und wird so erklärt.
  - Nebenwirkungen: Das Ergebnis ist nicht mehr durchsuchbar, größer und nicht barrierefrei. Das steht im Hinweis.
  - Auflösung wählbar (150/200/300 dpi).
  - Schwärzen nach Suchbegriff (Textsuche mit Trefferfeldern) erst in einer späteren Ausbaustufe. Treffer, die pdf.js nicht als Text sieht (Scans), würden sonst fälschlich als „alles erwischt“ gelten.
  - Hinweis im Werkzeug, dass der Nutzer das Ergebnis selbst prüfen muss (AGENTS.md Abschnitt 9).
- Aufwand: L.
- Kostenlos.
- Empfehlung: **bauen**. Stärkstes Beispiel für das Produktversprechen: Gerade diese Dateien lädt man nicht hoch.

**6 Seitenzahlen einfügen**
- Zweck: Seitenzahlen („Seite 3 von 12“) in Kopf- oder Fußzeile setzen, z. B. für Anlagenkonvolute in Kanzleien.
- Suchbegriff: „pdf seitenzahlen einfügen“.
- Module: neu `pdf/stamp-text.ts` (Text an Position setzen, gemeinsam mit 7). Das berücksichtigt `/Rotate`, CropBox-Versatz und die Textbreite aus den Schriftmetriken. Wiederverwendet: `pdf/page-ranges` aus 1 (Startnummer, Seiten auslassen).
- Bibliotheken: pdf-lib mit Standardschrift Helvetica (WinAnsi). Keine Vorschau nötig: feste Positionen, Vorschau optional mit pdf.js in Paket 4.
- Quelle: ISO 32000-2 (Seitengeometrie).
- Risiken:
  - WinAnsi kennt nicht alle Zeichen. Bei reinen Zahlen und „Seite x von y“ ist das kein Problem. Freitext mit Zeichen außerhalb von WinAnsi führt zur Schriftfrage 8.
  - Signierte PDFs verlieren ihre Signatur. Das erkennen und darauf hinweisen.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 3.

**7 Stempel / Wasserzeichen**
- Zweck: Text wie „Entwurf“, „Kopie“ oder „Nur zur Vorlage beim Finanzamt“ auf alle Seiten setzen, gerade oder diagonal, halbtransparent.
- Suchbegriff: „pdf wasserzeichen einfügen“, „pdf stempel“.
- Module: `pdf/stamp-text.ts` aus 6. Transparenz über den Grafikzustand in pdf-lib (`opacity`).
- Bibliotheken: pdf-lib.
- Quelle: ISO 32000-2.
- Risiken:
  - Ein Wasserzeichen ist kein Schutz. Es lässt sich mit PDF-Editoren wieder entfernen, weil es als eigenes Objekt über der Seite liegt. Das steht im Erklärtext. Wer es fest braucht, kombiniert mit 5 (Rastern); das könnte eine Option „Seiten zu Bildern machen“ werden.
  - Schriftfrage 8 wie bei 6.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 3.

**8 PDF-Metadaten anzeigen und entfernen**
- Zweck: Zeigen, was in einer PDF an versteckten Angaben steckt (Autor, Programm, Erstellungsdatum, XMP), und diese entfernen.
- Suchbegriff: „pdf metadaten entfernen“, „pdf autor entfernen“.
- Module:
  - Neu: `pdf/metadata.ts`.
    - Lesen: Info-Wörterbuch und XMP-Strom (`/Metadata` im Katalog).
    - Entfernen: Seiten per `copyPages` in ein neues Dokument übernehmen und Info-Werte leer setzen. So fallen auch verwaiste Objekte und frühere Versionen aus inkrementellen Speicherungen weg.
    - Anzeigen, was sonst noch drin ist: Anhänge, Formularfelder, Anmerkungen, JavaScript, Seitenzahl.
  - Wiederverwendet: Ladeweg aus `pdf/merge`.
- Bibliotheken: pdf-lib. Wichtig: pdf-lib setzt beim Speichern selbst Producer und Creator. Das wird geleert (setProducer/setCreator mit leerem Wert). Genau prüfen, weil die pdf-lib-Adresse im Producer bereits Thema war (plan.md N3, tote Adresse).
- Quelle: ISO 32000-2, Abschnitt 14.3 (Metadaten: Info-Wörterbuch und Metadatenströme). Vor dem Bau im Wortlaut nachlesen.
- Risiken:
  - Nicht alles lässt sich garantiert entfernen: Text in Bildern, Kommentare im Seiteninhalt und Metadaten in eingebetteten Bildern (EXIF in JPG) bleiben. Die Oberfläche sagt genau, was entfernt wurde und was nicht. Kein „alle Metadaten entfernt“.
  - Formularfelder und Lesezeichen gehen durch `copyPages` verloren (docs/pdf-lib.md).
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen**. Passt genau zum Datenschutz-Profil und zum Fotos-Werkzeug.

**9 PDF verkleinern**
- Zweck: Große PDFs (meist Scans) für E-Mail oder Behördenportale verkleinern.
- Suchbegriff: „pdf verkleinern“ (vermutlich einer der größten Suchbegriffe überhaupt).
- Module: neu `pdf/compress.ts`. Eingebettete JPG-Bilder (DCTDecode) herunterrechnen und neu kodieren. Andere Bildarten (Flate mit Farbraum, JBIG2, JPX, Masken, Indexfarben) nur mit großem Aufwand.
- Bibliotheken: pdf-lib für den Zugriff auf Bildobjekte. Dekodieren und Kodieren über Canvas/OffscreenCanvas.
- Quelle: ISO 32000-2, Abschnitte zu Bild-XObjects und Filtern.
- Risiken:
  - Ehrlichkeit: Bei PDFs ohne große JPG-Bilder bringt das fast nichts. Das Werkzeug muss vorher sagen, ob es etwas bringt („In dieser Datei stecken 2 MB in Bildern, die sich verkleinern lassen“), statt ein Versprechen zu machen.
  - Farbräume (CMYK, ICC) können beim Umkodieren verfälscht werden.
  - Ein Rendern und neu Einbetten der ganzen Seite (wie bei 5) wäre einfacher, zerstört aber Text und Durchsuchbarkeit.
- Aufwand: L.
- Kostenlos.
- Empfehlung: **später**. Hohes Suchinteresse, aber ein ehrliches Ergebnis braucht viel Arbeit und Testdateien. Nach Paket 4, wenn pdf.js und die Bildwege stehen.

**10 Unterschrift einfügen**
- Zweck: Eine gezeichnete oder als Bild abgelegte Unterschrift auf eine PDF-Seite setzen, z. B. für Formulare, die ausgedruckt und eingescannt würden.
- Suchbegriff: „pdf unterschreiben“, „unterschrift in pdf einfügen“.
- Module: neu `pdf/place-image.ts` (Bild an Rechteck setzen, gemeinsam mit A) und `ui/signature-pad.ts` (Zeichenfläche). Wiederverwendet: `ui/rect-editor` aus 5, Vorschau aus 2.
- Bibliotheken: pdfjs-dist (Vorschau), pdf-lib (Einbetten als PNG mit Transparenz).
- Quelle: eIDAS-Verordnung (EU) Nr. 910/2014, Art. 3 (Begriffe elektronische, fortgeschrittene und qualifizierte elektronische Signatur); § 126a BGB (elektronische Form). Vor dem Bau im Wortlaut prüfen.
- Risiken:
  - **Rechtlich:** Das Ergebnis ist ein Bild einer Unterschrift, keine qualifizierte elektronische Signatur und auch keine fortgeschrittene. Es ersetzt nicht die Schriftform (§ 126 BGB). Das steht deutlich im Werkzeug.
  - Die Unterschrift wird **nicht** gespeichert (Regel 5). Speichern wäre eine Pro-Vorlage und nur auf ausdrücklichen Wunsch.
  - Vorhandene digitale Signaturen in der PDF werden ungültig. Das erkennen und darauf hinweisen.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 4.

### Fotos

**11 HEIC zu JPG**
- Zweck: iPhone-Fotos (HEIC) für Windows-Rechner, Portale und E-Mail in JPG umwandeln.
- Suchbegriff: „heic in jpg umwandeln“ (hohes Suchinteresse).
- Module: `images/encode` aus 12, Dekoder fehlt.
- Bibliotheken:
  - Einen HEIC-Dekoder gibt es nur als Bibliothek mit libheif und libde265 (beide LGPL-3.0). Beispiele:
    - heic2any 0.0.4: als „MIT“ markiert, bündelt aber libheif, zuletzt 2023
    - libheif-js 1.23.2: LGPL-3.0
    - heic-decode 2.1.0: ISC, hängt aber an libheif-js
  - Nach AGENTS.md Abschnitt 4 nur mit Freigabe und als separat geladene, austauschbare Datei.
  - Nativ dekodiert nur Safari HEIC (dort braucht das Werkzeug keine Bibliothek).
- Quelle: ISO/IEC 23008-12 (HEIF), ISO/IEC 23008-2 (HEVC). Beide kostenpflichtig.
- Risiken:
  - **Patente:** HEVC ist patentbelastet (mehrere Patentpools). Ein eigener HEVC-Dekoder, auch per WebAssembly, kann lizenzpflichtig sein. Das kann ich nicht beurteilen und würde es nicht ohne Rechtsrat ausliefern.
  - LGPL-Pflichten (Austauschbarkeit, Quelltext-Angebot) bei einer statischen Website.
  - Größe: libheif als WASM liegt im Bereich mehrerer MB.
- Aufwand: L.
- Empfehlung: **streichen (vorerst)**. Alternative ohne Bibliothek: Im bestehenden Fotos-Werkzeug erkennt Safari HEIC bereits; dort zeigt der Hinweis den Weg. Neu prüfen, wenn Chrome und Firefox HEIC nativ dekodieren.

**12 Bildformate umwandeln**
- Zweck: PNG, JPG, WebP untereinander umwandeln, z. B. WebP aus dem Web in JPG für Office.
- Suchbegriff: „webp in jpg umwandeln“, „png in jpg“.
- Module: neu `images/encode.ts` (Zielformat, Qualität, Hintergrundfarbe für Transparenz bei JPG). Wiederverwendet: `images/resize` (Dekodieren, Ausrichtung, Worker), `images/metadata-check`, Dateiliste aus Fotos verkleinern.
- Bibliotheken: keine. Canvas/OffscreenCanvas `convertToBlob`.
- Quelle: keine Norm für die Umwandlung selbst.
- Risiken:
  - Welche Zielformate der Browser kodieren kann, ist unterschiedlich. WebP-Kodierung fehlt in manchen Safari-Versionen: Der Browser liefert dann stillschweigend PNG. Das Werkzeug prüft den tatsächlichen Typ des Ergebnisses und bietet nur an, was geht. AVIF-Kodierung wird nicht angeboten.
  - Transparenz geht bei JPG verloren; Hintergrund wählbar.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 1.

**13 Fotos zuschneiden und drehen**
- Zweck: Fotos zuschneiden (frei oder festes Seitenverhältnis wie Passbild 35 × 45 mm, 1:1, 16:9) und drehen.
- Suchbegriff: „bild zuschneiden online“, „foto drehen“.
- Module: neu `images/crop.ts` (reine Geometrie: Rechteck, Seitenverhältnis, Drehung in 90-Grad-Schritten, Pixelgrenzen). Wiederverwendet: `ui/rect-editor` aus 5, `images/encode`.
- Bibliotheken: keine.
- Quelle: Passbildmaße nur, wenn ich sie belegen kann: Passverordnung, Anlage mit Fotomustertafel. Vor dem Bau prüfen, sonst ohne Passbild-Voreinstellung.
- Risiken: Freies Drehen (nicht 90 Grad) verändert Pixel und braucht Hintergrund. In der ersten Stufe nur 90-Grad-Schritte und Spiegeln.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 6.

**14 Gesichter und Kennzeichen verpixeln (manuell)**
- Zweck: Personen und Kennzeichen auf Fotos unkenntlich machen, z. B. für Vereinswebseiten oder Schadensmeldungen.
- Suchbegriff: „gesicht verpixeln“, „kennzeichen unkenntlich machen“.
- Module: neu `images/obscure.ts` (Verpixeln mit großen Blöcken oder Füllen; kein Weichzeichnen, weil sich weichgezeichnete Bereiche teilweise rekonstruieren lassen). Wiederverwendet: `ui/rect-editor`, `images/encode`, Metadatenentfernung aus Fotos verkleinern.
- Bibliotheken: keine. Automatische Erkennung wäre ein Modell im Browser (Regel 4) und ein Pro-Kandidat für später, eigene Freigabe.
- Quelle: für das Verfahren keine. Rechtlicher Hintergrund (KUG § 22, DSGVO) nur im Erklärtext, und nur in Worten, die der Betreiber freigibt.
- Risiken:
  - Zu kleine Pixelblöcke lassen Gesichter erkennbar. Die Blockgröße richtet sich nach der Rechteckgröße (höchstens etwa 8 Blöcke über die Breite), nicht nach dem Bild.
  - GPS-Daten entfernen ist standardmäßig an.
- Aufwand: M.
- Kostenlos (Automatik später Pro).
- Empfehlung: **bauen** in Paket 6.

**15 Foto-Metadaten anzeigen**
- Zweck: Zeigen, was ein Foto verrät (Aufnahmeort als Koordinaten in Textform, Kamera, Datum, Software), bevor man es weitergibt.
- Suchbegriff: „exif daten anzeigen“, „foto metadaten auslesen“.
- Module: neu `images/exif-read.ts` (Übersetzung der Felder in verständliche Namen, Koordinaten als Grad/Minuten/Sekunden). Wiederverwendet: `images/metadata-check`, Verweis auf Fotos verkleinern zum Entfernen.
- Bibliotheken:
  - **exifr 7.1.3** (in AGENTS.md freigegeben, noch nicht eingebunden): MIT, letzte Veröffentlichung 01.05.2022, also seit über vier Jahren ohne Update.
  - Größe: `lite.esm.mjs` 45 KB (14,8 KB gzip), `full.esm.mjs` 75,5 KB (26 KB gzip).
  - Kein Netzwerkcode gefunden. Enthält Adressen: XMP-Namensräume `http://ns.adobe.com/…` und eine GitHub-Adresse, also neue Einträge für check-dist (Abschnitt 5.2).
  - Alternative ohne Bibliothek: eigener EXIF-Leser nur für JPG (TIFF-Struktur in APP1). Das sind eher 250 als 150 Zeilen, daher Bibliothek vorgeschlagen.
- Quelle: CIPA DC-008 (Exif 2.32 / 3.0), frei bei CIPA.
- Risiken:
  - Ort nur als Text, **keine Karte** (eine Karte wäre eine Anfrage an einen Kartendienst).
  - Der Pflegestand von exifr ist alt. Das ist vertretbar, weil das Paket nur liest und das EXIF-Format stabil ist, aber es sollte bewusst entschieden werden (Frage 7).
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 6.

### Zahlungsverkehr und Verein

**16 IBAN-Liste prüfen, mit Bankname und BIC**
- Zweck: Eine Liste mit IBANs (Mitglieder, Lieferanten) prüfen und zu deutschen IBANs Bankname und BIC ergänzen.
- Suchbegriff: „iban prüfen“, „iban liste prüfen“, „bic zu iban“.
- Module:
  - Neu: `sepa/blz.ts` (Suche in den Bundesbank-Daten), `build/blz-data.ts` (wandelt die Bundesbank-Datei beim Build in ein kompaktes Modul um, nur Zeilen mit Merkmal „1“ = bankleitzahlführend) und `sepa/check-list.ts`.
  - Wiederverwendet:
    - `sepa/iban`, `sepa/iban-countries`, `sepa/bic`
    - `csv/*`, `sheet/*`, `sepa/columns` (Spaltenerkennung)
    - die Fehlerliste der SEPA-Seite
    - Suggestion D (SEPA-Text prüfen) als zweiter Reiter
- Bibliotheken: keine neuen. Die Daten kommen als Datei der Bundesbank ins Repo.
- Quelle und Nutzungsbedingungen:
  - Deutsche Bundesbank, Bankleitzahlendatei (TXT, CSV, XML). Laut Download-Seite gilt die aktuelle Datei vom 07.09.2026 bis 06.12.2026. Die nächste Datei wird für November 2026 erwartet, danach vierteljährlich.
  - Die Bundesbank schreibt dort: „Der verbindliche Bankleitzahlen-Änderungsdienst erfolgt für Zahlungsdienstleister durch einen gesicherten Download von der NExt-Plattform der Deutschen Bundesbank. Ergänzend stellt die Deutsche Bundesbank die Bankleitzahlendatei unverbindlich ins Internet ein.“ Für Nutzungsbedingungen verweist sie auf ihr Impressum. Dort habe ich keine Regelung zur Weiterverwendung gefunden (Frage 9).
  - Prüfzifferverfahren der Kontonummer: Bundesbank, „Prüfzifferberechnungsmethoden“. Über 100 Verfahren, der Aufwand ist L. Nicht in der ersten Stufe: Die IBAN-Prüfziffer (Modulo 97) erkennt Tippfehler bereits zuverlässig.
- Risiken:
  - **Veraltete Daten:** Das Werkzeug zeigt „Bankdaten gültig bis 06.12.2026“. Nach Ablauf erscheint ein Hinweis, dass die Angaben veraltet sein können. Die Aktualisierung ist ein Handgriff für Leon oder mich pro Quartal (neue Datei ins Repo, Build).
  - Gelöschte Bankleitzahlen mit Nachfolge-BLZ: laut Datei-Beschreibung der Bundesbank behandeln, nicht raten.
  - Größe: geschätzt 150–250 KB roh, 40–70 KB gzip, nur auf dieser Seite. Die Schätzung prüfe ich an der echten Datei.
  - Nur deutsche IBANs bekommen Bankname und BIC. Für andere Länder gibt es keine freie amtliche Quelle, die ich kenne.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen**, sobald Frage 9 geklärt ist. Ohne Bankdaten ist es ein reiner IBAN-Prüfer (S), der sofort gebaut werden könnte.

**17 GiroCode erstellen**
- Zweck: Einen QR-Code erzeugen, den Banking-Apps als Überweisung einlesen, z. B. für Spendenaufrufe, Mitgliedsbeiträge oder Aushänge von Vereinen.
- Suchbegriff: „girocode erstellen“, „qr code überweisung erstellen“, „epc qr code“.
- Module: neu `sepa/epc-qr.ts` (Nutzdaten nach EPC069-12 aufbauen und prüfen, reine Funktion). Wiederverwendet: `sepa/iban`, `sepa/bic`, `sepa/amount`, `sepa/charset` (Zeichensatz). QR-Kodierung siehe 28.
- Bibliotheken: QR-Bibliothek wie bei 28.
- Quelle:
  - EPC069-12 Version 3.1 „Quick Response Code – Guidelines to Enable the Data Capture for the Initiation of a SEPA Credit Transfer“, gültig seit 19.03.2024, vom European Payments Council. Gelesen am 25.09.2026, maßgebliche Punkte:
    - Fehlerkorrektur M, höchstens QR-Version 13, Nutzdaten höchstens 331 Byte
    - Kennung „BCD“, Version 001 oder 002 (BIC bei 002 optional im EWR)
    - Name höchstens 70 Zeichen, IBAN, Betrag von EUR0.01 bis EUR999999999.99
    - Verwendungszweck unstrukturiert (140 Zeichen) oder Referenz (35 Zeichen), nicht beides
  - Das Dokument ist als „Public“ gekennzeichnet. Einen Nutzungsvermerk habe ich darin nicht gefunden.
- Risiken:
  - **Abgrenzung Rechnungen:** EPC069-12 nennt als Hauptfall ausdrücklich den Code auf einer Rechnung. Das Werkzeug würde ich ohne jeden Rechnungsbezug bauen (Spenden, Beiträge, Auslagen, Aushang) und keine Rechnungsfelder anbieten. Ob das zu Leons Ausschluss passt, entscheidet Leon (Frage 1).
  - **Markenname:** „GiroCode“ ist nach meinem Kenntnisstand eine Marke aus der deutschen Kreditwirtschaft. Nicht geprüft; vor Verwendung des Worts im Titel im Register des DPMA prüfen (Frage 2). Ausweichbegriff: „QR-Code für Überweisungen (EPC-QR-Code)“.
  - Die Spezifikation verlangt, dass die Daten zusätzlich im Klartext neben dem Code stehen. Das PNG/SVG-Ergebnis kann den Klartext optional darunter setzen.
  - Hinweis: Nutzer müssen den Code vor dem Druck mit ihrer eigenen Banking-App testen.
- Aufwand: S (plus QR-Bibliothek).
- Kostenlos.
- Empfehlung: **nur nach Entscheidung zu Frage 1**. Technisch klein und nützlich für Vereine.

**18 camt.053 zu Excel/CSV**
- Zweck: Elektronische Kontoauszüge (camt.053, oft als ZIP von der Bank) lesbar als Tabelle speichern, z. B. für Kassenwarte und die Buchhaltung kleiner Firmen.
- Suchbegriff: „camt.053 in excel umwandeln“, „camt datei öffnen“.
- Module:
  - Neu: `xml/parse.ts` (Frage 6), `camt/read053.ts` (Buchungen, Beträge in Cent, Soll/Haben, Valuta, Gegenkonto, Verwendungszweck, Buchungstext) und `zip/read.ts` (ZIP mit mehreren Auszügen).
  - Wiederverwendet:
    - `sepa/amount` (Cent)
    - `sheet/*` und SheetJS zum Schreiben (Tabellen- und Arbeitsblatt-Export aus 22)
    - pako, bereits als Unterabhängigkeit von pdf-lib ausgeliefert, zum Entpacken. Als direkte Abhängigkeit braucht das eine kurze Freigabe (Frage 6).
- Bibliotheken: keine neuen, wenn Frage 6 mit „eigener Parser“ beantwortet wird.
- Quelle: DFÜ-Vereinbarung, Anlage 3 (Kontoinformationen camt.052/053/054, Belegung durch die Deutsche Kreditwirtschaft). Welche camt.053-Versionen deutsche Banken aktuell liefern, lese ich in der Anlage nach und nehme es nicht an. Beispieldateien aus der Anlage nach `tests/fixtures/`.
- Risiken:
  - Mehrere Versionen im Umlauf (Namensraum unterscheidet sich). Unbekannte Versionen werden abgelehnt, nicht geraten.
  - Sammelbuchungen (Batch) mit Einzelposten: Darstellung klären.
  - Die Buchungstext-Codes (GVC) stehen in einer Tabelle der Anlage. Nur übernehmen, was dort steht.
  - Enthält Kontodaten Dritter; läuft lokal, keine Änderung am Datenschutz.
- Aufwand: L.
- Kostenlos.
- Empfehlung: **bauen** in Paket 7. Echter Bedarf, kaum Konkurrenz ohne Upload.

**19 SEPA-Lastschrift (pain.008)**
- Zweck: Aus einer Liste eine Lastschriftdatei erzeugen, z. B. für Mitgliedsbeiträge.
- Suchbegriff: „sepa lastschrift datei erstellen“, „mitgliedsbeiträge lastschrift excel“.
- Module: neu `sepa/pain008.ts`, `sepa/mandates.ts` (Mandatsreferenz, Datum der Unterschrift, Sequenztyp) und `sepa/creditor-id.ts` (aus E). Wiederverwendet: alles aus der Sammelüberweisung (`columns`, `charset`, `amount`, `iban`, `dates`, `ids`, Prüfliste, Zusammenfassung).
- Bibliotheken: keine.
- Quelle:
  - DFÜ-Vereinbarung, Anlage 3 (pain.008 in der gültigen Version) und das zugehörige DK-Schema (TVS)
  - EPC SDD Core Rulebook und SDD B2B Rulebook
  - Gläubiger-ID nach Bundesbank
  - Vorlagefristen, Sequenztypen und Pflichtfelder lese ich dort nach. Das Schema kommt wie bei pain.001 nach `.local-specs/`.
- Risiken:
  - **Haftung:** Falsche Lastschriften führen zu Rücklastschriften mit Gebühren für den Verein. Deshalb derselbe Prüfhinweis wie bei der Überweisung.
  - Pro braucht Lizenzprüfung und Zahlungsablauf; dafür ist die Ausnahme in Regel 1 nur mit ausdrücklicher Freigabe offen, und der Zahlungsanbieter ist noch offen (AGENTS.md Abschnitt 10). Solange Pro nicht existiert, kann dieses Werkzeug nicht erscheinen.
- Aufwand: L.
- **Pro.** Auf /pro/ und der Startseite ist „SEPA-Lastschriften“ schon als Pro-Funktion angekündigt; kostenlos anzubieten wäre die umgekehrte Richtung von AGENTS.md Abschnitt 10 und ist erlaubt, würde Pro aber schwächen.
- Empfehlung: **bauen**, als erstes Pro-Werkzeug, sobald Pro technisch steht. Fachlogik kann vorher entstehen und getestet werden.

**20 Zuwendungsbestätigung nach amtlichem Muster**
- Zweck: Spendenquittungen für Vereine aus einer Spenderliste erzeugen.
- Suchbegriff: „zuwendungsbestätigung vorlage“, „spendenbescheinigung erstellen“.
- Module: neu `donations/receipt.ts`, PDF-Erzeugung mit pdf-lib, Betrag in Worten (`format/amount-words.ts`).
- Bibliotheken: pdf-lib. Die amtlichen Muster brauchen Umlaute und das Zeichen „§“ (in WinAnsi enthalten).
- Quelle:
  - § 10b EStG, § 50 EStDV, BMF-Schreiben mit verbindlichen Mustern. Laut EStH gelten die Muster aus dem BMF-Schreiben vom 07.11.2013 (BStBl I S. 1333), ergänzt am 26.03.2014 (BStBl I S. 791), bis einschließlich Veranlagungszeitraum 2024.
  - Ab 2025 ist eine Anpassung für das Zuwendungsempfängerregister (§ 60b AO) nötig. Welches Schreiben die aktuelle Fassung enthält, habe ich nicht abschließend geklärt.
  - Die Muster stehen als Formulare auf formulare-bfinv.de.
- Risiken:
  - **Haftung:** § 10b Abs. 4 EStG: Wer vorsätzlich oder grob fahrlässig eine unrichtige Bestätigung ausstellt, haftet für die entgangene Steuer. Das trifft den Verein, nicht Lokalwerk. Trotzdem wäre ein Fehler im Muster (veraltete Fassung, falscher Wortlaut) für uns ein Haftungs- und Rufrisiko.
  - Der Wortlaut darf nicht verändert werden; jede Musteränderung durch das BMF erzwingt ein Update.
  - Vereinsspezifische Angaben (Freistellungsbescheid, Datum, Zweck) muss der Verein richtig eintragen; Plausibilitätsprüfung, keine Beratung.
- Aufwand: L.
- Empfehlung: **später**, erst nach Rechtsprüfung und mit dem aktuellen BMF-Schreiben im Wortlaut in `.local-specs/`. Hoher Nutzen für Vereine, möglicher Pro-Kandidat.

### Tabellen und Listen

**21 CSV reparieren**
- Zweck: CSV-Dateien mit kaputten Umlauten, falschem Trennzeichen oder falschem Zahlenformat so umwandeln, dass Excel, Banken oder Vereinssoftware sie lesen.
- Suchbegriff: „csv umlaute falsch“, „csv utf-8 umwandeln“, „csv trennzeichen ändern“.
- Module:
  - Neu: `csv/write.ts` (Kodierung UTF-8 mit/ohne BOM oder Windows-1252, Trennzeichen, Anführungszeichen nach RFC 4180) und `csv/repair.ts` (Doppelt kodierte Umlaute wie „Ã¤“ erkennen und zurückführen, nur wenn eindeutig).
  - Wiederverwendet: `csv/decode`, `csv/delimiter`, `csv/parse`, `sepa/amount` (Zahlenformate lesen), Tabellenvorschau der SEPA-Seite.
- Bibliotheken: keine.
- Quelle: RFC 4180 (CSV), WHATWG Encoding Standard (Windows-1252).
- Risiken:
  - Reparatur doppelt kodierter Umlaute ist eine Heuristik. Nur anbieten, wenn das Muster eindeutig ist, und die Änderungen vorher zeigen. Nie stillschweigend.
  - Zeichen, die in Windows-1252 fehlen, werden gemeldet statt ersetzt.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 3.

**22 Excel ↔ CSV**
- Zweck: Excel- oder ODS-Tabellen als CSV speichern (mit deutschem Semikolon und UTF-8) und CSV als Excel-Datei.
- Suchbegriff: „excel in csv umwandeln“, „csv in excel umwandeln“.
- Module: neu `sheet/write.ts` (SheetJS schreiben, im Worker), Blattauswahl bei mehreren Blättern. Wiederverwendet: `sheet/xlsx` (Lesen, Signaturprüfung, Fehlerarten), `csv/*`, `csv/write` aus 21.
- Bibliotheken: SheetJS CE 0.20.3 aus `vendor/` (freigegeben). Schreiben ist im freigegebenen Paket enthalten; der neue Bundle-Teil braucht dieselbe Adressliste wie `sheet.worker` (Abschnitt 5.2).
- Quelle: ECMA-376 (Office Open XML) über SheetJS.
- Risiken:
  - Formeln werden als Werte gespeichert, Formatierungen gehen verloren. Das steht im Erklärtext.
  - Datumswerte und führende Nullen (PLZ, Mitgliedsnummer) beim CSV-zu-Excel-Weg: Spalten als Text übernehmen, statt zu raten.
  - Verschlüsselte Dateien werden wie bisher abgelehnt.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 1.

**23 Duplikate finden**
- Zweck: Doppelte Einträge in Mitglieder-, Kunden- oder Adresslisten finden, z. B. vor einem Rundschreiben oder einer Beitragsabbuchung.
- Suchbegriff: „excel duplikate finden“, „doppelte einträge finden“.
- Module: neu `table/duplicates.ts` (Vergleich über gewählte Spalten, Normalisierung: Groß/klein, Leerzeichen, ä/ae, ß/ss, IBAN ohne Leerzeichen). Wiederverwendet: `csv/*`, `sheet/*`, `sheet/write` aus 22.
- Bibliotheken: SheetJS.
- Quelle: keine.
- Risiken: Unscharfe Treffer („Meier“/„Maier“) sind Vermutungen. Erste Stufe nur exakte Treffer nach Normalisierung; unscharfe Treffer höchstens als markierte Vorschläge, nie automatisch löschen.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 3.

**24 Etiketten-PDF aus einer Liste**
- Zweck: Adressetiketten für Serienpost (Einladungen, Vereinspost) aus einer Liste als druckfertige PDF.
- Suchbegriff: „adressetiketten aus excel drucken“, „etiketten erstellen“.
- Module: neu `labels/layout.ts` (Bogenmaße: Seitenrand, Spalten, Zeilen, Etikettengröße, Abstand; reine Geometrie) und `pdf/labels.ts`. Wiederverwendet: `csv/*`, `sheet/*`, Spaltenzuordnung nach dem Muster von `sepa/columns`.
- Bibliotheken: pdf-lib. Bei Namen mit Zeichen außerhalb von WinAnsi (z. B. polnische oder türkische Buchstaben) brauchen wir eine eingebettete Schrift, also Frage 8.
- Quelle: Anschriftenfeld und Maße nach DIN 5008 nur, wenn wir sie auf die Etiketten anwenden. Vor dem Bau prüfen.
- Risiken:
  - **Keine Markennamen**: Voreinstellungen heißen nach Maßen („A4, 3 × 8, 70 × 37 mm“), nicht nach Herstellerartikelnummern. Ob Artikelnummern als Suchhilfe erlaubt sind, ist Frage 10.
  - Druckertreiber skalieren gern („An Seite anpassen“). Das Werkzeug erklärt „Tatsächliche Größe“ und bietet einen Probedruck mit Rahmen.
  - Abgrenzung Rechnungen: keine Serienbrief- oder Rechnungsfunktion, nur Adressen.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 7.

### Alltag und Sicherheit

**25 Passwort-Generator**
- Zweck: Sichere Passwörter erzeugen, die nie ein Server gesehen hat.
- Suchbegriff: „passwort generator“, „sicheres passwort erstellen“.
- Module: neu `random/password.ts`. Zufall aus `crypto.getRandomValues` mit Verwerfen statt Modulo (kein Verzerrungsfehler), Zeichengruppen, verwechselbare Zeichen ausschließen, Stärke als Bit-Entropie angezeigt.
- Bibliotheken: keine.
- Quelle: BSI-Empfehlungen zu Passwörtern (IT-Grundschutz-Baustein ORP.4 und die Verbraucherseite „Sichere Passwörter erstellen“). Konkrete Längenempfehlungen übernehme ich erst nach Lesen der aktuellen Fassung und zitiere sie mit Stand.
- Risiken:
  - Kein Speichern (Regel 5). Kopieren in die Zwischenablage nur per Knopf.
  - Passphrasen aus Wortlisten brauchen eine deutsche Wortliste mit freier Lizenz. Nicht in der ersten Stufe (Frage 11).
  - Tests prüfen Verteilung und Zeichengruppen, nicht „Zufälligkeit“ an sich.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 2. Sehr hohes Suchinteresse, passt zum Versprechen.

**26 Prüfsumme (SHA-256)**
- Zweck: Die Prüfsumme einer Datei berechnen und mit einer angegebenen vergleichen, z. B. bei Software-Downloads oder zur Beweissicherung.
- Suchbegriff: „sha256 prüfen“, „prüfsumme berechnen“.
- Module: neu `hash/sha256.ts` (schrittweise über Dateiblöcke), wahlweise `hash/sha1.ts` und `hash/md5.ts` (als veraltet gekennzeichnet). Vergleich unempfindlich gegen Groß/klein und Leerzeichen.
- Bibliotheken:
  - WebCrypto `crypto.subtle.digest` kann nur die ganze Datei auf einmal (SHA-1/256/384/512, kein MD5). Bei mehreren hundert MB sprengt das den Speicher.
  - Deshalb eigener schrittweiser SHA-256 im Worker (etwa 120 Zeilen). Alternative: hash-wasm 4.12.0 (MIT, letzte Veröffentlichung 11/2024, WASM, braucht `'wasm-unsafe-eval'` in der CSP). Nicht empfohlen.
  - Kleine Dateien (unter etwa 200 MB) können über WebCrypto laufen; das Ergebnis muss gleich sein und wird im Test gegengeprüft.
- Quelle: FIPS 180-4 (SHA-1, SHA-2), Prüfvektoren des NIST (CAVP „SHA Test Vectors“) als Fixtures; RFC 1321 (MD5).
- Risiken: Eigene Kryptografie-Implementierung. Für Prüfsummen vertretbar (kein Geheimnis im Spiel), aber nur mit den NIST-Vektoren und dem Gegencheck gegen WebCrypto.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 2.

**27 Textvergleich**
- Zweck: Zwei Fassungen eines Textes vergleichen (Vertragsentwurf, Satzung, Protokoll) und Unterschiede markiert sehen.
- Suchbegriff: „text vergleichen“, „zwei texte vergleichen online“.
- Module: neu `text/diff.ts` (Myers-Algorithmus, Zeilen und Wörter; etwa 120 Zeilen) und `text/tokenize.ts`.
- Bibliotheken: keine. Alternative wäre `diff` 9.0.0 (BSD-3-Clause), nicht nötig.
- Quelle: E. W. Myers, „An O(ND) Difference Algorithm and Its Variations“ (1986), für den Algorithmus.
- Risiken:
  - Sehr lange Texte mit vielen Unterschieden brauchen viel Rechenzeit. Deshalb im Worker, mit Grenze und Hinweis.
  - Word- oder PDF-Dateien vergleichen ist eine spätere Stufe (Text aus PDF über pdf.js, aus DOCX über das ZIP). Erste Stufe: Text einfügen oder .txt-Dateien.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 2.

**28 QR-Code (Link, WLAN, Kontakt)**
- Zweck: QR-Codes für Aushänge und Visitenkarten erzeugen, ohne Weiterleitungs-Dienst und ohne Tracking.
- Suchbegriff: „qr code erstellen kostenlos“, „wlan qr code“.
- Module: neu `qr/payloads.ts` (Inhalte bauen: URL, WLAN, vCard, Text; reine Funktionen) und `qr/render.ts` (Matrix zu SVG und PNG). Die QR-Kodierung selbst kommt aus einer Bibliothek.
- Bibliotheken (eine davon, Frage 5):
  - **uqr 0.1.3**: MIT, Stand 03.04.2026, 27,5 KB (7,8 KB gzip), keine Laufzeit-Abhängigkeiten. Beruht auf dem QR-Generator von Project Nayuki (MIT, beide im Lizenztext genannt). Kein Netzwerkcode. Enthält den SVG-Namensraum `http://www.w3.org/2000/svg` im JS, das wäre ein neuer Eintrag in ALLOWED_JS_URLS nur für diesen Bundle-Teil.
  - qrcode-generator 2.0.4: MIT, Stand 07.08.2025, 51,9 KB (11,1 KB gzip). Kein Netzwerkcode. Enthält mehrere Adressen im Code (Autor, Denso Wave, Lizenz).
  - Empfehlung: uqr, weil kleiner und mit weniger Adressen. Wir würden nur die Matrix nutzen und das SVG selbst bauen.
  - Selbst schreiben: QR-Kodierung mit Reed-Solomon, Masken und Versionen sind eher 600 als 150 Zeilen. Die Norm ISO/IEC 18004 ist kostenpflichtig, also könnten wir nicht gegen die Norm testen.
- Quelle:
  - ISO/IEC 18004 (QR-Code, kostenpflichtig, nur mittelbar über die Bibliothek)
  - RFC 6350 (vCard 4.0; für ältere Telefone ggf. vCard 3.0 nach RFC 2426)
  - RFC 3986 (URI)
  - **WLAN-Format:** Das Format `WIFI:T:WPA;S:…;P:…;;` ist keine Norm, sondern eine verbreitete Konvention aus dem ZXing-Projekt. Das sage ich im Erklärtext nicht als Norm. Die Wi-Fi Alliance beschreibt ein ähnliches Format in der WPA3-Spezifikation; ob wir uns darauf stützen können, prüfe ich vor dem Bau.
- Risiken:
  - **WLAN-Passwort:** Das Passwort steht im Klartext im Code. Das ist offensichtlich, gehört aber in den Hinweis. Nichts wird gespeichert.
  - Scannbarkeit: Mindestgröße und Ruhezone (4 Module) im Export fest einhalten.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 5, zusammen mit 17.

**29 Fristen- und Arbeitstage-Rechner**
- Zweck: Fristenende nach BGB berechnen (z. B. „2 Wochen ab Zugang“) und Arbeitstage zwischen zwei Daten zählen, mit Feiertagen je Bundesland.
- Suchbegriff: „fristenrechner“, „arbeitstage berechnen“, „feiertage bundesland“.
- Module:
  - Neu:
    - `dates/holidays.ts`: Ostersonntag rechnerisch (gregorianisch), bewegliche und feste Feiertage je Land aus den Feiertagsgesetzen der Länder, mit Gültigkeitsjahren (z. B. Frauentag in Berlin erst ab 2019, in Mecklenburg-Vorpommern ab 2023, Weltkindertag in Thüringen ab 2019; genaue Jahre aus den Gesetzen, nicht aus dem Gedächtnis)
    - `dates/deadline.ts`: §§ 187–193 BGB
    - `dates/workdays.ts`
  - Wiederverwendet: `sepa/dates` (Datumshilfen).
- Bibliotheken: keine.
- Quelle: §§ 186–193 BGB (gesetze-im-internet.de); Feiertagsgesetze der 16 Länder in der jeweils gültigen Fassung.
- Risiken:
  - **Haftung:** Kanzleien würden sich auf das Ergebnis verlassen. Fristversäumnisse können teuer sein. Der Rechner zeigt jeden Rechenschritt („Fristbeginn nach § 187 Abs. 1 BGB …“) und den Hinweis, dass Prozess-, Verwaltungs- und Steuerfristen eigene Regeln haben (ZPO, VwVfG, AO) und nicht abgedeckt sind.
  - **Regionale Feiertage:**
    - Nicht landesweit: Mariä Himmelfahrt in Teilen Bayerns, Fronleichnam in Teilen Sachsens und Thüringens, Augsburger Friedensfest nur in Augsburg.
    - Diese auf Gemeindeebene korrekt abzubilden ist aufwendig. Vorschlag: nur landesweite Feiertage automatisch, die regionalen als abwählbare Zusätze mit Erklärung.
  - Nur Deutschland. Österreich und Schweiz haben andere Regeln.
  - Wortlaut der Hinweise rechtlich prüfen lassen (AGENTS.md Abschnitt 9).
- Aufwand: L.
- Kostenlos.
- Empfehlung: **bauen**, in Paket 7, nach Rechtsprüfung der Texte. Arbeitstage-Rechner allein wäre M und risikoärmer; er könnte vorgezogen werden (Frage 12).

**30 Kontrast-Prüfer (WCAG 2.2)**
- Zweck: Zwei Farben auf Kontrast nach WCAG 2.2 prüfen, z. B. für Verwaltungen und Firmen, die das Barrierefreiheitsstärkungsgesetz betrifft.
- Suchbegriff: „kontrast prüfen“, „kontrastrechner wcag“.
- Module: neu `color/contrast.ts` (relative Leuchtdichte, Kontrastverhältnis, Bewertung nach 1.4.3, 1.4.6, 1.4.11) und `color/parse.ts` (Hex, rgb(), hsl()). Das Rechenverfahren liegt dem Projekt schon als Skript für die eigenen Farbentscheidungen vor; hier wird es sauber in `core/` umgesetzt und getestet.
- Bibliotheken: keine.
- Quelle: WCAG 2.2 (W3C Recommendation), Definitionen „contrast ratio“ und „relative luminance“, Erfolgskriterien 1.4.3, 1.4.6, 1.4.11.
- Risiken:
  - Transparente Farben brauchen eine Hintergrundfarbe; das Werkzeug fragt danach.
  - APCA (Entwurf für WCAG 3) nicht einbauen, weil nicht normativ.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 2. Wenig Suchvolumen, aber passend zur Zielgruppe Verwaltung und schnell gebaut.

### Eigene Vorschläge

**A Ausweiskopie datensparsam**
- Warum: Vermieter, Vereine, Arbeitgeber und Firmen verlangen oft Ausweiskopien. Die Kopie sollte als Kopie gekennzeichnet sein und nicht benötigte Daten geschwärzt (z. B. Zugangsnummer, Foto). Das ist genau die Datei, die man nie auf eine fremde Seite hochladen will.
- Zweck: Foto oder Scan eines Ausweises laden, Bereiche schwärzen und den Aufdruck „Kopie – nur für [Zweck] – [Datum]“ quer über das Bild setzen, Ergebnis als JPG oder PDF.
- Suchbegriff: „ausweiskopie schwärzen“, „personalausweis kopie wasserzeichen“.
- Module: `ui/rect-editor` (5), `images/obscure` (14), Aufdruck als Bildebene (Canvas), `pdf/from-images` (3), Metadaten entfernen wie bei Fotos verkleinern.
- Bibliotheken: keine neuen.
- Quelle: § 20 Abs. 2 PAuswG (Ablichtung nur durch den Inhaber oder mit dessen Zustimmung, als Kopie erkennbar). Wortlaut vor dem Bau prüfen; ob und welche Daten geschwärzt werden dürfen, ergibt sich aus dem Gesetz und der Gesetzesbegründung, nicht aus meiner Annahme. Für den Reisepass gibt es eine entsprechende Regel im PassG; auch dort vorher nachlesen.
- Risiken: keine Aussage, welche Felder man schwärzen „muss“. Das Werkzeug bietet Schwärzen an, schreibt aber nichts vor. Rechtstexte nur nach Freigabe.
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 6.

**B PDF-Formular ausfüllen**
- Warum: Behörden und Vereine verschicken ausfüllbare PDFs. Viele Nutzer haben keinen passenden Reader, oder der Browser speichert die Eingaben nicht zuverlässig.
- Zweck: Formularfelder einer PDF anzeigen und ausfüllen, optional „festschreiben“ (Felder in normalen Inhalt umwandeln).
- Suchbegriff: „pdf formular ausfüllen“, „pdf ausfüllen und speichern“.
- Module: neu `pdf/form.ts` (Felder auslesen, Werte setzen, Flatten). Vorschau aus 2.
- Bibliotheken: pdf-lib (AcroForm), pdfjs-dist (Vorschau).
- Quelle: ISO 32000-2, Abschnitt 12.7 (Interaktive Formulare).
- Risiken:
  - XFA-Formulare (manche Behördenformulare) unterstützt pdf-lib nicht. Erkennen und ehrlich ablehnen.
  - Schriftfrage 8 für Eingaben mit Zeichen außerhalb von WinAnsi.
  - Signaturfelder werden nicht signiert (Verweis auf 10).
- Aufwand: M.
- Kostenlos.
- Empfehlung: **bauen** in Paket 4.

**C Dokument mit dem Handy scannen**
- Warum: Viele kleine Firmen und Vereine scannen mit dem Handy. Scanner-Apps laden oft in die Cloud.
- Zweck: Mit der Kamera fotografieren, die vier Ecken setzen, das Bild entzerren und als PDF speichern.
- Suchbegriff: „dokument scannen handy pdf“.
- Module:
  - Neu:
    - `images/perspective.ts`: Homographie aus vier Punkten, Entzerrung; etwa 120 Zeilen, rein rechnerisch testbar
    - `images/enhance.ts`: Graustufen, Kontrast
  - Wiederverwendet: `pdf/from-images` (3), `ui/rect-editor` in Eckpunkt-Variante.
- Bibliotheken: keine.
- Quelle: keine Norm nötig.
- Risiken:
  - **Kamera ohne Richtlinienänderung:** `<input type="file" accept="image/*" capture="environment">` öffnet auf Handys die Kamera-App des Systems, ohne `getUserMedia`. Die Permissions-Policy `camera=()` kann bleiben, und die Datenschutzerklärung braucht keinen Kamera-Abschnitt. Eine Live-Vorschau mit automatischer Kantenerkennung bräuchte `getUserMedia` und damit eine Änderung der Permissions-Policy. Das ist nicht vorgesehen.
  - Automatische Eckenerkennung ist ein späterer Schritt.
- Aufwand: L.
- Kostenlos.
- Empfehlung: **bauen** in Paket 6.

**D SEPA-Text prüfen**
- Warum: Vereine und Firmen tippen Verwendungszwecke und Namen, die Banken später verändern oder ablehnen (Sonderzeichen, zu lang).
- Zweck: Text einfügen, sehen, welche Zeichen im SEPA-Zeichensatz erlaubt sind, wie sie umgewandelt würden und ob die Länge passt.
- Module: `sepa/charset` (vorhanden), Längen aus `sepa/charset`. Fast nur Oberfläche.
- Bibliotheken: keine. Quelle: DFÜ Anlage 3 (wie bei pain.001).
- Risiken: gering. Wenig eigenes Suchvolumen.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **nicht als eigene Seite**, sondern als zweiter Reiter in 16 („Bankdaten und SEPA-Texte prüfen“).

**E Gläubiger-ID prüfen**
- Warum: Vereine vertippen sich bei der Gläubiger-Identifikationsnummer. Banken lehnen dann die Lastschriftdatei ab. Wird ohnehin für 19 gebraucht.
- Zweck: Eine Gläubiger-ID auf Aufbau und Prüfziffer prüfen.
- Suchbegriff: „gläubiger id prüfen“.
- Module: neu `sepa/creditor-id.ts`. Wiederverwendet: Modulo-97-Rechnung aus `sepa/iban`.
- Bibliotheken: keine.
- Quelle: Deutsche Bundesbank, Aufbau der Gläubiger-Identifikationsnummer; EPC-Dokument zum Creditor Identifier (EPC262-08). Beide vor dem Bau lesen, insbesondere wie die Geschäftsbereichskennung bei der Prüfziffer übergangen wird.
- Risiken: gering. Die Prüfung sagt nur „formal gültig“, nicht „vergeben“.
- Aufwand: S.
- Kostenlos.
- Empfehlung: **bauen** in Paket 5, als eigene kleine Seite mit Verweis aus 16 und 19.

## 3. Startseite, Navigation und Suche

Mit etwa 30 Werkzeugen passen nicht mehr alle auf die Startseite. Vorschlag:

1. **Kategorien** (Registereintrag je Werkzeug, Abschnitt 3.5):

   | Kategorie | Klasse | Farbe |
   |---|---|---|
   | PDF | `.pdf` | rot (vorhanden) |
   | Fotos und Bilder | `.img` | türkis (vorhanden) |
   | Zahlungsverkehr und Verein | `.sepa` | blau (vorhanden) |
   | Tabellen und Listen | `.tab` | neu, Vorschlag Ocker (Abschnitt 4) |
   | Alltag und Sicherheit | `.util` | neu, Vorschlag Violett (Abschnitt 4) |

2. **Übersichtsseite `/werkzeuge/`**
   - Alle Werkzeuge nach Kategorie, je mit Icon, Name und einem Satz.
   - Beim Build aus dem Register erzeugt, also reines HTML: Suchmaschinen sehen alle Links, und die Seite funktioniert ohne JavaScript.
   - Der Navigationspunkt „Werkzeuge“ im Kopf zeigt künftig hierher.
   - Kategorieseiten (`/pdf/` usw.) wären für Suchmaschinen zusätzlich nützlich, sind aber nicht nötig. Vorschlag: vorerst Sprungmarken auf `/werkzeuge/` (Frage 13).

3. **Lokale Suche und Filter** auf `/werkzeuge/` und auf der Startseite
   - Ein Eingabefeld filtert die bereits vorhandenen Listeneinträge im DOM. Suchbegriffe stehen beim Build in einem `data-`-Attribut je Eintrag (Name, Synonyme wie „zusammenfügen, verbinden, mergen“).
   - Kein Suchindex als Datei, kein `fetch`, kein Speicher.
   - Normalisierung: Groß/klein, ä/ae, ö/oe, ü/ue, ß/ss, Bindestriche.
   - Barrierefreiheit: Die Trefferzahl wird über eine Live-Region angesagt („7 Werkzeuge gefunden“). Die Liste bleibt eine normale Liste mit Links, kein Kombinationsfeld.
   - Kategorie-Filter als Chips (Umschaltknöpfe mit `aria-pressed`).
   - Der Code ist klein (unter 100 Zeilen) und wird nur auf diesen beiden Seiten geladen.

4. **Startseite**
   - Die Ablagefläche bleibt. Weil jetzt mehrere Werkzeuge zu einem Dateityp passen, zeigt sie nach dem Ablegen eine Auswahl („PDF erkannt: Zusammenfügen, Teilen, Schwärzen, …“) statt direkt ein Werkzeug zu öffnen. Die Datei bleibt dabei wie bisher im Speicher (weiche Navigation).
   - `files/classify` bekommt dafür eine Zuordnung Dateityp → Werkzeuge aus dem Register.
   - Darunter: die meistgenutzten Werkzeuge je Kategorie (fest im Register, nicht gezählt) und ein Link auf `/werkzeuge/`.
   - Die Regel „keine PDF- oder Tabellenbibliothek auf der Startseite“ bleibt: Werkzeugcode wird erst nach der Auswahl geladen.
   - Titel und Beschreibung der Startseite („PDF, Fotos und SEPA“) müssen dann erweitert werden. Neue Texte lege ich zur Freigabe vor.

5. **Register erweitern** (`build/pages.ts`). Jedes Werkzeug bekommt:
   - `category`
   - `short` (ein Satz)
   - `keywords` (Suchsynonyme)
   - `related` (2–4 Werkzeug-IDs)
   - `accepts` (Dateitypen für die Startseite)
   - `pro` (ja/nein)
   - `icon` (Symbol-ID in `icons.svg`)

   Aus diesen Angaben werden beim Build erzeugt: Übersicht, Startseitenliste, Sitemap und Verwandte-Werkzeuge-Block.

   Eine Build-Prüfung bricht ab, wenn:
   - ein `related`-Eintrag nicht existiert,
   - ein Werkzeug keine verwandten Werkzeuge hat,
   - ein Icon fehlt oder
   - Titel oder Beschreibung doppelt vorkommen.

6. **Verwandte Werkzeuge**
   - Unter dem Erklärtext jeder Werkzeugseite ein Abschnitt „Passt dazu“ mit 2–4 Links, beim Build eingesetzt (`<!-- @block related -->`).
   - Beispiele:
     - Zusammenfügen ↔ Teilen ↔ Seiten sortieren
     - Fotos verkleinern ↔ Metadaten anzeigen ↔ Bilder zu PDF
     - Sammelüberweisung ↔ IBAN-Liste prüfen ↔ Gläubiger-ID
   - Zusätzlich darf eine Ergebnismeldung auf ein passendes Werkzeug verweisen („PDF erstellt. Metadaten prüfen?“), aber nur als Link, ohne Werbesprache.

7. **Kopfnavigation:** bleibt bei „Werkzeuge“ und „Pro“. Kein Mega-Menü. Auf dem Handy reicht das vorhandene Layout.

## 4. Neue Akzentfarben (Vorschlag, nichts ohne Freigabe)

Gerechnet nach WCAG 2.2 (relative Leuchtdichte, sRGB). Anforderungen:
- Icon und Rahmen (`--c`): mindestens 3:1 auf `--cs` und auf `--surface` (1.4.11).
- Text (`--ci`): mindestens 4,5:1 auf `--surface`, `--bg` und `--cs` (1.4.3).

Zum Vergleich die vorhandenen Farben:

| Kategorie | --c/--cs | --c/--surface | --ci/--surface | --ci/--bg | --ci/--cs | dunkel --c/--cs | dunkel --c/--surface |
|---|---|---|---|---|---|---|---|
| PDF (vorhanden) | 3,34 | 3,91 | 5,45 | 5,05 | 4,64 | 5,62 | 6,23 |
| Fotos (vorhanden) | **2,90** | 3,30 | 5,31 | 4,91 | 4,65 | 7,66 | 9,33 |
| Zahlungsverkehr (vorhanden) | 4,99 | 5,91 | 5,91 | 5,47 | 4,99 | 4,96 | 6,03 |

Hinweis nebenbei: Türkis `--img` auf `--img-soft` liegt mit 2,90:1 knapp unter 3:1. Die Icons in diesen Chips sind rein schmückend (Name steht daneben), daher kein Verstoß. Ich ändere nichts daran (keine Nebenbei-Änderungen), erwähne es nur.

Vorschlag:

| Token | Hell | Dunkel |
|---|---|---|
| `--tab` (Tabellen, Ocker) | #B8760A | #F2B347 |
| `--tab-soft` | #FBF0DC | #35280F |
| `--tab-ink` | #8F5C08 | = `--tab` |
| `--util` (Alltag, Violett) | #7D45D0 | #B995FF |
| `--util-soft` | #F0E8FC | #2A1F45 |
| `--util-ink` | = `--util` (#7D45D0) | = `--util` |

| Kategorie | --c/--cs | --c/--surface | --c/--bg | --ci/--surface | --ci/--bg | --ci/--cs | dunkel --c/--cs | dunkel --c/--surface | dunkel --c/--bg |
|---|---|---|---|---|---|---|---|---|---|
| Tabellen (Ocker) | 3,30 | 3,73 | 3,45 | 5,67 | 5,25 | 5,02 | 7,74 | 9,30 | 10,27 |
| Alltag (Violett) | 4,86 | 5,78 | 5,35 | 5,78 | 5,35 | 4,86 | 6,38 | 7,24 | 8,00 |

Begründung der Wahl:
- Grün scheidet aus, weil `--ok` Erfolg bedeutet (und „0 B hochgeladen“ grün ist).
- Ein kräftiges Orange liegt zu nah an `--err`. Ocker ist vom Farbton her klar getrennt, aber gelblich; es darf nie für Warnungen verwendet werden, damit keine Verwechslung entsteht.
- Violett ist von Blau (Zahlungsverkehr) im Farbton ausreichend getrennt. Neben `--primary` wirkt es aber verwandt; im Browser in beiden Modi gegen die bestehenden Karten ansehen, bevor Leon freigibt.
- Kategorien werden nie nur über Farbe unterschieden: Name und Icon stehen immer dabei (WCAG 1.4.1).

## 5. Auswirkungen auf CSP, check-dist, Lizenzseite, Datenschutz

### 5.1 Content-Security-Policy (`public/_headers`)

- **Pakete 1–3: keine Änderung.** pdf-lib, SheetJS, Canvas, WebCrypto und eigene Worker laufen mit der heutigen Richtlinie.
- **pdf.js (Paket 4)** braucht Einstellungen, damit es mit `connect-src 'none'` und ohne `eval` läuft:
  - `isEvalSupported: false`, `enableScripting: false` (keine PDF-JavaScript-Sandbox, `quickjs-eval.wasm` wird nicht ausgeliefert)
  - kein `cMapUrl`, `standardFontDataUrl`, `wasmUrl`, sondern eigene Fabrik-Klassen oder gar keine Nachladedaten
  - Worker lokal (`worker-src 'self'` reicht)
- **Offen: WebAssembly.**
  - pdf.js bringt WASM-Dekoder mit: JPX/JPEG 2000 (openjpeg 252 KB), JBIG2 (105 KB) und Farbmanagement (qcms 97 KB). WASM zu starten verlangt `'wasm-unsafe-eval'` in `script-src`.
  - Ohne WASM fallen einige Bildarten in PDFs aus oder laufen über einen langsameren JS-Ersatz. Welche genau, teste ich mit Beispieldateien vor der Entscheidung (Frage 4).
  - `'wasm-unsafe-eval'` erlaubt nur das Kompilieren von WASM, kein JavaScript-`eval`, und würde nur auf den Seiten mit pdf.js gesetzt. Dafür bekommen diese Seiten in `_headers` eigene Pfadregeln.
- **Offen: Nachladedaten und Offline-Betrieb.**
  - CMaps (1,6 MB) und Standardschriften (816 KB) lädt pdf.js normalerweise nach. Nachladen verträgt sich nicht mit „offline nach dem ersten Laden“ und nicht mit `connect-src 'none'`.
  - Vorschlag: Standardschriften nicht mitliefern (pdf.js nimmt dann Systemschriften; nur bei PDFs ohne eingebettete Schriften sichtbar). CMaps auch nicht: Die betreffen fast nur ostasiatische Schriften ohne Einbettung.
  - Das ist eine dokumentierte Grenze, keine CSP-Lockerung.
- **pdf.js und Stile:** pdf.js kann `@font-face`-Regeln per `<style>` einfügen, was `style-src 'self'` blockiert. Im Browser prüfen; wenn nötig, über die FontFace-API lösen, **nicht** mit `'unsafe-inline'`.
- **Kamera:** keine Änderung (Vorschlag C nutzt die Dateiauswahl mit `capture`).
- **Zwischenablage** (Passwort, Prüfsumme): `navigator.clipboard.writeText` braucht keine Richtlinienänderung und sendet nichts.

### 5.2 check-dist

- Neue Bundle-Teile mit bereits freigegebenen Adresslisten:
  - Die SheetJS-Liste gilt heute nur für `assets/sheet.worker-*.js`. Werkzeuge, die SheetJS in eigenen Workern nutzen (18, 22, 23, 24), brauchen dieselbe Liste für ihre Worker-Dateien.
  - Vorschlag: einen gemeinsamen SheetJS-Worker-Baustein, damit es bei einem Dateinamen bleibt. Sonst je Datei ein Muster; Frage 14.
  - Dasselbe gilt für die pdf-lib-Adresse (`merge.worker-*.js`), wenn pdf-lib in weiteren Workern landet (1, 3, 5, 6, 7, 8, 10, B).
- Neue Einträge, jeder nur nach Rückfrage (plan.md N3):
  - **pdf.js:** Im Worker-Bundle stehen XFA-, XFDF- und XMP-Namensräume (`http://ns.adobe.com/xdp/`, `…/xfdf/`, `…/xmpmeta/`), in beiden Bundles Beispieladressen aus Kommentaren oder Fehlermeldungen (`http://example.com`) und die Apache-Lizenzadresse. Die genaue Liste erstelle ich beim Einbinden aus dem tatsächlichen Build, wie bei SheetJS, mit Gruppen und Fundstellen zur Freigabe.
  - **uqr:** `http://www.w3.org/2000/svg` im JS, nur für den QR-Bundle-Teil.
  - **exifr:** XMP-Namensräume `http://ns.adobe.com/`, `…/xap/1.0/`, `…/xmp/extension/` und eine GitHub-Adresse.
- Neue Prüfungen:
  - Build bricht ab, wenn Seiten mit pdf.js `quickjs-eval.wasm` oder den PDF-Sandbox-Code ausliefern.
  - Register-Prüfungen aus Abschnitt 3.5.

### 5.3 Lizenzseite `/lizenzen/`

- Wird weiter aus den installierten Paketen erzeugt; neue Pakete erscheinen automatisch, `verifyLicensesListed` erzwingt es. Neu in `USED_IN`: je Paket die Werkzeuge, die es nutzen.
- **pdfjs-dist:** Apache-2.0-Text liegt bei. Für die WASM-Dekoder gelten eigene Lizenzen:
  - openjpeg: BSD-2-Clause
  - JBIG2 aus PDFium: BSD-artig
  - qcms: MIT
  - Werden sie ausgeliefert, kommen sie als `REQUIRED_DATA_LICENSES` mit wörtlichem Text dazu (wie APAFML), sonst nicht. Standardschriften und CMaps haben eigene Lizenzen (u. a. SIL OFL, Adobe BSD-3-Clause) und entfallen, wenn wir sie wie vorgeschlagen nicht ausliefern.
- **uqr:** MIT mit zwei Urhebervermerken (Project Nayuki, Anthony Fu). Die Erkennung der Copyright-Zeilen funktioniert dafür.
- **exifr:** MIT.
- **Bundesbank-Daten (16):** Keine Softwarelizenz, aber Quellenangabe und Stand auf der Lizenzseite („Bankleitzahlendatei der Deutschen Bundesbank, gültig vom … bis …“). Wortlaut hängt von Frage 9 ab.
- **pako** als direkte Abhängigkeit (18): steht schon auf der Seite.

### 5.4 Datenschutzerklärung und AGB

- **Datenschutzerklärung:** Solange Regel 1 gilt, verarbeitet kein Werkzeug Daten außerhalb des Browsers. Nach meiner Einschätzung braucht die Datenschutzerklärung für die Pakete 1–7 **keine** inhaltliche Änderung, aber Leon oder die Rechtsprüfung sollten bestätigen, dass die vorhandene Formulierung zur lokalen Verarbeitung neue Arten von Inhalten mit abdeckt: Kontoauszüge, Ausweiskopien, Kamerafotos über die Dateiauswahl, Passwörter.
- **Änderung nötig**, sobald eines davon kommt:
  - Pro mit Lizenzprüfung oder Zahlungsablauf (19)
  - `getUserMedia` (Kamera-Live-Vorschau)
  - gespeicherte Vorlagen oder Unterschriften (Regel 5)
- **AGB** (`docs/agb-entwurf.md`): Haftungshinweise für Werkzeuge mit rechtlicher Wirkung oder Vertrauensfolgen prüfen lassen:
  - Schwärzen (5)
  - Unterschrift (10, keine elektronische Signatur)
  - Ausweiskopie (A)
  - Lastschrift (19)
  - Zuwendungsbestätigung (20)
  - Fristen (29)
  Die Hinweise in den Werkzeugen formuliere ich als Entwurf zur Freigabe; Rechtstexte selbst schreibe ich nicht.

## 6. Pakete

Jedes Werkzeug ist ein eigener Schritt mit eigenem Commit, Tests, Audit (hell/dunkel, 360/1280 px, Netzwerk-Tab, Tastatur) und Bericht. Nach jedem Paket halte ich an.

**Paket 1 – Navigation und bestehender Code** (keine neue Abhängigkeit, keine CSP-Änderung)
- 0. Register erweitern, `/werkzeuge/` mit lokaler Suche, Verwandte-Werkzeuge-Block, Startseiten-Auswahl nach Dateityp. Neue Farben nur, wenn freigegeben; sonst starten Tabellen und Alltag erst in Paket 2 und 3.
- 1. PDF teilen / Seiten extrahieren
- 3. Bilder zu PDF
- 8. PDF-Metadaten anzeigen und entfernen
- 12. Bildformate umwandeln
- 22. Excel ↔ CSV

**Paket 2 – Alltag, eigener Code** (keine Abhängigkeit, neue Kategorie „Alltag“)
- 25 Passwort-Generator
- 26 Prüfsumme
- 27 Textvergleich
- 30 Kontrast-Prüfer

**Paket 3 – PDF ohne Vorschau und Tabellen** (pdf-lib, SheetJS)
- 6 Seitenzahlen
- 7 Stempel/Wasserzeichen
- 21 CSV reparieren
- 23 Duplikate finden

**Paket 4 – pdf.js** (Einbindung von pdfjs-dist mit CSP-Entscheidung aus Frage 4 als erster Schritt)
- 2 Seiten drehen, sortieren, löschen
- 4 PDF zu Bildern
- 5 Schwärzen
- 10 Unterschrift
- B Formular ausfüllen

**Paket 5 – Zahlungsverkehr und QR** (neue Abhängigkeit uqr)
- 28 QR-Code
- 17 GiroCode (nur nach Frage 1 und 2)
- 16 IBAN-Liste mit Bankdaten und Reiter D (nach Frage 9)
- E Gläubiger-ID prüfen

**Paket 6 – Fotos** (exifr)
- 15 Foto-Metadaten
- 13 Zuschneiden/drehen
- 14 Verpixeln
- A Ausweiskopie
- C Dokument scannen

**Paket 7 – fachlich schwer** (Quellen in `.local-specs/`, Rechtsprüfung)
- 18 camt.053
- 24 Etiketten
- 29 Fristen- und Arbeitstage-Rechner
- 19 Lastschrift (Pro, Fachlogik und Tests; Oberfläche erst mit Pro)

**Später:**
- 9 PDF verkleinern (nach Paket 4)
- 20 Zuwendungsbestätigung (nach Rechtsprüfung)
- Automatik für 14 (Pro)
- Texterkennung (Pro, tesseract.js)

**Gestrichen (vorerst):** 11 HEIC.

## 7. Offene Fragen

1. **GiroCode und Rechnungsausschluss:** EPC069-12 nennt die Rechnung als typischen Einsatz. Darf ich 17 ohne jeden Rechnungsbezug bauen (Spenden, Beiträge, Aushänge), oder fällt es unter „alles rund um Rechnungen“ und wird gestrichen?
2. **Marke „GiroCode“:** Prüfst du den Eintrag im DPMA-Register, oder nenne ich das Werkzeug neutral „QR-Code für Überweisungen (EPC-QR-Code)“ und erwähne „GiroCode“ höchstens im Erklärtext?
3. **ZIP:** Werkzeuge mit mehreren Ergebnisdateien (1, 4, 12, 13) brauchen ZIP oder Einzel-Downloads. /pro/ kündigt „ZIP-Export“ für Fotos an.
   - a) Einzel-Downloads kostenlos, ZIP überall Pro
   - b) ZIP bei PDF-Werkzeugen kostenlos, bei Fotos Pro
   - c) ZIP überall kostenlos und die Pro-Ankündigung ändern
   Ein ZIP ohne Kompression schreibe ich selbst (etwa 100 Zeilen, CRC-32 nach der ZIP-Spezifikation von PKWARE), keine Abhängigkeit.
4. **pdf.js und WebAssembly:** Darf ich auf den Seiten mit pdf.js `'wasm-unsafe-eval'` in `script-src` setzen, oder sollen diese Seiten ohne WASM laufen (mit dokumentierten Ausfällen bei JPEG 2000 und JBIG2)? Ich lege dir vorher Testergebnisse mit beiden Varianten vor.
5. **QR-Bibliothek:** uqr 0.1.3 (MIT) als neue Abhängigkeit für 17 und 28 freigeben? Alternative qrcode-generator 2.0.4.
6. **XML-Parser für camt.053:** `DOMParser` gibt es nicht in Web Workern und nicht in Node (Tests).
   - a) Eigener kleiner XML-Leser in `core/xml/` (etwa 200 Zeilen: Elemente, Attribute, Namensräume, Entitäten, CDATA; lehnt DOCTYPE ab)
   - b) @xmldom/xmldom 0.9.12 (MIT) als Abhängigkeit
   - c) Parsen im Hauptthread mit `DOMParser` und in Tests eine Entwicklungsabhängigkeit
   Ich empfehle a). Dazu: pako als direkte Abhängigkeit (heute nur über pdf-lib) für ZIP-Kontoauszüge freigeben?
7. **exifr:** In AGENTS.md freigegeben, aber seit Mai 2022 ohne Veröffentlichung. Trotzdem einsetzen, oder eigenen EXIF-Leser nur für JPG schreiben?
8. **Schriften in erzeugten PDFs** (6, 7, 10, 24, B): Die Standardschrift Helvetica deckt nur WinAnsi ab (keine polnischen, tschechischen oder türkischen Sonderzeichen). Die Varianten:
   - a) Zeichen außerhalb von WinAnsi mit klarer Meldung ablehnen
   - b) Onest einbetten; dafür braucht pdf-lib @pdf-lib/fontkit 1.1.1 (MIT, Stand 2022) als neue Abhängigkeit, Onest steht unter der OFL
   Ich empfehle a) für Paket 3 und b) als eigene Entscheidung später.
9. **Bundesbank-Bankleitzahlendatei:** Die Download-Seite verweist für die Nutzung auf das Impressum, dort steht keine Regelung. Fragst du bei der Bundesbank nach der Weiterverwendung in einer Website? Bis dahin baue ich 16 höchstens ohne Bankdaten.
10. **Etiketten:** Dürfen Herstellerartikelnummern als Suchhilfe genannt werden (z. B. „passt für Bögen mit 3 × 8 Etiketten 70 × 37 mm“ ohne Marke), oder nur Maße?
11. **Passphrasen:** Soll der Passwort-Generator später Wortpassphrasen bekommen? Dafür bräuchte es eine deutsche Wortliste mit freier Lizenz; ich würde Kandidaten mit Lizenz vorlegen.
12. **Fristenrechner:** Einverstanden, dass zuerst nur der Arbeitstage-Rechner mit landesweiten Feiertagen kommt (M) und die BGB-Fristberechnung erst nach Rechtsprüfung der Hinweistexte?
13. **Kategorieseiten:** Nur `/werkzeuge/` mit Sprungmarken, oder zusätzlich eigene Seiten `/pdf-werkzeuge/` usw. für Suchmaschinen?
14. **check-dist-Muster:** Einverstanden, dass die freigegebenen SheetJS- und pdf-lib-Adresslisten künftig für alle Worker-Dateien gelten, die diese Bibliothek nachweislich enthalten (erkannt über das Paket-Protokoll aus `shipped-packages.ts`), statt für feste Dateinamen? Das hält die Regel „nur im Bundle-Teil der Bibliothek“ ein, ohne für jedes Werkzeug eine neue Freigabe zu brauchen.
15. **Neue Farben:** Ocker (#B8760A) für Tabellen und Violett (#7D45D0) für Alltag freigeben, oder andere Richtung?
16. **Startseiten-Titel:** Der freigegebene Titel nennt „PDF, Fotos und SEPA“. Soll er mit Paket 1 erweitert werden (neue Texte zur Freigabe), oder bleibt er, bis mehr Kategorien live sind?
17. **Lastschrift (19) vor Pro:** Soll ich die Fachlogik (pain.008, Tests gegen DK-Schema) schon in Paket 7 bauen, obwohl die Oberfläche erst mit Pro erscheint? Dafür bräuchte ich das pain.008-Schema und die Anlage 3 in `.local-specs/`.

## 8. Was ich für Phase 2 von dir brauche (neben Abschnitt 7)

- Für Paket 7: DFÜ-Anlage 3 mit den Abschnitten zu camt.053 und pain.008 samt DK-Schemas und Beispieldateien in `.local-specs/dk/`.
- Für Paket 5: die Bankleitzahlendatei (nach Klärung von Frage 9), und die IBAN Registry in `.local-specs/swift/`; der Ordner ist noch leer, das gilt auch für die offenen IBAN-Längen aus Phase 1.
- Für 20 (später): das aktuelle BMF-Schreiben mit den Mustern ab Veranlagungszeitraum 2025.
