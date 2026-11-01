# Plan: Abgleich mit den KUKANILEA-Webtools

Stand: 01.11.2026. Status: **Entwurf, wartet auf Freigabe** (AGENTS.md Abschnitt 11: neue Seitenstruktur, neue Abhängigkeiten und Umfang dieser Größe brauchen vorher eine Freigabe). Es wurde nichts gebaut.

## 1. Ziel

Lokalwerk soll in Umfang und fachlicher Detailtiefe mindestens so gut werden wie die Webtools von kukanilea.de, und zwar für jedes Werkzeug dort, soweit AGENTS.md es zulässt. Die Seite führt **223 Apps und Funktionen** („Alle 223“; die Startseite nennt daneben „180 Werkzeuge“, die Liste enthält außerdem Querverweise unter „Auch hier passend“). Abgeglichen wird jeder Eintrag der Liste.

Nicht Teil des Ziels: das Aussehen und die Bedienung. Lokalwerks UX bleibt, wie sie ist (Leon, 01.11.2026: Lokalwerk ist hier besser). Von KUKANILEA kommen nur Umfang (welche Werkzeuge) und fachliche Detailtiefe (Prüfungen, Optionen, Formate, ehrliche Grenzen). Das Designsystem von Lokalwerk bleibt unverändert (Leon, 01.11.2026: „nicht vom CSS-Design, sondern von der Detaillierung und UX“).

## 2. Grundlage und Grenzen dieser Prüfung

- Verglichen wurde das **sichtbare Verhalten** laut Seitentexten. **Es wird kein KUKANILEA-Code übernommen**: Der Code ist urheberrechtlich geschützt, und Lokalwerk braucht ohnehin eigene, getestete Fachlogik in `src/core/`.
- **Tief gelesen** (Funktionsumfang, Optionen, Grenzen) sind 21 Seiten: PDF-Startseite, PDF zusammenfügen, schwärzen, Formular ausfüllen, eSignature, IBAN, SEPA-Generator, QR-Codes, QR-Zahlungscode, Bild-Tools, Fotobearbeitung, Arbeitstage, Passwort, Diff, Daten-Werkstatt, CSV bereinigen, CSV-Dubletten, Dokumentenscanner, Online-Konverter, ZIP erstellen, Farben. Bei QR, Bild-Tools, Fotobearbeitung, Passwort und Daten-Werkstatt wurde nur die Übersichtsseite gelesen, nicht die Unterseiten.
- Alle übrigen Werkzeuge sind nur über die Liste auf `/webtools` (Name und Einzeiler) bekannt. Ihr Detailabgleich ist je Phase der erste Schritt.
- KUKANILEAs Aussagen „ohne Upload“ und „kein Netzwerk“ sind **ungeprüft** übernommen. Mit Ausnahme der Handy-Brücke im Dokumentenscanner und dem Nachladen von Bibliotheken („beim ersten Gebrauch geladen“) gibt die Seite nichts anderes an.
- In der Spalte „Status“ unten bedeutet V nur: Es gibt ein Lokalwerk-Werkzeug mit passendem Zweck (Ordnername unter `src/tools/`). Ob es auch die Feinheiten kann, steht in Abschnitt 5 und ist dort teils noch im Code zu prüfen.

Status-Schlüssel: **V** vorhanden, **T** teilweise (Lücken siehe Abschnitt 5), **F** fehlt, **B** blockiert durch AGENTS.md (Abschnitt 3).

## 3. Konflikte mit AGENTS.md

Diese Gruppen lassen sich nicht einfach nachbauen. Jede braucht eine Entscheidung (Abschnitt 7).

