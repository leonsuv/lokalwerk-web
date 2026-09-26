# Checkliste erster Livegang

Stand: 26.09.2026, nach Paket 7 (erster Teil). Zwei Teile: **Vor dem Start** enthält nur, was rechtlich oder technisch zwingend ist. **In den ersten Wochen nach dem Start** enthält alles Übrige. Pro, Zahlungen und die Werkzeuge, die auf Unterlagen warten, stehen am Ende getrennt.

Schätzungen sind grobe Richtwerte für eine Person ohne Unterbrechungen. „extern“ heißt: hängt von Dritten ab (Registrar, Anwältin oder Anwalt, Rechtstext-Dienst) und kann länger dauern.

Erledigt am 26.09.2026: Texte aller Pakete freigegeben (außer dem Kasten zu Fristen im Arbeitstage-Rechner, siehe V2.4); Menüpunkt „Pro“ und Pro-Block der Startseite ausgeblendet, `/pro/` ist `noindex`, nicht in der Sitemap und nicht verlinkt (per Test abgesichert).

---

## Teil 1: Vor dem Start

### Aufgaben für Leon

**V1 Impressum und Datenschutzerklärung ausfüllen.** Die Seiten sind Entwürfe mit gelb markierten Platzhaltern (`<mark>`) und einem Kasten „Entwurf: …“; bis dahin stehen sie auf `noindex`. Die Texte gibst du mir, ich baue sie unverändert ein (AGENTS.md Abschnitt 9).

| # | Aufgabe | Schätzung |
|---|---|---|
| V1.1 | Impressum: Vorname Nachname, Straße Hausnummer, PLZ Ort, Telefonnummer; Angabe „falls vorhanden“ klären (in der Rechtsprüfung) | 15 min |
| V1.2 | Datenschutz: Verantwortlicher, Stand („Monat Jahr“) | 10 min |
| V1.3 | Datenschutz: Hoster-Abschnitt mit Cloudflare (Anbieter, Anschrift, Drittland-Absatz) nach Prüfung des Cloudflare-Vertrags (Auftragsverarbeitung, Datenübermittlung) | 1 h |
| V1.4 | Datenschutz: zuständige Aufsichtsbehörde nach deinem Sitz (Entwurf nennt Nordrhein-Westfalen) | 10 min |
| V1.5 | Datenschutz: Abschnitte „Nur falls genutzt:“, „Nur falls angeboten:“ und den Zahlungsanbieter für den Start streichen (Pro ist ausgeblendet) | 15 min |
| V1.6 | Postfach kontakt@lokalwerk.eu einrichten und testen (steht im Impressum); ob der Mail-Anbieter in die Datenschutzerklärung gehört, in V2 klären | 30 min bis 1 h |

**V2 Rechtsprüfung.** Gesammelt an eine Stelle geben; zu jedem Punkt liegt eine Datei mit Wortlaut in `docs/`.

| # | Punkt | Unterlagen | Schätzung (dein Anteil) |
|---|---|---|---|
| V2.1 | Impressum und Datenschutzerklärung prüfen lassen oder über einen Rechtstext-Dienst erstellen, einschließlich Abschnitt 4 „Verarbeitung deiner Dateien und Eingaben“ und der Frage, ob er Ausweiskopien, Kamerafotos über die Dateiauswahl, Adresslisten, Passwörter und IBAN-Listen abdeckt | `pages/impressum/`, `pages/datenschutz/`, plan.md Abschnitt 9, plan-phase2.md Abschnitt 5 | 2 h + extern |
| V2.2 | Unterschrift einfügen: Hinweis gegen die Änderung der eIDAS-Verordnung durch (EU) 2024/1183 abgleichen | `docs/unterschrift-recht.md` | 30 min |
| V2.3 | Ausweiskopie: freigegebener Hinweis und Absatz „Rechtlicher Rahmen“ | `docs/ausweiskopie-recht.md` | 15 min |
| V2.4 | Arbeitstage-Rechner: Kasten zu Fristen (noch Entwurf) | `docs/feiertage-recht.md` | 15 min |
| V2.5 | SEPA-Werkzeuge: reicht der Hinweis, dass Aufträge vor der Freigabe im Onlinebanking geprüft werden müssen? | `src/tools/sepa-sammelueberweisung/` | in V2.1 |
| V2.6 | Adobe-Schriftmetriken in pdf-lib (APAFML, Weitergabe „without charge“; von pdf-lib veränderter Wert `IsFixedPitch`) | `docs/adobe-afm.md` | 15 min |
| V2.7 | Barrierefreiheit: ob für kostenlose Werkzeuge ohne Verkauf eine Erklärung zur Barrierefreiheit nötig ist (BFSG). Nur Frage, keine Annahme von mir | – | in V2.1 |

