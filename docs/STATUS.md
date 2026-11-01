# Warteschlange

Der Agent arbeitet diese Liste von oben nach unten ab, ohne zu fragen (siehe `docs/entscheidungen.md`). Erledigt: `[x]`. Übersprungen oder zurückgestellt: `[-]` mit Grund. Notbremse für den Stop-Hook: Datei `docs/STOP` anlegen.

## Phase 0: Prüfung
- [x] Alle „Prüfen“-Punkte aus `plan-kukanilea-abgleich.md` Abschnitt 5 im Code prüfen und das Ergebnis in den Plan eintragen (Abschnitt 10)
- [-] Neue Werkzeuge zählen: Querverweise sind nicht eindeutig zuordenbar, der Fortschritt wird stattdessen über diese Liste gezählt
- [x] Arbeitsbranch `ausbau-werkzeuge` anlegen, Plan, Entscheidungen und diese Liste committen

## Phase 1: Übergreifendes
- [ ] Strg+V (Dateien/Text) und „Beispiel“-Knopf nur, wo es die Bedienung nicht verschlechtert
- [ ] Je Werkzeug Abschnitt „Grenzen“ und Quellen
- [ ] Übersichtsseite: neue Werkzeuge im bestehenden Muster aufnehmen

## Phase 2: Vorhandene Werkzeuge fachlich verbessern
- [x] CSV reparieren: Formelschutz, abschaltbar, mit Anzahl in der Meldung (`core/csv/formula-guard.ts`)
- [x] Excel-CSV umwandeln: Formelschutz wie in CSV reparieren
- [x] CSV reparieren: erkannter Zeichensatz wird schon als Chip „Kodierung“ angezeigt (nichts zu tun)
- [x] PDF schwärzen: Suche nach Begriffen (frei, IBAN, E-Mail) im Werkzeug; in der Werkstatt-Einbettung noch nicht (`core/pdf/text-match.ts`)
- [x] PDF-Formular ausfüllen: XFA-Erkennung ist schon vorhanden (nichts zu tun)
- [x] PDF unterschreiben: Unterschrift als transparentes PNG speichern
- [x] Texte vergleichen: Unified-Diff-Export (gegen `patch` mit 197 Zufallsfällen geprüft). Wählbare Modi bewusst nicht: Lokalwerk markiert Wörter schon in der Zeile; Limit besteht (Meldung „zu viele Änderungen“)
- [x] Arbeitstage: Österreich (ARG § 7 Abs. 2, Quelle in `docs/feiertage-recht.md`)
- [-] Arbeitstage Schweiz: übersprungen. Die SECO-Tabelle „Anhang Feiertage Schweiz“ (Stand 12.12.2024) war nicht abrufbar (404), und sie führt nur mit Sonntagen gleichgestellte Feiertage, teils nach Bezirk oder Gemeinde. Ohne gesicherte Tabelle wird nicht geraten (Regel 8, E3).
- [x] QR-Code: E-Mail-Typ (mailto nach RFC 6068)
- [-] QR-Code: Logo im Code: bewusst nicht, es verdeckt Moduleflächen und kann Codes unlesbar machen
- [ ] QR-Code: Scanner per Foto (braucht Decoder-Bibliothek nach E6, in Phase 8 zusammen mit anderen Bildwerkzeugen)
- [x] Passwort prüfen: neue Seite `/passwort-pruefen/` (BSI-Beispiele, häufige Passwörter, Reihen, Tastaturmuster; keine Knackzeiten, weil ohne Quelle). Erklärtext ist Entwurf und nicht von Leon freigegeben
- [-] Passwort: UUID und Hash für Text gehören in den Entwickler-Helfer (Phase 7), nicht hierher
- [-] Fotos verkleinern: Vorher/Nachher-Regler nicht nötig, Ersparnis je Foto und gesamt steht schon da (Lokalwerk-Bedienung bleibt)
- [x] ZIP erstellen: neue Seite `/zip-erstellen/` mit Ordnerstruktur und bereinigten Pfaden (`core/zip/paths.ts`). Erklärtext ist Entwurf und nicht von Leon freigegeben
- [-] SEPA TARGET-Geschäftstag: bewusst nicht, Quelle erlaubt Verschiebung durch die Bank (Plan Abschnitt 10)

