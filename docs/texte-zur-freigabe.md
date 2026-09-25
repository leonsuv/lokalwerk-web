# Texte zur Freigabe

Status: Texte der Phase 1 **freigegeben von Leon am 25.09.2026**. Mit **NEU** markiert: neue oder geänderte Texte aus Phase 2, Paket 1, **zur Freigabe**. Geändert wurden in Phase-1-Werkzeugen nur der Erklärtext von Fotos verkleinern (ZIP) und die Pro-Listen (ZIP gestrichen), siehe „Weitere Texte“.

Erzeugt mit `node scripts/texte-zur-freigabe.mjs` aus `build/pages.ts` und den Werkzeug-Markups.

## Titel und Meta-Beschreibungen (`build/pages.ts`)

| URL | Titel | Meta-Beschreibung | Zeichen | Index |
|---|---|---|---|---|
| **NEU** `/` | Lokalwerk – PDF, Fotos, Tabellen und SEPA kostenlos im Browser bearbeiten | PDFs zusammenfügen und teilen, Fotos verkleinern und umwandeln, SEPA-Dateien erstellen. Kostenlos, direkt im Browser, ohne Upload deiner Dateien. | 145 | ja |
| **NEU** `/werkzeuge/` | Alle Werkzeuge – PDF, Fotos, Tabellen und SEPA ohne Upload \| Lokalwerk | Alle Werkzeuge von Lokalwerk auf einen Blick: PDF, Fotos, Tabellen und Zahlungsverkehr. Kostenlos, direkt im Browser, ohne Upload deiner Dateien. | 145 | ja |
| `/pdf-zusammenfuegen/` | PDF zusammenfügen – kostenlos und ohne Upload \| Lokalwerk | Mehrere PDF-Dateien kostenlos zu einer zusammenfügen, Reihenfolge frei wählbar. Läuft komplett in deinem Browser, ohne Upload und ohne Anmeldung. | 145 | ja |
| **NEU** `/pdf-teilen/` | PDF teilen und Seiten extrahieren – kostenlos, ohne Upload \| Lokalwerk | Seiten aus einer PDF kostenlos herausholen oder die PDF in mehrere Dateien aufteilen. Direkt im Browser, ohne Upload und ohne Anmeldung. | 136 | ja |
| **NEU** `/pdf-metadaten-entfernen/` | PDF-Metadaten anzeigen und entfernen – kostenlos, ohne Upload \| Lokalwerk | Kostenlos sehen, welche versteckten Angaben in einer PDF stecken, und Autor, Programm, Datum und frühere Fassungen entfernen. Direkt im Browser, ohne Upload. | 157 | ja |
| **NEU** `/bilder-zu-pdf/` | Bilder zu PDF: JPG und PNG in PDF umwandeln – kostenlos \| Lokalwerk | Fotos und Scans kostenlos zu einer PDF zusammenfassen, eine Seite je Bild, auf DIN A4. Metadaten werden entfernt. Direkt im Browser, ohne Upload. | 145 | ja |
| `/fotos-verkleinern/` | Fotos verkleinern und Metadaten entfernen – kostenlos \| Lokalwerk | Fotos kostenlos für E-Mail und Website verkleinern und dabei GPS-Position und Kameradaten entfernen. Direkt im Browser, ohne Upload. | 132 | ja |
| **NEU** `/bildformat-umwandeln/` | Bildformat umwandeln: WebP in JPG, PNG in JPG – kostenlos \| Lokalwerk | Bilder kostenlos zwischen JPEG, PNG und WebP umwandeln, zum Beispiel WebP in JPG. Metadaten werden entfernt. Direkt im Browser, ohne Upload. | 140 | ja |
| `/sepa-sammelueberweisung/` | SEPA-XML aus Excel oder CSV erstellen – Sammelüberweisung \| Lokalwerk | Aus einer Excel- oder CSV-Liste kostenlos eine SEPA-XML-Datei für die Sammelüberweisung bei deutschen Banken erstellen. Ohne Upload. | 132 | ja |
| **NEU** `/excel-csv-umwandeln/` | Excel in CSV umwandeln und CSV in Excel – kostenlos, ohne Upload \| Lokalwerk | Excel- und ODS-Tabellen kostenlos als CSV speichern oder CSV in Excel umwandeln, mit Semikolon und richtigen Umlauten. Direkt im Browser, ohne Upload. | 150 | ja |
| `/pro/` | Lokalwerk Pro | Lokalwerk Pro für regelmäßige Arbeit mit Überweisungen, Fotos und PDFs. Läuft wie alle Werkzeuge vollständig lokal. | 115 | noindex |
| `/impressum/` | Impressum – Lokalwerk | Impressum von Lokalwerk. | 24 | noindex |
| `/datenschutz/` | Datenschutzerklärung – Lokalwerk | Datenschutzerklärung von Lokalwerk. | 35 | noindex |
| `/lizenzen/` | Lizenzen – Lokalwerk | Urheber und Lizenztexte der Bibliotheken und Schriften, die Lokalwerk verwendet. | 80 | noindex |
| `/404.html` | Seite nicht gefunden – Lokalwerk | Diese Seite gibt es nicht. | 26 | noindex |

