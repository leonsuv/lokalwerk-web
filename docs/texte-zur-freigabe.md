# Texte zur Freigabe

Stand: 25.09.2026. Entwürfe von Claude, die laut plan.md Abschnitt 3 vor der Veröffentlichung von Leon freigegeben werden. Die Texte stehen im Code an der angegebenen Stelle; Änderungen bitte dort oder hier markieren.

## Meta-Beschreibungen und Titel (build/pages.ts)

| URL | Titel | Meta-Beschreibung | Zeichen |
|---|---|---|---|
| `/` | Lokalwerk – Dateien bearbeiten, ohne Upload | PDFs zusammenfügen, Fotos verkleinern und SEPA-Überweisungsdateien erstellen, direkt im Browser. Deine Dateien verlassen nie dein Gerät. | 136 |
| `/pdf-zusammenfuegen/` | PDFs zusammenfügen, ohne Upload – Lokalwerk | Mehrere PDFs zu einer Datei zusammenfügen, Reihenfolge frei wählbar. Läuft vollständig in deinem Browser, ohne Upload und ohne Anmeldung. | 137 |
| `/fotos-verkleinern/` | Fotos verkleinern und Metadaten entfernen – Lokalwerk | Fotos für E-Mail und Website verkleinern und dabei GPS-Position und Kameradaten entfernen. Direkt im Browser, ohne Upload. | 122 |
| `/sepa-sammelueberweisung/` | SEPA-Sammelüberweisung aus Excel oder CSV – Lokalwerk | Aus einer Excel- oder CSV-Liste eine SEPA-Überweisungsdatei für deutsche Banken erstellen. Direkt im Browser, ohne Upload. | 122 |
| `/pro/` | Lokalwerk Pro | Lokalwerk Pro für regelmäßige Arbeit mit Überweisungen, Fotos und PDFs. Läuft wie alle Werkzeuge vollständig lokal. | 115 |
| `/impressum/` | Impressum – Lokalwerk | Impressum von Lokalwerk. | 24 |
| `/datenschutz/` | Datenschutzerklärung – Lokalwerk | Datenschutzerklärung von Lokalwerk. | 35 |
| `/lizenzen/` | Lizenzen – Lokalwerk | Urheber und Lizenztexte der Bibliotheken und Schriften, die Lokalwerk verwendet. | 80 |
| `/404.html` | Seite nicht gefunden – Lokalwerk | Diese Seite gibt es nicht. | 26 |

## Erklärtext: PDFs zusammenfügen (`src/tools/pdf-zusammenfuegen/main.html`)

**So funktioniert es**

Wähle die PDFs aus oder zieh sie in die Fläche oben. Mit den Pfeilen legst du die Reihenfolge fest, das Kreuz entfernt eine Datei aus der Liste. „Zusammenfügen und speichern“ erzeugt eine neue PDF mit allen Seiten in genau dieser Reihenfolge. Deine Originale bleiben unverändert.

**Deine Dateien bleiben auf deinem Gerät**

Die PDFs werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung.

**Gut zu wissen**

Verschlüsselte PDFs lassen sich nicht zusammenfügen. Das gilt auch für Dateien, die sich ohne Passwort öffnen lassen, aber zum Beispiel das Kopieren verbieten. Entferne den Schutz vorher. Übernommen werden nur die Seiten: Formularfelder, Lesezeichen und digitale Signaturen der Originale sind in der neuen Datei nicht mehr enthalten.

_(126 Wörter)_

Unterzeile im Kopf: „Wähle zwei oder mehr PDFs aus und bring sie in die richtige Reihenfolge.“

## Erklärtext: Fotos verkleinern (`src/tools/fotos-verkleinern/main.html`)

**So funktioniert es**

Wähle Fotos aus oder zieh sie in die Fläche oben. Jedes Foto wird sofort mit den Einstellungen rechts verkleinert und lässt sich einzeln speichern. Die maximale Breite begrenzt die Breite in Pixeln, Hochformate werden entsprechend höher. JPEG öffnet jedes Programm, WebP ist bei gleicher Qualität meist kleiner.

**Metadaten werden entfernt**

Handyfotos enthalten oft den Aufnahmeort, das Aufnahmedatum und das Kameramodell. Beim Verkleinern wird das Foto neu erzeugt, diese Angaben werden nicht übernommen. Zusätzlich prüft Lokalwerk jede fertige Datei darauf und bietet sie nur an, wenn nichts davon enthalten ist.

**Deine Fotos bleiben auf deinem Gerät**

Die Fotos werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Nach dem Laden der Seite funktioniert das Werkzeug auch ohne Internetverbindung. Deine Originale bleiben unverändert.

_(124 Wörter)_

Unterzeile im Kopf: „Klein genug für E-Mail und Website. GPS-Position, Kameradaten und andere Metadaten werden entfernt.“

## Erklärtext: SEPA-Sammelüberweisung (`src/tools/sepa-sammelueberweisung/main.html`)

**So funktioniert es**

Du brauchst eine Excel-, ODS- oder CSV-Liste mit einer Kopfzeile und je einer Zeile pro Überweisung: Empfänger, IBAN und Betrag, optional Verwendungszweck und BIC. Die Spalten werden anhand der Überschriften zugeordnet, du kannst die Zuordnung ändern. Jede Zeile wird geprüft; fehlerhafte Zeilen werden mit Grund markiert und nicht in die Datei übernommen.

**Die Datei**

Lokalwerk erstellt eine SEPA-Überweisungsdatei im Format pain.001.001.09 nach den Vorgaben der Deutschen Kreditwirtschaft. Sie ist für deutsche Banken gedacht und wird im Onlinebanking als Sammelüberweisung hochgeladen. Zeichen, die in SEPA-Dateien nicht erlaubt sind, werden umgeschrieben, zum Beispiel é zu e. Jede Änderung siehst du in der Tabelle.

**Deine Daten bleiben auf deinem Gerät**

Liste und Kontodaten werden direkt in deinem Browser verarbeitet und nicht hochgeladen. Prüfe die Aufträge vor der Freigabe im Onlinebanking.

_(130 Wörter)_

Unterzeile im Kopf: „Aus einer Liste mit Empfängern, IBANs und Beträgen wird eine Datei, die du im Onlinebanking hochladen kannst. Für deutsche Banken.“

## Weitere neue Texte

| Stelle | Text | Datei |
|---|---|---|
| 404-Seite | „Diese Seite gibt es nicht.“ / „Die Adresse ist falsch geschrieben oder die Seite wurde verschoben.“ / Button „Zu allen Werkzeugen“ | `pages/404.html` |
| Lizenzseite, Einleitung | siehe Datei | `pages/lizenzen/index.html` |
| SEPA, Unterzeile | Zusatz „Für deutsche Banken.“ (plan.md S10) | `src/tools/sepa-sammelueberweisung/main.html` |
| SEPA, Hinweis nur eine Überweisung | Wortlaut aus plan.md O9 | `src/tools/sepa-sammelueberweisung/messages.ts` |
| SEPA, Warnung Datum | Wortlaut aus plan.md O7 | `src/tools/sepa-sammelueberweisung/messages.ts` |
| Fehler- und Hinweismeldungen | alle Meldungen der Werkzeuge | `src/tools/*/page.ts`, `src/tools/sepa-sammelueberweisung/messages.ts` |
