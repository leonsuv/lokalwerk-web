# Texte zur Freigabe

Status: **freigegeben von Leon am 25.09.2026** (mit seinen Änderungen an Titeln, Meta-Beschreibungen und den Abschnitten „Gut zu wissen“). Neue oder geänderte Texte vor der Veröffentlichung erneut vorlegen.

Erzeugt mit `node scripts/texte-zur-freigabe.mjs` aus `build/pages.ts` und den Werkzeug-Markups.

## Titel und Meta-Beschreibungen (`build/pages.ts`)

| URL | Titel | Meta-Beschreibung | Zeichen | Index |
|---|---|---|---|---|
| `/` | Lokalwerk – PDF, Fotos und SEPA kostenlos im Browser bearbeiten | PDF zusammenfügen, Fotos verkleinern und SEPA-Überweisungsdateien erstellen. Kostenlos, direkt im Browser, ohne Upload deiner Dateien. | 134 | ja |
| `/pdf-zusammenfuegen/` | PDF zusammenfügen – kostenlos und ohne Upload \| Lokalwerk | Mehrere PDF-Dateien kostenlos zu einer zusammenfügen, Reihenfolge frei wählbar. Läuft komplett in deinem Browser, ohne Upload und ohne Anmeldung. | 145 | ja |
| `/fotos-verkleinern/` | Fotos verkleinern und Metadaten entfernen – kostenlos \| Lokalwerk | Fotos kostenlos für E-Mail und Website verkleinern und dabei GPS-Position und Kameradaten entfernen. Direkt im Browser, ohne Upload. | 132 | ja |
| `/sepa-sammelueberweisung/` | SEPA-XML aus Excel oder CSV erstellen – Sammelüberweisung \| Lokalwerk | Aus einer Excel- oder CSV-Liste kostenlos eine SEPA-XML-Datei für die Sammelüberweisung bei deutschen Banken erstellen. Ohne Upload. | 132 | ja |
| `/pro/` | Lokalwerk Pro | Lokalwerk Pro für regelmäßige Arbeit mit Überweisungen, Fotos und PDFs. Läuft wie alle Werkzeuge vollständig lokal. | 115 | noindex |
| `/impressum/` | Impressum – Lokalwerk | Impressum von Lokalwerk. | 24 | noindex |
| `/datenschutz/` | Datenschutzerklärung – Lokalwerk | Datenschutzerklärung von Lokalwerk. | 35 | noindex |
| `/lizenzen/` | Lizenzen – Lokalwerk | Urheber und Lizenztexte der Bibliotheken und Schriften, die Lokalwerk verwendet. | 80 | noindex |
| `/404.html` | Seite nicht gefunden – Lokalwerk | Diese Seite gibt es nicht. | 26 | noindex |

## PDFs zusammenfügen (`src/tools/pdf-zusammenfuegen/main.html`)

Unterzeile im Kopf: „Wähle zwei oder mehr PDFs aus und bring sie in die richtige Reihenfolge.“

**So funktioniert es**

Wähle die PDFs aus oder zieh sie in die Fläche oben. Mit den Pfeilen legst du die Reihenfolge fest, das Kreuz entfernt eine Datei aus der Liste. „Zusammenfügen und speichern“ erzeugt eine neue PDF mit allen Seiten in genau dieser Reihenfolge. Deine Originale bleiben unverändert.

**Deine Dateien bleiben auf deinem Gerät**

Die PDFs werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung.

**Gut zu wissen**

Verschlüsselte PDFs lassen sich nicht zusammenfügen. Das gilt auch für Dateien, die sich ohne Passwort öffnen lassen, aber zum Beispiel das Kopieren verbieten. Wenn du das Passwort kennst, öffne die Datei damit und speichere sie ohne Schutz neu. Übernommen werden nur die Seiten: Formularfelder, Lesezeichen und digitale Signaturen der Originale sind in der neuen Datei nicht mehr enthalten.

_(Erklärtext: 125 Wörter)_

## Fotos verkleinern (`src/tools/fotos-verkleinern/main.html`)

Unterzeile im Kopf: „Klein genug für E-Mail und Website. GPS-Position, Kameradaten und andere Metadaten werden entfernt.“

**So funktioniert es**

Wähle Fotos aus oder zieh sie in die Fläche oben. Jedes Foto wird sofort mit den Einstellungen rechts verkleinert und lässt sich einzeln speichern. Die maximale Breite gilt in Pixeln, Hochformate werden entsprechend höher. JPEG öffnet jedes Programm, WebP ist bei gleicher Qualität meist kleiner.

**Metadaten werden entfernt**

Handyfotos enthalten oft den Aufnahmeort, das Aufnahmedatum und das Kameramodell. Beim Verkleinern wird das Foto neu erzeugt, diese Angaben werden nicht übernommen. Zusätzlich prüft Lokalwerk jede fertige Datei noch einmal auf solche Angaben und bietet sie nur an, wenn nichts davon enthalten ist.

**Gut zu wissen**

iPhone-Fotos im HEIC-Format kann nicht jeder Browser öffnen. Dann erscheint ein Hinweis: Speichere das Foto als JPEG und füge es erneut hinzu. Transparente Bereiche, etwa in PNG-Dateien, werden beim Speichern als JPEG weiß.

**Deine Fotos bleiben auf deinem Gerät**

Die Fotos werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung. Deine Originale bleiben unverändert.

_(Erklärtext: 147 Wörter)_

## SEPA-Sammelüberweisung (`src/tools/sepa-sammelueberweisung/main.html`)

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

## Weitere Texte

| Stelle | Text | Datei |
|---|---|---|
| 404-Seite | „Diese Seite gibt es nicht.“ / „Die Adresse ist falsch geschrieben oder die Seite wurde verschoben.“ / Button „Zu allen Werkzeugen“ | `pages/404.html` |
| Lizenzseite, Einleitung | siehe Datei | `pages/lizenzen/index.html` |
| SEPA, Hinweis nur eine Überweisung | Wortlaut aus plan.md O9 | `src/tools/sepa-sammelueberweisung/messages.ts` |
| SEPA, Warnung Datum | Wortlaut aus plan.md O7 | `src/tools/sepa-sammelueberweisung/messages.ts` |
| Fehler- und Hinweismeldungen | alle Meldungen der Werkzeuge | `src/tools/*/page.ts`, `src/tools/sepa-sammelueberweisung/messages.ts` |