## PDFs zusammenfügen (`src/tools/pdf-zusammenfuegen/main.html`)

Karte: „PDFs zusammenfügen“ – „Mehrere PDFs zu einer Datei verbinden. Reihenfolge frei wählbar.“

Unterzeile im Kopf: „Wähle zwei oder mehr PDFs aus und bring sie in die richtige Reihenfolge.“

**So funktioniert es**

Wähle die PDFs aus oder zieh sie in die Fläche oben. Mit den Pfeilen legst du die Reihenfolge fest, das Kreuz entfernt eine Datei aus der Liste. „Zusammenfügen und speichern“ erzeugt eine neue PDF mit allen Seiten in genau dieser Reihenfolge. Deine Originale bleiben unverändert.

**Deine Dateien bleiben auf deinem Gerät**

Die PDFs werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung.

**Gut zu wissen**

Verschlüsselte PDFs lassen sich nicht zusammenfügen. Das gilt auch für Dateien, die sich ohne Passwort öffnen lassen, aber zum Beispiel das Kopieren verbieten. Wenn du das Passwort kennst, öffne die Datei damit und speichere sie ohne Schutz neu. Übernommen werden nur die Seiten: Formularfelder, Lesezeichen und digitale Signaturen der Originale sind in der neuen Datei nicht mehr enthalten.

_(Erklärtext: 125 Wörter)_

## PDF teilen – NEU (`src/tools/pdf-teilen/main.html`)

Karte: „PDF teilen“ – „Seiten aus einer PDF herausholen oder sie in mehrere Dateien aufteilen.“

Unterzeile im Kopf: „Einzelne Seiten aus einer PDF herausholen oder sie in mehrere Dateien aufteilen.“

**So funktioniert es**

Wähle eine PDF aus oder zieh sie in die Fläche oben. Unter „Seiten“ gibst du an, welche Seiten du brauchst, zum Beispiel 1-3, 5 für die Seiten 1, 2, 3 und 5. Die Seiten kommen in der Reihenfolge in die neue Datei, in der du sie angibst. Mit „Jede Seite als eigene PDF“ oder „In Teile mit gleich vielen Seiten“ entstehen mehrere Dateien; die speicherst du zusammen als ZIP-Datei. Deine Originaldatei bleibt unverändert.

**Deine Dateien bleiben auf deinem Gerät**

Die PDF wird direkt in deinem Browser geteilt und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung.

**Gut zu wissen**

Verschlüsselte PDFs lassen sich nicht teilen. Das gilt auch für Dateien, die sich ohne Passwort öffnen lassen, aber zum Beispiel das Kopieren verbieten. Übernommen werden nur die Seiten: Formularfelder, Lesezeichen und digitale Signaturen sind in den neuen Dateien nicht mehr enthalten.

_(Erklärtext: 136 Wörter)_

## PDF-Metadaten entfernen – NEU (`src/tools/pdf-metadaten-entfernen/main.html`)

Karte: „PDF-Metadaten entfernen“ – „Sehen, welche versteckten Angaben in einer PDF stecken, und sie entfernen.“

Unterzeile im Kopf: „Sieh nach, was in einer PDF an versteckten Angaben steckt, zum Beispiel Autor, Programm und Datum, und speichere sie ohne diese Angaben.“

**So funktioniert es**

Wähle eine PDF aus oder zieh sie in die Fläche oben. Du siehst sofort, welche Angaben darin stecken: etwa wer sie erstellt hat, mit welchem Programm und wann. „Bereinigte PDF speichern“ erzeugt eine neue Datei mit denselben Seiten, aber ohne diese Angaben. Die neue Datei wird vor dem Speichern noch einmal geprüft. Deine Originaldatei bleibt unverändert.

**Was bleibt erhalten?**

Der sichtbare Inhalt der Seiten bleibt, auch Kommentare und Markierungen. Die können Namen enthalten, sieh sie dir vor dem Weitergeben an. Bilder in der PDF können eigene Angaben tragen, etwa Kameradaten; die prüft dieses Werkzeug nicht. Lesezeichen, Anhänge und Formularfelder gehen verloren, ebenso die Struktur für Screenreader.