| Nr. | Gruppe | Regel | Betroffene KUKANILEA-Werkzeuge |
|---|---|---|---|
| K1 | E-Rechnung | Regel 7: ausgeschlossen | E-Rechnungspflicht-Check; im Online-Konverter „E-Rechnung herauslösen“ und „XRechnung/ZUGFeRD nach PDF/Excel/CSV“; E-Rechnungsteil von „Rechnungen“ |
| K2 | Netzwerk nötig | Regel 1: keine Netzwerkanfragen | Bildschirm-Support, Online-Senden (Gerät zu Gerät), Handy-Brücke im Scanner, Live-Kurse im Währungsrechner, Rechtschreibung & Grammatik (Server-Prüfung) |
| K3 | Steuer, Lohn, Sozial, Recht | Regel 8: keine erfundenen Normen, Quelle vorab | Alle Werkzeuge unter „Steuern & Abgaben“ (außer reiner Mehrwertsteuer-Arithmetik), „Lohn & Leistungen“ (15), Fristen mit Rechtswirkung (Verjährung, Trennungsjahr, Kündigungsfristen), Mietkaution, Nebenkosten, Unterhalt, Umzugskosten, Nachtzuschlag |
| K4 | Rechtstexte | Abschnitt 9: Agent schreibt keine Rechtstexte | Impressum & Rechtstexte, Vertragsvorlagen, Musterbriefe & Kündigungen, Kündigungsschreiben-Generator, Patientenverfügung, Arbeitszeugnis, Abnahme-, Mängel-, Service-, Wartungsprotokolle (Text mit Rechtswirkung) |
| K5 | Daten merken | Regel 5: Speicher nur auf ausdrücklichen Wunsch | Kassenbuch, Fahrtenbuch, Arbeitszeit, Aufgaben & Wiedervorlagen, Kontakte & Nachfassen, Textbausteine, Dienstplan, Urlaubsplaner, Anlageverzeichnis; außerdem „Merkliste“ und „Zuletzt verwendet“ der Übersichtsseite |
| K6 | Neue Abhängigkeiten | Regel 6, Abschnitt 4 | siehe Abschnitt 6 |
| K7 | Werbeseite in erzeugten PDFs | Kein Tracking, keine Werbung | KUKANILEA hängt an jede PDF eine Hinweisseite an. Das wird **nicht** nachgebaut. |

## 4. Abgleich je Werkzeug

Reihenfolge wie auf kukanilea.de/webtools. Wiederholte „Auch hier passend“-Einträge sind Querverweise und stehen nur einmal.

### 4.1 Rechnungen & Buchhaltung

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Rechnungen (Angebot, Rechnung, Mahnung) | F | Ohne E-Rechnung machbar (§ 14 Abs. 4 UStG, § 19 UStG als Quelle). Teil von K1. Speicherung nur auf Wunsch (K5). |
| E-Rechnungspflicht-Check | B | K1 |
| Preisvergleich | F | reine Rechnung |
| Projekt-Nachkalkulation | F | reine Rechnung |
| QR-Zahlungscode-Generator | T | `qr-code-ueberweisung` kann GiroCode. Es fehlen Schweizer QR-Rechnung, strukturierte Referenz (RF), PDF-Export. |
| Fahrten & Dienstreisen | F | K5 |
| Dienstwagenrechner, Kfz-Steuer, Pendlerpauschale, Reisekosten | F | K3 |
| Kfz-Leasingrechner, Kraftstoffkosten | F | reine Rechnung |
| Kassenbuch | F | K5 |
| SEPA & Kontoauszug | T | `sepa-sammelueberweisung` vorhanden. Es fehlt der Kontoauszug-Teil (siehe CAMT.053). |
| CAMT.053-Viewer | F | Quelle: DFÜ-Vereinbarung Anlage 3 |
| IBAN-Validator | V | `iban-pruefen`, Lücken in Abschnitt 5 |
| MT940-Parser | F | Quelle: offizielle MT940-Spezifikation der Deutschen Kreditwirtschaft, vorab zu beschaffen |
| SEPA-Lastschrift-Generator | F | pain.008, Quelle: DFÜ-Vereinbarung Anlage 3. `core/sepa` ist darauf schon vorbereitet. |
| AfA-Rechner, Anlageverzeichnis, Buchführungspflicht, Gewerbesteuer, Grunderwerb/Erbschaft, Grundsteuer, GWG-Checker, Handwerkerbonus, Homeoffice-Pauschale, Lohn-/Einkommensteuer, Steuerklassen-Vergleich, Steuerrücklage, Steuerunterlagen & Fristen, USt-Voranmeldung-Fristen | F | K3 (Anlageverzeichnis zusätzlich K5) |
| Mehrwertsteuer-Rechner (DE/AT/CH), MWST-Rechner Schweiz | F | Sätze sind amtlich, Rechnung einfach. Quelle je Land vorab nennen. |
| Lohnnebenkosten, Sachbezugswerte & Pauschalen | F | K3 |
| Währungsrechner | B | K2. Vorschlag: Kurs von Hand eingeben, keine Live-Daten. |
| Zinsrechner | F | reine Rechnung (Verzugszins-Basiszins ist amtlich, K3 nur für diesen Teil) |