**V3 Name.** „Lokalwerk“ im DPMAregister und bei TMview prüfen (plan.md Abschnitt 9). 30 min.

**V4 Domain und Cloudflare** (Einstellungen in `docs/deployment.md`).

| # | Aufgabe | Schätzung |
|---|---|---|
| V4.1 | Domain lokalwerk.eu registrieren | 30 min + extern |
| V4.2 | Cloudflare-Konto, Pages-Projekt: Build `npm run build`, Ausgabe `dist`, Node 24 | 30 min |
| V4.3 | Dashboard-Funktionen aus: Web Analytics, E-Mail-Verschleierung, Rocket Loader, Zaraz, Bot Fight Mode / JS-Erkennung, automatische Minifizierung | 20 min |
| V4.4 | Domain verbinden, HTTPS erzwingen, www auf die Hauptdomain umleiten | 20 min |
| V4.5 | Nach dem ersten Deployment `curl -sI https://lokalwerk.eu/` (Befehl in `docs/deployment.md`) und mir die Ausgabe geben | 10 min |
| V4.6 | Lokal `npm run check` mit den DK-Dateien in `.local-specs/`, damit die XSD-Tests nicht übersprungen werden | 10 min |

**V5 Gerätetests, Minimum.** Je ein iPhone mit Safari und ein Android-Gerät mit Chrome, die Seiten von der echten Domain.

| # | Kernfunktion | Was prüfen | Schätzung (beide Geräte) |
|---|---|---|---|
| V5.1 | Datei auswählen | PDF zusammenfügen (zwei PDFs), Fotos verkleinern (mehrere Fotos), IBAN-Liste prüfen (Excel oder CSV): Auswahl klappt, Werkzeug liest die Dateien | 20 min |
| V5.2 | Speichern | Ergebnis aus V5.1 speichern: PDF, JPG als ZIP, CSV bzw. XLSX landen als Datei und lassen sich öffnen. Auf dem iPhone: „In Dateien sichern“ bzw. Download-Liste | 20 min |
| V5.3 | Foto aufnehmen | Dokument scannen: „Foto aufnehmen“ öffnet die Kamera-App, das Foto kommt richtig gedreht an, PDF speichern und öffnen | 15 min |
| V5.4 | Ziehen mit dem Finger beim Schwärzen | PDF schwärzen: Rahmen aufziehen, verschieben, Größe ändern, ohne dass die Seite scrollt; geschwärzte PDF speichern | 15 min |
| V5.5 | Ziehen mit dem Finger bei der Unterschrift | Unterschrift einfügen: mit dem Finger zeichnen, auf die Seite setzen, verschieben; PDF speichern | 15 min |
| V5.6 | HEIC auf dem iPhone | Ein vorhandenes iPhone-Foto (HEIC) in Fotos verkleinern und Foto-Metadaten anzeigen auswählen: Wandelt iOS beim Auswählen in JPEG um, oder erscheint die verständliche Meldung? | 10 min |
| V5.7 | SEPA im Onlinebanking | Mit SEPA-Sammelüberweisung eine Datei mit echten Daten erzeugen, im Onlinebanking hochladen, Vorschau prüfen, **nicht freigeben** | 30 min |
| V5.8 | Überweisungs-QR-Code | Code aus „QR-Code für Überweisungen“ mit einer Banking-App scannen: Empfänger, IBAN, Betrag, Verwendungszweck stimmen, auch Umlaute. Nicht freigeben | 10 min |