**Deine Dateien bleiben auf deinem Gerät**

Die PDF wird direkt in deinem Browser geprüft und bereinigt, nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung. Verschlüsselte PDFs lassen sich nicht bearbeiten.

_(Erklärtext: 132 Wörter)_

## Bilder zu PDF – NEU (`src/tools/bilder-zu-pdf/main.html`)

Karte: „Bilder zu PDF“ – „Fotos und Scans als JPEG oder PNG zu einer PDF zusammenfassen, eine Seite je Bild.“

Unterzeile im Kopf: „Fotos und Scans als JPEG oder PNG zu einer PDF zusammenfassen, eine Seite je Bild.“

**So funktioniert es**

Wähle Bilder aus oder zieh sie in die Fläche oben. Jedes Bild wird eine Seite, in der Reihenfolge der Liste; mit den Pfeilen änderst du sie. Das Bild wird so groß wie möglich auf die Seite gesetzt, ohne verzerrt zu werden. „PDF erstellen und speichern“ erzeugt die Datei. Deine Originale bleiben unverändert.

**Metadaten werden entfernt**

Handyfotos enthalten oft den Aufnahmeort, das Aufnahmedatum und das Kameramodell. Die Bilder werden für die PDF neu erzeugt, diese Angaben kommen nicht mit in die PDF.

**Gut zu wissen**

iPhone-Fotos im HEIC-Format kann nicht jeder Browser öffnen. Dann erscheint ein Hinweis: Speichere das Foto als JPEG und füge es erneut hinzu. Bei „Original“ behalten die Bilder ihre Auflösung; sehr große Bilder werden nur so weit verkleinert, wie der Browser es verlangt.

**Deine Bilder bleiben auf deinem Gerät**

Die Bilder werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung.

_(Erklärtext: 142 Wörter)_

## Fotos verkleinern (`src/tools/fotos-verkleinern/main.html`)

Karte: „Fotos verkleinern“ – „Für E-Mail und Website verkleinern. GPS-Position und Kameradaten werden entfernt.“

Unterzeile im Kopf: „Klein genug für E-Mail und Website. GPS-Position, Kameradaten und andere Metadaten werden entfernt.“

**So funktioniert es**

Wähle Fotos aus oder zieh sie in die Fläche oben. Jedes Foto wird sofort mit den Einstellungen rechts verkleinert und lässt sich einzeln speichern oder mit „Alle Fotos als ZIP speichern“ zusammen in einer Datei. Die maximale Breite gilt in Pixeln, Hochformate werden entsprechend höher. JPEG öffnet jedes Programm, WebP ist bei gleicher Qualität meist kleiner.

**Metadaten werden entfernt**

Handyfotos enthalten oft den Aufnahmeort, das Aufnahmedatum und das Kameramodell. Beim Verkleinern wird das Foto neu erzeugt, diese Angaben werden nicht übernommen. Zusätzlich prüft Lokalwerk jede fertige Datei noch einmal auf solche Angaben und bietet sie nur an, wenn nichts davon enthalten ist.

**Gut zu wissen**

iPhone-Fotos im HEIC-Format kann nicht jeder Browser öffnen. Dann erscheint ein Hinweis: Speichere das Foto als JPEG und füge es erneut hinzu. Transparente Bereiche, etwa in PNG-Dateien, werden beim Speichern als JPEG weiß.

**Deine Fotos bleiben auf deinem Gerät**

Die Fotos werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung. Deine Originale bleiben unverändert.

_(Erklärtext: 158 Wörter)_

## Bildformat umwandeln – NEU (`src/tools/bildformat-umwandeln/main.html`)

Karte: „Bildformat umwandeln“ – „Bilder zwischen JPEG, PNG und WebP umwandeln, zum Beispiel WebP in JPEG.“

Unterzeile im Kopf: „Bilder zwischen JPEG, PNG und WebP umwandeln, zum Beispiel WebP in JPEG für Office.“

**So funktioniert es**

Wähle das Zielformat und füge die Bilder hinzu. Jedes Bild wird sofort umgewandelt und lässt sich einzeln speichern oder mit „Alle Bilder als ZIP speichern“ zusammen in einer Datei. Die Bildgröße in Pixeln bleibt gleich. Deine Originale bleiben unverändert.

**Welches Format passt?**