### 4.2 PDF & Dateien

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| PDF (Werkstatt, Projekte) | V | `pdf-werkstatt` |
| EML zu PDF | F | |
| eSignature | V | `pdf-unterschreiben`, Lücken in Abschnitt 5 |
| Berichte & Protokolle, Abnahme-, Mängel-, Service-, Wartungsprotokoll, Baustellen-Tagesbericht | F | Formularlayout machbar, feste Textbausteine mit Rechtswirkung: K4 |
| Broschüre erstellen | F | pdf-lib |
| Leere Seiten entfernen | F | pdf.js zum Erkennen, pdf-lib zum Entfernen |
| Mehrere Seiten pro Blatt | F | pdf-lib |
| PDF drehen, Seiten entfernen/extrahieren/sortieren | V | `pdf-seiten-bearbeiten` |
| PDF teilen | V | `pdf-teilen` |
| PDF zusammenfügen | V | `pdf-zusammenfuegen`, Lücken in Abschnitt 5 |
| PDF-Lesezeichen bearbeiten | F | pdf-lib (Outline selbst schreiben) |
| PDF-Seiten halbieren | F | pdf-lib |
| Seiten einfügen | T | Teil von `pdf-seiten-bearbeiten`/Werkstatt, im Code zu prüfen |
| Vorder- und Rückseiten mischen | F | pdf-lib |
| Bilder aus PDF holen | F | pdf.js |
| Bilder in PDF | V | `bilder-zu-pdf` |
| Datei-Viewer | F | |
| Dokumentenscanner | V | `dokument-scannen`, größere Lücken in Abschnitt 5 |
| Online-Konverter | T | `bildformat-umwandeln`, `excel-csv-umwandeln`. Ohne E-Rechnungsteil (K1). |
| PDF in Bilder | V | `pdf-zu-bildern` |
| PDF in Excel, PDF in Text, Text in PDF | F | PDF in Excel ist heuristisch (Tabellenerkennung), Grenzen ehrlich nennen |
| PDF in Word | F | Word-Datei ohne neue Abhängigkeit selbst schreiben, nur einfaches Layout |
| Texterkennung (OCR), Texterkennung in PDF | F | tesseract.js ist freigegeben, aber noch nicht installiert. Sprachdaten lokal. |
| Anhänge verwalten | F | pdf-lib |
| Bates-Nummerierung | T | im Code zu prüfen (`pdf-stempel`/`pdf-seitenzahlen`) |
| Briefpapier überlagern | F | pdf-lib |
| Kopf- und Fußzeile | T | `pdf-seitenzahlen` kann Zahlen, Datum und freier Text im Code zu prüfen |
| PDF bearbeiten (Text, Stempel, Bilder) | V | `pdf-werkstatt`, `pdf-stempel` |
| Seitenzahlen einfügen | V | `pdf-seitenzahlen` |
| Wasserzeichen einfügen | T | `pdf-stempel`, im Code zu prüfen |
| Formular erstellen, Fragebogen erstellen | F | |
| Impressum & Rechtstexte, Vertragsvorlagen, Musterbriefe & Kündigungen | B | K4. DIN-5008-Brief ohne Rechtstext wäre machbar. |
| PDF in Graustufen, PDF komprimieren, PDF reparieren, PDF zuschneiden, Seitengröße ändern | F | Komprimieren und Graustufen rastern Seiten teilweise. Grenzen ehrlich nennen. |
| Metadaten entfernen | V | `pdf-metadaten-entfernen` |
| Passwort entfernen, Passwort setzen | F | pdf-lib kann nicht verschlüsseln. AES-256 braucht eine neue Abhängigkeit oder eigene Implementierung (Abschnitt 6). |
| PDF schwärzen | V | `pdf-schwaerzen`, Lücken in Abschnitt 5 |
| PDF-Kommentare entfernen | F | pdf-lib |
| Datei-Verschlüsselung | F | WebCrypto (AES-GCM, PBKDF2), keine Abhängigkeit nötig |
| Passwörter & Sicherheit | T | `passwort-generator`, `pruefsumme`. Es fehlen Prüfer und UUID. |
| ZIP entpacken | F | DecompressionStream oder eigener Leser, im Code zu klären |
| ZIP erstellen | T | `core/zip/write.ts` und `ui/zip.ts` vorhanden, aber keine eigene Werkzeugseite |
| PDF prüfen, PDF vergleichen | F | `texte-vergleichen` liefert die Diff-Logik |
| Formular ausfüllen | V | `pdf-formular-ausfuellen` |
| Formular fixieren, PDF-Formular erstellen | F | pdf-lib |
| Arbeitszeugnis erstellen & prüfen | B | K4 |
| Screenshot-Editor | F | `foto-verpixeln` und `rect-editor` sind wiederverwendbar |