Befunde bitte mit Gerät, Browser-Version und Schritt melden, gern mit Bildschirmfoto.

**Summe Leon, vor dem Start: etwa 10½ bis 11 Stunden** (V1 2¼ bis 2¾ h, V2 3¼ h, V3 ½ h, V4 2 h, V5 2¼ h), dazu Wartezeit auf Registrar und Rechtsprüfung.

### Aufgaben für Claude nach deiner Zuarbeit

| # | Aufgabe | Voraussetzung | Schätzung |
|---|---|---|---|
| C1 | Texte für Impressum und Datenschutz unverändert einbauen, `<mark>`-Markierungen und Kästen „Entwurf: …“ entfernen; Build-Test, der beides in Rechtsseiten verbietet | V1, V2.1 | 1 h |
| C2 | `noindex` von Impressum und Datenschutz aufheben, Kanonische URL prüfen; `/lizenzen/`, `/404.html`, `/pro/` bleiben `noindex` | C1 | 15 min |
| C3 | Sitemap prüfen: alle indexierten Seiten, nur `https://lokalwerk.eu/…`, keine `noindex`-Seiten; `robots.txt` verweist darauf; per Test festschreiben | C2 | 30 min |
| C4 | Ergebnis der Rechtsprüfung einarbeiten (nur auf Anweisung, Wortlaut von dir), Kasten zu Fristen freischalten, Quelldateien in `docs/` nachführen | V2 | 1–2 h |
| C5 | `docs/deployment.md` nachführen: Offline-Test nennt noch „alle drei Werkzeuge“; Dashboard-Liste mit deiner Rückmeldung aus V4.3 abgleichen | – | 20 min |
| C6 | Header aus V4.5 gegen `public/_headers` vergleichen; Endprüfung (alle Seiten, hell/dunkel, 360/1280 px, offline, Netzwerk, `/cdn-cgi/`) gegen `https://lokalwerk.eu` | V4.4, V4.5 | 1 h |
| C7 | Befunde aus V5 beheben, je Befund ein Commit mit Browser-Prüfung | V5 | 1–4 h je nach Befund |
| C8 | Letzter Durchlauf: `npm run check` mit `.local-specs/`, Freigabedatei auf offene Markierungen prüfen, Bericht | alles oben | 30 min |

**Summe Claude, vor dem Start: etwa 5½ bis 8½ Stunden**, je nach Rechtsprüfung und Befunden.

---

## Teil 2: In den ersten Wochen nach dem Start

### Aufgaben für Leon

**N1 Weitere Gerätetests.** Geräte zusätzlich: Windows mit Edge oder Chrome, macOS mit Safari, Firefox, ein Tablet, ein älteres Handy.