JPEG öffnet jedes Programm und eignet sich für Fotos. PNG speichert ohne Verlust und passt zu Grafiken, Logos und Bildschirmfotos. WebP ist bei gleicher Qualität meist kleiner und für Websites gedacht, ältere Programme können es aber oft nicht öffnen.

**Metadaten werden entfernt**

Beim Umwandeln wird das Bild neu erzeugt. Aufnahmeort, Aufnahmedatum und Kameramodell werden nicht übernommen, und jede fertige Datei wird darauf noch einmal geprüft. Animierte GIFs werden als Einzelbild umgewandelt. iPhone-Fotos im HEIC-Format kann nicht jeder Browser öffnen.

**Deine Bilder bleiben auf deinem Gerät**

Die Bilder werden direkt in deinem Browser umgewandelt und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung.

_(Erklärtext: 137 Wörter)_

## SEPA-Sammelüberweisung (`src/tools/sepa-sammelueberweisung/main.html`)

Karte: „SEPA-Sammelüberweisung“ – „Aus einer Excel- oder CSV-Liste eine Überweisungsdatei fürs Onlinebanking erstellen.“

Unterzeile im Kopf: „Aus einer Liste mit Empfängern, IBANs und Beträgen wird eine Datei, die du im Onlinebanking hochladen kannst. Für deutsche Banken.“

**So funktioniert es**

Du brauchst eine Excel-, ODS- oder CSV-Liste mit einer Kopfzeile und je einer Zeile pro Überweisung: Empfänger, IBAN und Betrag, optional Verwendungszweck und BIC. Die Spalten werden anhand der Überschriften zugeordnet, du kannst die Zuordnung ändern. Jede Zeile wird geprüft; fehlerhafte Zeilen werden mit Grund markiert und nicht in die Datei übernommen.

**Die Datei**

Lokalwerk erstellt eine SEPA-Überweisungsdatei im Format pain.001.001.09 nach den Vorgaben der Deutschen Kreditwirtschaft. Sie ist für deutsche Banken gedacht und wird im Onlinebanking als Sammelüberweisung hochgeladen. Zeichen, die in SEPA-Dateien nicht erlaubt sind, werden umgeschrieben, zum Beispiel é zu e. Jede Änderung siehst du in der Tabelle.

**Gut zu wissen**

Nicht jedes Onlinebanking bietet den Upload von Überweisungsdateien an. Oft gibt es ihn nur bei Geschäfts- oder Vereinskonten oder in Banking-Programmen. Frag im Zweifel bei deiner Bank nach, bevor du die Liste vorbereitest.

**Deine Daten bleiben auf deinem Gerät**

Liste und Kontodaten werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Prüfe die Aufträge vor der Freigabe im Onlinebanking.

_(Erklärtext: 152 Wörter)_

## Excel und CSV umwandeln – NEU (`src/tools/excel-csv-umwandeln/main.html`)

Karte: „Excel und CSV umwandeln“ – „Excel-Tabellen als CSV speichern und CSV-Dateien als Excel-Datei. Mit richtigen Umlauten.“

Unterzeile im Kopf: „Excel- und ODS-Tabellen als CSV-Datei speichern, CSV-Dateien als Excel-Datei. Mit Semikolon, Dezimalkomma und richtigen Umlauten.“

**So funktioniert es**

Wähle eine Tabelle aus oder zieh sie in die Fläche oben. Aus einer Excel- oder ODS-Datei wird eine CSV-Datei, aus einer CSV-Datei eine Excel-Datei. Hat die Excel-Datei mehrere Tabellenblätter, wählst du eines aus. Die Vorschau zeigt die ersten Zeilen so, wie sie in der neuen Datei stehen.

**Welche Einstellungen passen?**

Excel in Deutschland erwartet Semikolon als Trennzeichen und Komma als Dezimalzeichen. „UTF-8 für Excel“ sorgt dafür, dass Excel Umlaute richtig anzeigt. Für Programme aus dem englischen Sprachraum wählst du Komma und Punkt. Windows-1252 brauchst du nur, wenn ein älteres Programm UTF-8 nicht lesen kann.

**Gut zu wissen**

In die CSV-Datei kommen die Werte ohne Formatierung: Formeln als Ergebnis, 19 % als 0,19, Beträge ohne Währungszeichen und Tausenderpunkte. Datumswerte werden als 25.09.2026 geschrieben. Farben, Rahmen und weitere Tabellenblätter gehen verloren. Beim Weg von CSV zu Excel wird eine Spalte nur dann zu Zahlen oder Datumswerten, wenn alle Werte darin eindeutig sind. Alles andere bleibt Text, so wie es in der CSV-Datei steht.