### 4.3 Tabellen & Daten

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Tabellen (Editor) | F | |
| Daten-Werkstatt (CSV & Excel) | T | `excel-csv-umwandeln` |
| Pivot-Tabelle | F | |
| Tabellenkalkulation | F | Sehr groß (Formelparser). Eigene Entscheidung (Abschnitt 7). |
| CSV zu vCard, vCard zu CSV | F | vCard 3.0/4.0 nach RFC 6350 als Quelle |
| CSV-Spalten zuordnen | F | `core/sepa/columns.ts` hat Spaltenerkennung als Vorlage |
| CSV-Trennzeichen ändern, CSV-Zeichensatz konvertieren, Dezimaltrennzeichen-Konverter | F | `core/csv` hat Erkennung und Schreiben |
| JSON & CSV | F | |
| CSV aufteilen, CSV zusammenführen, CSV-Dateien vergleichen | F | |
| Excel-Blätter aufteilen, Excel-Blätter zusammenführen, Excel-Dateien zusammenführen | F | SheetJS ist freigegeben |
| vCard zusammenführen, vCard-Dubletten entfernen | F | |
| CSV bereinigen | T | `csv-reparieren`, Lücken in Abschnitt 5 |
| CSV-Dubletten entfernen, Excel-Dubletten finden | V | `duplikate-finden` |
| Entwickler-Helfer (UUID, Base64, JWT, Regex) | F | |
| ICS zu CSV | F | |
| Kontaktdateien (vCard-Viewer) | F | |

### 4.4 Arbeitszeit & Personal

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Arbeitszeit (Stundenzettel) | F | K5 |
| Arbeitstage-Rechner | V | `arbeitstage`, Lücken in Abschnitt 5 |
| Stundenrechner, Teilzeit-Umrechner | F | reine Rechnung |
| Pausenzeiten, Ruhezeiten | F | Quelle: ArbZG §§ 4 und 5 (gesetze-im-internet.de) |
| Überstunden-Zuschlag, Nachtzuschlag | F | K3 |
| Beitragsbemessungsgrenze, Brutto-Netto (DE/AT/CH), Bürgergeld & Sozialleistungen, Elterngeld, Gehaltsrechner, Krankengeld, Minijob & Midijob, Pfändungsrechner, Rentenbeginn, Rentenrechner, Weihnachtsgeld | F | K3 (jährlich wechselnde Werte, hohes Haftungsrisiko) |
| Kündigungsfrist DE/AT/CH, Probezeit | F | K3 (BGB § 622, § 20 AngG, Art. 335c OR) |
| Kündigungsschreiben-Generator | B | K4 |
| Stellenanzeigen-Generator | F | Text mit AGG-Hinweisen: Wortlaut von Leon |
| Dienstplan, Urlaubsplaner | F | K5. Feiertage kommen aus `core/dates/holidays.ts`. |

### 4.5 Text & Kommunikation

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Texte (Editor), Dokument-Editor | F | Der Dokument-Editor bearbeitet Word-Dateien und ist sehr groß. |
| Abwesenheitsnotiz-Generator | F | |
| Diff-Checker | V | `texte-vergleichen`, Lücken in Abschnitt 5 |
| Groß-/Kleinschreibung, Text-Bereiniger, Textzähler | F | |
| Rechtschreibung & Grammatik | B | K2 (ohne Server nur mit großem lokalem Wörterbuch, neue Abhängigkeit) |
| Textbausteine | F | K5 |
| Newsletter | F | |
| E-Mail-Header-Analyzer, EML-Anhänge extrahieren, EML-Viewer, MBOX zu EML, MBOX-Viewer, MSG-Viewer | F | |
| E-Mail-Signatur & vCard | F | |
| Markdown-Editor | F | |
| Patientenverfügung-Generator | B | K4 |
| Diagramm aus Text, Mindmaps | F | Diagramm aus Text ohne neue Abhängigkeit nur mit eigenem kleinem Layouter |
| Bildschirm-Support, Online-Senden | B | K2 |
| Kontakte & Nachfassen | F | K5 |

### 4.6 Planen & Kalender

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Kalenderdateien (ICS-Viewer), ICS zusammenführen, ICS-Dubletten, ICS-Generator | F | RFC 5545 als Quelle |
| Projektplan | F | |
| Kalenderwochen-Rechner (ISO 8601) | F | `core/dates/civil.ts` vorhanden |
| Altersrechner, Tagerechner | F | |
| Fristenrechner | F | K3 (§§ 187 ff. BGB) |
| Verjährungsrechner, Trennungsjahr-Rechner | F | K3 |
| Datum & Zeit (Zeitzonen, Countdown), Wach-Timer | F | |
| Aufgaben & Wiedervorlagen | F | K5 |