| # | Werkzeug oder Funktion | Was prüfen | Schätzung |
|---|---|---|---|
| N1.1 | Dokument scannen | 12- bis 48-Megapixel-Fotos ohne Absturz, mehrere Seiten, Ecken genau setzen | 20 min |
| N1.2 | Ausweiskopie | Foto des echten Ausweises: Drehen, Schwärzen, Aufdruck lesbar, PDF drucken; Datei danach löschen | 20 min |
| N1.3 | Foto-Metadaten anzeigen | Handyfotos mit Standort; „Ohne Metadaten speichern“ entfernt sie (in der Fotos-App prüfen) | 20 min |
| N1.4 | Gesichter verpixeln, Foto zuschneiden | Ziehen mit Finger und Stift | 20 min |
| N1.5 | Unterschrift mit Stift | Apple Pencil o. Ä. auf dem Tablet, Linie ohne Versatz | 10 min |
| N1.6 | Speichern aller übrigen Formate | PNG, SVG, ZIP mit mehreren Dateien, SEPA-XML, XLSX auf iOS und Android | 30 min |
| N1.7 | Dateien aus der Cloud | Auswahl aus iCloud Drive bzw. Google Drive | 15 min |
| N1.8 | Große Dateien | PDF mit mehreren hundert MB, 30 Fotos auf einmal: Fortschritt, kein Einfrieren, verständliche Meldung bei zu wenig Speicher | 30 min |
| N1.9 | Offline auf dem Handy | Jede Werkzeugseite laden, Flugmodus, Datei verarbeiten | 30 min |
| N1.10 | Firefox und Safari am Computer | Alle Werkzeuge mit pdf.js (PDF-Seiten bearbeiten, PDF zu Bildern, PDF schwärzen, Unterschrift einfügen, PDF-Formular ausfüllen) und Ablegen auf der Startseite | 45 min |
| N1.11 | QR-Code erstellen | WLAN mit iPhone- und Android-Kamera, Kontakt mit Umlauten, Link | 15 min |
| N1.12 | Passwort-Generator, Arbeitstage-Rechner | Kopieren in die Zwischenablage auf iOS; Datumsauswahl auf iOS und Android | 15 min |
| N1.13 | Fokusring im Dunkelmodus | Ist der Fokus bei Datumsfeldern und Kacheln gut sichtbar (`--primary-soft`, 1,21:1 zur Karte)? Entscheidung, ob ich ihn anhebe | 10 min |

**N2 Weitere Banking-Apps.** Überweisungs-QR-Code mit mindestens zwei weiteren Banking-Apps scannen (andere Bankengruppen als in V5.8). 20 min.

**N3 Echter Etikettendruck.** Probedruck mit „Tatsächliche Größe“ auf Windows und macOS, Messlinie 100 mm, gegen einen echten Bogen halten, dann einen Bogen bedrucken; einmal bewusst mit „An Seite anpassen“ zum Vergleich. 30 min plus ein Bogen Etiketten.

**N4 Screenreader.** Eine Werkzeugseite je Kategorie mit VoiceOver (iOS, macOS), TalkBack (Android) und NVDA (Windows): Ablage, Einstellungen, Ergebnis und Meldungen werden vorgelesen. 1½ bis 2 h.

**N5 „GiroCode“** im DPMAregister prüfen (E2); nur nötig, wenn das Wort verwendet werden soll. 15 min.

**Summe Leon, erste Wochen: etwa 7¼ bis 7¾ Stunden** (N1 4¾ h, N2 bis N5 2½ bis 3 h).

### Aufgaben für Claude

| # | Aufgabe | Schätzung |
|---|---|---|
| C9 | Befunde aus N1 bis N4 beheben, je Befund ein Commit | 2–6 h je nach Befund |
| C10 | Falls entschieden: Fokusring im Dunkelmodus anheben (Werte vorher vorlegen) | 30 min |

**Summe Claude, erste Wochen: etwa 2½ bis 6½ Stunden.**

---

## Nicht Teil des Livegangs

- **Lokalwerk Pro:** Zahlungsanbieter (Paddle oder Lemon Squeezy), Lizenzschlüssel, AGB (Entwurf in `docs/agb-entwurf.md`), Gewerbeanmeldung vor der ersten Zahlung (plan.md Abschnitt 9), Datenschutzerklärung zum Zahlungsablauf; danach Menüpunkt und Pro-Block wieder einblenden (Anleitung in `src/partials/pro-band.html`).
- **camt.053 zu Excel/CSV und SEPA-Lastschrift (pain.008):** warten auf die Unterlagen der Deutschen Kreditwirtschaft in `.local-specs/dk/` (E17).
- **Bankleitzahlen in der IBAN-Liste:** wartet auf die Antwort der Bundesbank (E9).
- **Länge ausländischer IBANs außerhalb des EWR:** wartet auf die SWIFT IBAN Registry in `.local-specs/swift/` (plan.md O4).
- **Gläubiger-ID, Stelle 8:** wird nicht geprüft, solange der Wortlaut der Bundesbank nicht vorliegt.
- **BGB-Fristenrechner:** erst nach Rechtsprüfung (E12).