**Deine Tabellen bleiben auf deinem Gerät**

Die Dateien werden direkt in deinem Browser umgewandelt und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung. Deine Originale bleiben unverändert.

_(Erklärtext: 181 Wörter)_

## Weitere Texte

| Stelle | Text | Datei |
|---|---|---|
| **NEU** Startseite, Ablagefläche | „PDF, Foto oder Excel-Liste. Danach wählst du, was du damit machen möchtest.“ (vorher: „… Das passende Werkzeug öffnet sich automatisch.“) | `pages/index.html` |
| **NEU** Startseite, Auswahl nach dem Ablegen | Überschrift „2 PDFs ausgewählt“ (Zahl und Art je nach Ablage), „Was möchtest du damit machen?“, Knopf „Andere Dateien wählen“ | `pages/index.html`, `src/tools/home/page.ts` |
| **NEU** Startseite, Meldung | „Für 2 Tabellen auf einmal gibt es kein Werkzeug. Lege nur eine Datei ab.“ | `src/tools/home/page.ts` |
| **NEU** Startseite, unter den Karten | Knopf „Alle Werkzeuge ansehen“ | `pages/index.html` |
| **NEU** Startseite, Pro-Band | Punkt „Alle Fotos auf einmal als ZIP speichern“ gestrichen (E3) | `pages/index.html` |
| **NEU** Pro-Seite | Punkt „ZIP-Export – Alle verkleinerten Fotos mit einem Klick speichern.“ gestrichen, Nummern angepasst (E3). Unterzeile „Für alle, die Überweisungen, Fotos und PDFs regelmäßig bearbeiten.“ unverändert; Fotos kommen in den Pro-Punkten nicht mehr vor, bitte prüfen | `pages/pro/index.html` |
| **NEU** Fotos verkleinern | Knopf „Alle Fotos als ZIP speichern“ statt Hinweis „Alle Fotos als ZIP speichern: mit Lokalwerk Pro“; Meldungen „3 Fotos als ZIP gespeichert.“, „… 1 wird noch verkleinert und ist nicht enthalten.“, „Die ZIP-Datei wäre zu groß. Speichere die Fotos in kleineren Gruppen.“; im Erklärtext Ergänzung „… oder mit „Alle Fotos als ZIP speichern“ zusammen in einer Datei.“ | `src/tools/fotos-verkleinern/` |
| **NEU** /werkzeuge/, Kopf | „Alle Werkzeuge“ – „Jedes Werkzeug läuft direkt in deinem Browser. Deine Dateien werden nicht hochgeladen.“ | `pages/werkzeuge/index.html` |
| **NEU** /werkzeuge/, Suche | Beschriftung „Werkzeug suchen“, Platzhalter „zum Beispiel PDF, Foto oder CSV“, Meldungen „3 Werkzeuge gefunden.“ und „Kein Werkzeug gefunden. Versuch ein anderes Wort, zum Beispiel „PDF“, „Foto“ oder „Excel“.“ | `pages/werkzeuge/index.html`, `src/tools/werkzeuge/page.ts` |
| **NEU** /werkzeuge/, Kategorien | „PDF“, „Fotos und Bilder“, „Tabellen und Listen“, „Zahlungsverkehr und Verein“, „Alltag und Sicherheit“; Zähler „4 Werkzeuge“ | `build/pages.ts` |
| **NEU** Unter jedem Werkzeug | Überschrift „Passt dazu“ mit Karten | `build/tool-blocks.ts` |
| **NEU** „Alle Werkzeuge“-Verweise | zeigen jetzt auf /werkzeuge/ statt auf die Startseite (Text unverändert) | alle Seiten |
| 404-Seite | „Diese Seite gibt es nicht.“ / „Die Adresse ist falsch geschrieben oder die Seite wurde verschoben.“ / Button „Zu allen Werkzeugen“ (zeigt jetzt auf /werkzeuge/) | `pages/404.html` |
| Lizenzseite, Einleitung | siehe Datei | `pages/lizenzen/index.html` |
| SEPA, Hinweis nur eine Überweisung | Wortlaut aus plan.md O9 | `src/tools/sepa-sammelueberweisung/messages.ts` |
| SEPA, Warnung Datum | Wortlaut aus plan.md O7 | `src/tools/sepa-sammelueberweisung/messages.ts` |
| Fehler- und Hinweismeldungen | alle Meldungen der Werkzeuge; **NEU** die Meldungen der neuen Werkzeuge in `src/tools/<werkzeug>/page.ts` | `src/tools/*/page.ts`, `src/tools/sepa-sammelueberweisung/messages.ts` |