### 4.7 Bilder & Gestaltung

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Bilder (Editor) | F | |
| Bild-Tools (komprimieren, HEIC, Format, Verkleinern, EXIF) | V | `fotos-verkleinern`, `bildformat-umwandeln`, `foto-metadaten`, Lücken in Abschnitt 5 |
| Fotobearbeitung (Zuschneiden, Filter, Collage, Wasserzeichen) | T | `foto-zuschneiden` vorhanden. Filter, Collage und Wasserzeichen fehlen. |
| Hintergrund entfernen | F | braucht ein Modell im Browser (Regel 4 erlaubt das), neue Abhängigkeit (Abschnitt 6) |
| Ausmalbilder | F | Kantenerkennung aus Foto |
| Präsentationen, Design erstellen, Raumplaner, Vektor-Editor, Whiteboard, Grundriss zeichnen | F | jeweils eigene Editoren, groß. Eigene Entscheidung (Abschnitt 7). |
| Farben & Paletten | T | `kontrast-pruefen`. Palette aus Bild, CSS-Variablen-Export fehlen. |
| Audio-Recorder | F | MediaRecorder |
| Barcodes | F | Code 128 / EAN selbst schreiben |
| QR-Codes | T | `qr-code`, Lücken in Abschnitt 5 |

### 4.8 Rechner & Umrechner

| KUKANILEA | Status | Lokalwerk / Anmerkung |
|---|---|---|
| Mietkaution, Nebenkosten-Prüfer, Umzugskosten, Unterhaltsrechner | F | K3 |
| Tilgungsplan & Darlehen | F | reine Rechnung |
| Einheiten-Umrechner, Prozentrechner, Taschenrechner | F | |
| Aufmaß-Rechner, Baustoffrechner | F | Verbrauchswerte sind Herstellerangaben, Quelle nennen |
| Systemcheck | F | |

### 4.9 Nur in Lokalwerk

Ausweiskopie, Etiketten, Gläubiger-ID prüfen, Prüfsumme, Foto verpixeln, Kontrast prüfen, Foto-Metadaten (als eigenes Werkzeug), Mehrschritt-Werkstatt. Diese bleiben und werden nicht an KUKANILEA angeglichen.

## 5. Besser machen: Detailabgleich der überlappenden Werkzeuge

Jeder Punkt beschreibt, was KUKANILEA nach seiner Seite kann. Beim ersten Schritt der Phase wird im Lokalwerk-Code geprüft, was davon schon da ist (Spalte „Prüfen“). Nichts davon ist als fehlend bestätigt, solange dort „Prüfen“ steht.

### Übergreifend (alle Werkzeuge)

- (Nur falls es Lokalwerks UX nicht verschlechtert, sonst weglassen:) Einfügen mit Strg+V (Dateien und Text) und Ablegen mehrerer Dateien nacheinander. Prüfen.
- Knopf „Mit Beispiel ausprobieren“. Prüfen.
- Werkzeugsuche mit Strg+K und Dateianalyse mit Werkzeugvorschlag auf der Startseite. Prüfen.
- **Übersichtsseite:** Bei über 100 Werkzeugen braucht Lokalwerk eine Möglichkeit, sie zu finden. Das Muster dafür (Suche, Gruppen, Filter) wird in Phase 1 **in Lokalwerks eigener UX** vorgeschlagen und vor dem Bau vorgelegt. KUKANILEAs Übersicht ist keine Vorlage.
- Ergebnis direkt an das nächste Werkzeug weitergeben, ohne Download. Prüfen (`workshop-link.ts` existiert).
- Je Werkzeug ein Abschnitt „Grenzen“ (was nicht geprüft oder nicht unterstützt wird) und Quellen mit Datum.
- Größenlimit offen nennen (KUKANILEA: 200 MB je PDF) und bei Überschreitung vorher melden. Prüfen.
- Tastaturbedienung mit Undo, wo Seiten oder Elemente angeordnet werden.

### Werkzeug für Werkzeug