## Phase 3: Dokument scannen
- [ ] tesseract.js installieren (Eintrag in `docs/abhaengigkeiten.md`), OCR in Scanner und „Texterkennung“
- [ ] Filter, Voreinstellungen, Größen, Seitenformate, Erfassungsprotokoll

## Phase 4: Fehlende PDF-Werkzeuge
- [ ] Broschüre, Mehrere Seiten pro Blatt, Seiten halbieren, Vorder-/Rückseiten mischen, Leere Seiten entfernen
- [ ] PDF zuschneiden, Seitengröße ändern, Graustufen, Komprimieren, Reparieren
- [ ] Lesezeichen, Anhänge, Briefpapier, Kopf- und Fußzeile, Kommentare entfernen
- [ ] Bilder aus PDF holen, PDF in Text, Text in PDF, PDF in Excel, PDF in Word
- [ ] PDF vergleichen, PDF prüfen, Formular fixieren, PDF-Formular erstellen

## Phase 5: Tabellen und Kontakte
- [ ] CSV: Trennzeichen, Zeichensatz, Dezimaltrennzeichen, aufteilen, zusammenführen, vergleichen, Spalten zuordnen
- [ ] Excel: Blätter aufteilen, Blätter zusammenführen, Dateien zusammenführen
- [ ] JSON und CSV, Pivot-Tabelle
- [ ] vCard: zu CSV, aus CSV, zusammenführen, Dubletten, Viewer

## Phase 6: Zahlungsverkehr
- [ ] Quellen und Beispieldateien nach `tests/fixtures/` laden
- [ ] SEPA-Lastschrift (pain.008), CAMT.053-Viewer, MT940, Schweizer QR-Rechnung

## Phase 7: Text, E-Mail, Kalender, einfache Rechner
- [ ] Textzähler, Text-Bereiniger, Groß-/Kleinschreibung, Abwesenheitsnotiz
- [ ] EML-Viewer, EML-Anhänge, MBOX-Viewer, MBOX zu EML, MSG-Viewer, E-Mail-Header, EML zu PDF
- [ ] ICS: Viewer, zu CSV, zusammenführen, Dubletten, Generator
- [ ] Kalenderwoche, Alter, Tage, Datum & Zeit, Wach-Timer
- [ ] Einheiten, Prozent, Taschenrechner, Tilgungsplan, Zins, Stundenrechner, Teilzeit, Pausen, Ruhezeiten, Preisvergleich, Nachkalkulation, Kfz-Leasing, Kraftstoffkosten, Aufmaß, Baustoff, Systemcheck
- [ ] Markdown-Editor, Diagramm aus Text, Entwickler-Helfer

## Phase 8: Bilder und Codes
- [ ] Filter, Collage, Wasserzeichen, Barcodes, Farben, Audio-Recorder, Screenshot-Editor, Hintergrund entfernen, Ausmalbilder

## Phase 9: Verschlüsseln
- [ ] Datei-Verschlüsselung, ZIP entpacken, PDF-Passwort setzen und entfernen

## Phase 10: Datenhaltende Werkzeuge (Export/Import-Datei als Normalfall)
- [ ] Kassenbuch, Fahrtenbuch, Stundenzettel, Dienstplan, Urlaubsplaner, Aufgaben, Kontakte, Textbausteine, Rechnungen ohne E-Rechnung

## Phase 11: Steuer, Lohn, Sozial (nur mit Quelle laut E3)
- [ ] Je Werkzeug Quelle suchen und eintragen, danach bauen oder mit Grund überspringen

## Phase 12: Große Editoren
- [ ] Tabellenkalkulation, Tabellen-Editor, Präsentationen, Whiteboard, Vektor-Editor, Raumplaner, Grundriss, Dokument-Editor, Bilder-Editor, Design erstellen

## Übersprungen (mit Grund)
- [-] E-Rechnungspflicht-Check, E-Rechnung im Konverter: Regel 7
- [-] Bildschirm-Support, Online-Senden, Handy-Brücke, Rechtschreibung per Server: Regel 1
- [-] Impressum & Rechtstexte, Vertragsvorlagen, Kündigungsschreiben, Patientenverfügung, Arbeitszeugnis: Abschnitt 9