| Werkzeug | Was KUKANILEA zusätzlich bietet |
|---|---|
| PDF zusammenfügen | Seitenansicht über alle Dateien (Seiten einzeln entfernen und sortieren); zusagen, dass Text, Schriften, Links, Lesezeichen und Formularinhalte erhalten bleiben. Prüfen. |
| PDF schwärzen | Automatische Suche nach Begriffen (Name, IBAN, E-Mail); nur betroffene Seiten werden als Bild neu erzeugt, die übrigen bleiben durchsuchbar; Erklärtext „Schwärzen, das hält“. Prüfen. |
| PDF-Formular ausfüllen | Feldliste (Text, Kästchen, Auswahl); Erkennung und Meldung bei XFA-Formularen; Hinweis bei flachen Formularen. Prüfen. |
| PDF unterschreiben | Unterschrift zeichnen mit Strichstärke und Farbe; transparentes PNG als eigener Ausgang; gespeicherte Unterschrift (nur auf Knopfdruck, Regel 5); ehrliche eIDAS-Einordnung (Stufe 1, keine QES). Der Rechtstext kommt von Leon (K4). Prüfen. |
| IBAN prüfen | Mehrere IBANs auf einmal mit Ergebnistabelle (Land, gültig, Fehlergrund); „Format nicht geprüft“ bei Ländern ohne bekannte Länge; Hinweis, dass die Prüfsumme nicht den richtigen Empfänger belegt; Hinweis auf die Empfängerprüfung der Banken seit 09.10.2025 (Quelle: VO (EU) 2024/886, vor dem Einbau lesen). Prüfen. |
| SEPA-Sammelüberweisung | Einfügen aus Excel mit Erkennung von Tabulator, Semikolon, Komma und optionaler Kopfzeile; Umstellung der strukturierten Adresse (Stand 2026, Quelle prüfen); Ausführungsdatum nur an TARGET2-Geschäftstagen; Sammel- oder Einzelbuchung; XML-Vorschau und Kopieren; „Auftraggeber merken“ (nur auf Wunsch, nie Empfänger oder Beträge); Tipps für abgelehnte Dateien (pain.002). Prüfen. |
| QR-Code | Weitere Typen (WLAN, vCard, E-Mail); Export als SVG, mit Logo; Scanner per Kamera oder Foto; lesbare Aufbereitung von WLAN, Kontakt und GiroCode. Prüfen. |
| QR-Zahlungscode | Schweizer QR-Rechnung (Swiss Payments Code): QR-IBAN-Erkennung (Clearing-Nr. 30000 bis 31999), QRR (Mod 10 rekursiv), SCOR (ISO 11649), Empfangsschein und Zahlteil im vorgeschriebenen Layout, PDF-Export. Quelle: SIX „Implementation Guidelines QR-bill“, vor dem Einbau lesen. GiroCode: Referenz RF mit Prüfziffer. |
| Fotos verkleinern, Bildformat | Vorher/Nachher-Vergleich; HEIC lesen (nur Safari liest es nativ, sonst Decoder nötig, Abschnitt 6); Stapel mit ZIP; Umbenennen mit Nummerierung und Aufnahmedatum; „Für alle gleich einstellen“ und je Datei abweichend. Prüfen. |
| Foto-Metadaten | Liste der Funde (GPS, XMP, IPTC, Kommentare, C2PA/JUMBF, eingebettete Vorschaubilder, angehängte Fremddaten); verlustfreies Entfernen ohne Neuberechnung der Bilddaten; ICC-Profil optional behalten. Prüfen. |
| Arbeitstage | Österreich und Schweiz mit Kantonen (26) und bekannten Ausnahmen; Liste der ausgeschlossenen Feiertage; Drucken; Quellen mit Stand (Schweiz: SECO-Tabelle). Im Code stehen bisher BW, BY, BE, SN, NW, HH und AT erkennbar, die Länderabdeckung ist zu prüfen. |
| Passwort-Generator | Passwort-Prüfer mit Entropie, Mustern, Abgleich mit lokaler Liste häufiger Passwörter (10.000, Datei gebündelt) und Knackzeiten für drei Szenarien; UUID v4. Hash für Text: `pruefsumme` kann Dateien, Text prüfen. |
| Texte vergleichen | Modi Zeile, Wort, Zeichen; Optionen Groß-/Kleinschreibung und Leerzeichen am Zeilenende; Export als Unified Diff (`.diff`); farbenblind-freundliche Farbschemata; Zeilennummern; klare Limits mit Meldung statt Hänger. Prüfen. |
| CSV reparieren / Excel-CSV | Zeichensatz aus den Bytes erkennen (UTF-8 mit/ohne BOM, UTF-16, Windows-1252) und anzeigen; Download als UTF-8 mit BOM für Excel; **Formelschutz** (Zellen mit `=`, `+`, `@`, Tab, CR bekommen ein führendes Apostroph, negative Zahlen nicht; abschaltbar); Vorschau 200 Zeilen, Download komplett. Prüfen (Grep fand „formula“ nur unspezifisch). |
| Duplikate finden | Exakte Dubletten, erstes Vorkommen bleibt, Reihenfolge bleibt; Zurücksetzen. Wahrscheinlich schon besser (Spaltenauswahl). Prüfen. |
| Dokument scannen | Siehe Abschnitt 5.1. |
| ZIP | Pfade bereinigen (kein `..`, kein führender Slash); doppelte Namen nummerieren; Fortschritt; Hinweis ab ca. 250 MB. Prüfen. |
| Kontrast prüfen | Palette aus Bild (Quantisierung), Export als Hex/RGB/HSL und CSS-Variablen, Prüfung gegen Weiß, Schwarz und eigenen Hintergrund. |

### 5.1 Dokument scannen (größte Lücke)

KUKANILEAs Scanner ist laut Seite sein ausgereiftestes Werkzeug. Zusätzlich zu dem, was `dokument-scannen` und `ausweiskopie` können (Prüfen):

- Kamera mit Auto-Auslöser bei ruhigem Blatt, Eckenprüfung nach der Aufnahme, volle Auflösung
- Je Seite: Eckenerkennung, Knickfalte hinzufügen/entfernen, Wölbung entfernen (Buchseite), Helligkeit, Kontrast, Drehen
- Filter: Farbe (gesäubert), Text kräftigen (Schwarzweiß), Verblasst auffrischen, Stempel farbig, Graustufen, Original
- PDF-Voreinstellungen (Rechnung, Amt, Foto), Größen (Standard, Kompakt unter 2 MB, Druck 300 dpi), Seitenformate A4/A5/Letter/wie das Blatt
- OCR (mit tesseract.js, einmalig laden, dann offline), automatisches Schwärzen von IBAN, Steuer-ID, Krankenversichertennummer, Telefon, E-Mail
- Ausgabe PDF/A-2b, TIFF, Markdown, JSON; Seiten als ZIP
- Erfassungsprotokoll (Geräteuhr-Zeit, Auflösung, SHA-256 je Original; **keine GoBD-Aussage**)
- Belegdaten (Händler, Datum, Betrag, Steuer je Satz mit Plausibilitätsprobe Netto + Steuer = Brutto), Export als CSV oder JSON
- Seiten per Tastatur sortieren, Strg+Z, Strg+S
- **Nicht** übernehmen: Handy-Brücke über Vermittlungsserver (K2); Zwischenspeichern der Seiten über Tage (Regel 5, nur auf ausdrücklichen Wunsch)

## 6. Neue Abhängigkeiten (nur Vorschläge, nichts installiert)

Alle brauchen die Angaben nach AGENTS.md Abschnitt 4 (Version, Lizenz, Größe, Aktualisierung, Telemetrie) vor der Installation.

| Zweck | Vorschlag | Anmerkung |
|---|---|---|
| OCR | tesseract.js | bereits freigegeben, noch nicht installiert, Sprachdaten lokal bündeln |
| PDF verschlüsseln (AES-256) | eigene Implementierung nach ISO 32000-2 oder Bibliothek | pdf-lib kann es nicht. Eigene Umsetzung ist riskant und braucht Tests gegen Referenz-PDFs. Offen. |
| HEIC lesen | eine freizügig lizenzierte WASM-Bibliothek | prüfen, nicht jede ist MIT/BSD |
| Hintergrund entfernen | kleines Segmentierungsmodell (ONNX/WebGPU) | Modell-Lizenz prüfen, Größe, Laden nur auf der Seite |
| ZIP lesen | wenn `DecompressionStream` nicht reicht | zuerst ohne Abhängigkeit versuchen |
| Rechtschreibung | wegen K2 vorerst nicht | |

Alles, was sich in unter 150 Zeilen selbst schreiben lässt (Barcodes, ICS, vCard-Parser, Diff-Modi, Passwortprüfer), wird selbst geschrieben.

## 7. Entscheidungen, die ich von Leon brauche

Empfehlung jeweils zuerst.

1. **K1 E-Rechnung:** Regel 7 bleibt. Alle E-Rechnungsteile entfallen.
2. **K2 Netzwerk:** Die fünf Werkzeuge mit Server entfallen. Währungsrechner mit Kurs von Hand.
3. **K3 Steuer/Lohn/Sozial:** In die letzte Phase schieben und pro Werkzeug erst nach Freigabe einer offiziellen Quelle (Gesetzestext, BMF-Programmablaufplan, Jahreswerte). Keine Rechner mit Haftungsrisiko ohne diese Quelle.
4. **K4 Rechtstexte:** Nur Werkzeuge ohne eigenen Rechtstext bauen. Die Textvorlagen schreibt Leon.
5. **K5 Speicher:** Merkliste und „Zuletzt verwendet“ nur als Knopf „Auf diesem Gerät merken“, nie automatisch. Datenhaltende Werkzeuge (Kassenbuch u. a.) mit Export und Import einer Datei als Normalfall, lokales Speichern nur auf Knopfdruck.
6. **Sehr große Editoren** (Tabellenkalkulation, Präsentationen, Whiteboard, Vektor-Editor, Raumplaner, Grundriss, Dokument-Editor, Bilder-Editor, Design erstellen): zurückstellen, bis alles andere steht.
7. **Reihenfolge:** mit Phase 1 und 2 beginnen (Abschnitt 8).

## 8. Phasen

Pro Werkzeug: eine kleine Änderung, Fachlogik in `src/core/` mit Tests, Browser-Prüfung vor dem Commit, danach Bericht. Nach jeder Phase ein Anhaltepunkt.

| Phase | Inhalt | Anmerkung |
|---|---|---|
| 0 | Entscheidungen aus Abschnitt 7; Code-Prüfung der „Prüfen“-Punkte aus Abschnitt 5 | Ergebnis als Tabelle ergänzen |
| 1 | Übergreifende UX (Strg+V, Beispiele, Strg+K, Grenzen-Abschnitt, Werkzeugvorschlag nach Dateiablage) | wirkt auf alle 35 Werkzeuge |
| 2 | Vorhandene Werkzeuge verbessern: SEPA, IBAN, CSV, Foto-Metadaten, Schwärzen, Formular, Unterschrift, Diff, Arbeitstage, QR, Passwort | Abschnitt 5 |
| 3 | Dokument scannen auf KUKANILEA-Niveau, inklusive OCR | braucht Freigabe tesseract.js-Installation |
| 4 | Fehlende PDF-Werkzeuge (nur pdf-lib/pdf.js): Broschüre, Seiten pro Blatt, halbieren, mischen, leere Seiten, zuschneiden, Seitengröße, Lesezeichen, Anhänge, Briefpapier, Kopf-/Fußzeile, Kommentare entfernen, Bilder holen, Text in PDF, PDF in Text, Graustufen, komprimieren, reparieren, vergleichen, prüfen, Formular erstellen/fixieren | |
| 5 | Tabellen und Kontakte: CSV-Werkzeuge (Trennzeichen, Zeichensatz, Dezimal, aufteilen, zusammenführen, vergleichen, Spalten zuordnen), Excel-Blätter/-Dateien, JSON & CSV, vCard (5), Pivot | |
| 6 | Zahlungsverkehr: SEPA-Lastschrift (pain.008), CAMT.053-Viewer, MT940, Schweizer QR-Rechnung | Quellen und Beispieldateien vorab nach `tests/fixtures/` |
| 7 | Text, E-Mail, Kalender, kleine Rechner ohne Rechtsrisiko: Textzähler, Bereiniger, Groß-/Klein, Abwesenheitsnotiz, EML/MBOX/MSG, ICS (4), Kalenderwoche, Alter, Tage, Zeit, Einheiten, Prozent, Tilgungsplan, Stundenrechner, Pausen/Ruhezeiten | |
| 8 | Bilder und Codes: Filter, Collage, Wasserzeichen, Barcodes, Farben, Audio, Screenshot-Editor, Hintergrund entfernen | |
| 9 | Verschlüsseln: Datei-Verschlüsselung, ZIP entpacken/erstellen, PDF-Passwort | PDF-Passwort nach Entscheidung in Abschnitt 6 |
| 10 | Datenhaltende Werkzeuge (Kassenbuch, Fahrtenbuch, Stundenzettel, Dienstplan, Urlaubsplaner, Aufgaben, Kontakte, Rechnungen ohne E-Rechnung) | nach Entscheidung K5 |
| 11 | Steuer, Lohn, Sozial, Fristen mit Rechtswirkung | nur mit freigegebener Quelle je Werkzeug |
| 12 | Große Editoren | nur nach Freigabe |

Aufwand: Bei 223 Einträgen, von denen Lokalwerk nur einen Bruchteil hat, sind es weit über hundert neue Werkzeugseiten. Die genaue Zahl steht nach Phase 0 fest, weil erst dann Querverweise und Mehrfachnennungen sauber gezählt sind. Das ist nicht in einem Durchgang machbar. Jede Phase ist ein eigener Auftrag.

## 9. Auswirkungen

- **Datenschutzerklärung:** Sobald ein Werkzeug Daten auf dem Gerät speichert (Phase 10, Merkliste, „Auftraggeber merken“), muss die Erklärung angepasst werden (AGENTS.md Abschnitt 9). Ich weise dann vorher darauf hin.
- **Startseite und Werkzeugübersicht:** Bei über 100 Werkzeugen reicht die jetzige Übersicht nicht. Kategorien, Suche und Filter kommen in Phase 1, das Aussehen bleibt im bestehenden Designsystem. Neue Kategorien bekommen eine Akzentfarbe erst nach Rücksprache (AGENTS.md Abschnitt 6).
- **Sitemap, Build und `scripts/check-dist.mjs`:** müssen mit jeder neuen Seite mitwachsen.
