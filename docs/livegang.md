# Checkliste erster Livegang

Stand: 26.09.2026, nach Paket 7 (erster Teil), letzter Commit vor dieser Datei: 038c771. Die Liste enthält nur, was für den ersten Livegang der kostenlosen Werkzeuge fehlt. Pro, Zahlungen und die Werkzeuge, die noch auf Unterlagen warten, stehen am Ende getrennt.

Schätzungen sind grobe Richtwerte für eine Person ohne Unterbrechungen. Punkte mit „extern“ hängen von Dritten ab (Registrar, Anwältin oder Anwalt, Rechtstext-Dienst) und können länger dauern.

## Aufgaben für Leon

### 1. Impressum und Datenschutzerklärung ausfüllen

Die Seiten sind Entwürfe mit gelb markierten Platzhaltern (`<mark>`) und einem Kasten „Entwurf: …“ oben. Solange sie Entwürfe sind, stehen sie auf `noindex`.

| # | Aufgabe | Stelle | Schätzung |
|---|---|---|---|
| 1.1 | Impressum: Vorname Nachname, Straße Hausnummer, PLZ Ort, Telefonnummer, Angabe „falls vorhanden“ entscheiden (z. B. USt-IdNr., ob überhaupt nötig: Rechtsprüfung) | `pages/impressum/index.html` | 15 min |
| 1.2 | Datenschutz: Verantwortlicher („Vorname Nachname, Anschrift wie im Impressum“), Stand („Monat Jahr“) | `pages/datenschutz/index.html` | 10 min |
| 1.3 | Datenschutz: Hoster-Abschnitt mit Cloudflare (Anbieter, Anschrift, Drittland-Absatz „Bei einem Anbieter mit Sitz in den USA:“) nach Prüfung des Cloudflare-Vertrags (Auftragsverarbeitung, Datenübermittlung) | dieselbe Datei | 1 h |
| 1.4 | Datenschutz: zuständige Aufsichtsbehörde prüfen (Entwurf nennt Nordrhein-Westfalen; richtet sich nach deinem Sitz) | dieselbe Datei | 10 min |
| 1.5 | Datenschutz: Abschnitte „Nur falls genutzt:“, „Nur falls angeboten:“ und den Zahlungsanbieter („Paddle.com Market Ltd“) für den ersten Livegang streichen oder behalten; Pro ist noch nicht gebaut | dieselbe Datei | 15 min |
| 1.6 | Postfach kontakt@lokalwerk.eu einrichten und testen (steht im Impressum). Anbieter wählen; ob der Mail-Anbieter in die Datenschutzerklärung gehört, bei der Rechtsprüfung klären | – | 30 min bis 1 h |

Die Texte gibst du mir, ich baue sie unverändert ein (AGENTS.md Abschnitt 9).

### 2. Rechtsprüfung

Am einfachsten gesammelt an eine Stelle geben: Impressum, Datenschutzerklärung und die folgenden Punkte. Für jeden Punkt liegt eine Quelldatei mit Wortlaut in `docs/`.

| # | Punkt | Unterlagen | Schätzung (dein Anteil) |
|---|---|---|---|
| 2.1 | Impressum und Datenschutzerklärung insgesamt prüfen lassen oder über einen Rechtstext-Dienst erstellen (plan.md Abschnitt 9) | `pages/impressum/`, `pages/datenschutz/` | 2 h + extern |
| 2.2 | Datenschutzerklärung Abschnitt 4 „Verarbeitung deiner Dateien und Eingaben“ (auf deine Anweisung erweitert: Formulareingaben, Texte, gezeichnete Unterschriften) | plan.md Abschnitt 9 | in 2.1 |
| 2.3 | Deckt Abschnitt 4 auch die neuen Inhaltsarten ab: Ausweiskopien, Kamerafotos über die Dateiauswahl, Adresslisten, Passwörter, Kontolisten (IBAN)? (plan-phase2.md Abschnitt 5) | plan-phase2.md Abschnitt 5, „Datenschutzerklärung“ | in 2.1 |
| 2.4 | Unterschrift einfügen: Hinweistext gegen die Änderung der eIDAS-Verordnung durch (EU) 2024/1183 abgleichen; `docs/unterschrift-recht.md` stützt sich auf die Originalfassung | `docs/unterschrift-recht.md` | 30 min |
| 2.5 | Ausweiskopie: freigegebener Hinweis und Absatz „Rechtlicher Rahmen“ (§ 20 PAuswG, § 18 PassG) mit ansehen | `docs/ausweiskopie-recht.md` | 15 min |
| 2.6 | Arbeitstage-Rechner: Hinweiskasten und Absatz „Keine Fristberechnung“ (Entwurf) | `docs/feiertage-recht.md`, `docs/texte-zur-freigabe.md` | 15 min |
| 2.7 | Adobe-Schriftmetriken in pdf-lib (APAFML, Weitergabe „without charge“; ein von pdf-lib veränderter Wert `IsFixedPitch`) | `docs/adobe-afm.md`, plan.md Abschnitt 9 | 15 min |
| 2.8 | SEPA-Werkzeuge: Hinweis, dass Aufträge vor der Freigabe im Onlinebanking geprüft werden müssen; ob weitere Haftungshinweise nötig sind | `src/tools/sepa-sammelueberweisung/` | in 2.1 |
| 2.9 | Barrierefreiheit: ob für kostenlose Werkzeuge ohne Verkauf eine Erklärung zur Barrierefreiheit nötig ist (BFSG); spätestens mit Pro erneut prüfen. Keine Annahme von mir, nur Frage | – | in 2.1 |

### 3. Namen und Marken

| # | Aufgabe | Schätzung |
|---|---|---|
| 3.1 | „Lokalwerk“ im DPMAregister und bei TMview prüfen (plan.md Abschnitt 9) | 30 min |
| 3.2 | „GiroCode“ im DPMAregister prüfen (E2). Bis dahin steht das Wort nirgends; für den Livegang nicht nötig | 15 min |

### 4. Domain und Cloudflare

Einstellungen stehen in `docs/deployment.md`.

| # | Aufgabe | Schätzung |
|---|---|---|
| 4.1 | Domain lokalwerk.eu registrieren (extern: Registrierung .eu) | 30 min + extern |
| 4.2 | Cloudflare-Konto, Pages-Projekt aus dem Repo: Build `npm run build`, Ausgabe `dist`, Node 24 | 30 min |
| 4.3 | Dashboard-Funktionen aus lassen bzw. ausschalten: Web Analytics, E-Mail-Verschleierung, Rocket Loader, Zaraz, Bot Fight Mode / JS-Erkennung, automatische Minifizierung | 20 min |
| 4.4 | Domain mit dem Pages-Projekt verbinden, HTTPS erzwingen; www auf die Hauptdomain umleiten | 20 min |
| 4.5 | Nach dem ersten Deployment: Header mit `curl -sI https://lokalwerk.eu/` prüfen (Befehl in `docs/deployment.md`) und mir das Ergebnis geben | 10 min |
| 4.6 | Vor dem Livegang einmal lokal `npm run check` mit den DK-Dateien in `.local-specs/`, damit die XSD-Tests nicht übersprungen werden | 10 min |

### 5. Tests auf echten Geräten

Ich teste in Chrome am Computer (auch mit Handy-Breite und ohne Netz). Folgendes lässt sich nur auf echten Geräten, mit echten Druckern oder echten Apps prüfen.

**Geräte und Browser (Minimum):** iPhone mit Safari, Android-Handy mit Chrome, Windows mit Edge oder Chrome, macOS mit Safari, einmal Firefox. Bei jedem Gerät: hell und dunkel, im Flugmodus nach dem Laden der Seite.

| # | Werkzeug oder Funktion | Was prüfen | Geräte | Schätzung |
|---|---|---|---|---|
| 5.1 | Dokument scannen: „Foto aufnehmen“ | Öffnet die Kamera-App (nicht nur die Dateiauswahl); Foto kommt richtig gedreht an; Ecken lassen sich mit dem Finger setzen; 12- bis 48-Megapixel-Fotos laufen ohne Absturz; PDF lässt sich speichern und öffnen | iPhone, Android | 30 min |
| 5.2 | Dokument scannen, Ausweiskopie, Fotos: Auswahl vorhandener Fotos | iPhone liefert oft HEIC: erscheint die verständliche Meldung, oder wandelt iOS beim Auswählen in JPEG um? | iPhone | 15 min |
| 5.3 | Ausweiskopie | Foto des echten Ausweises: Drehen, Schwärzen mit dem Finger, Aufdruck lesbar; PDF auf Papier drucken und ansehen. Die Datei nicht weitergeben, nach dem Test löschen | iPhone oder Android, Drucker | 20 min |
| 5.4 | Foto-Metadaten anzeigen | Echte Handyfotos mit Standort: Ort, Kamera, Zeit werden angezeigt; „Ohne Metadaten speichern“ entfernt sie (danach in der Fotos-App prüfen) | iPhone, Android | 20 min |
| 5.5 | Ziehen mit Finger und Stift | PDF schwärzen, Gesichter verpixeln, Foto zuschneiden, Unterschrift einfügen (auf Seite setzen): Rahmen aufziehen, verschieben, Größe ändern, ohne dass die Seite scrollt | iPhone, Android, Tablet | 30 min |
| 5.6 | Unterschrift zeichnen | Mit Finger und mit Stift (Apple Pencil o. Ä.); Linie folgt ohne Versatz | Tablet, Handy | 10 min |
| 5.7 | Speichern auf dem Handy | Jedes Ergebnis landet als Datei: PDF, JPG, PNG, SVG, CSV, XLSX, ZIP, SEPA-XML. Besonders iOS: Download-Dialog bzw. „In Dateien sichern“; ZIP wird nicht nur angezeigt | iPhone, Android | 45 min |
| 5.8 | Dateien aus der Cloud | Auswahl aus iCloud Drive bzw. Google Drive in der Dateiauswahl (PDF, Excel) | iPhone, Android | 15 min |
| 5.9 | Große Dateien | PDF mit mehreren hundert MB zusammenfügen und teilen; 30 Handyfotos verkleinern: Fortschritt sichtbar, kein Einfrieren, verständliche Meldung bei zu wenig Speicher | älteres Handy, Computer | 30 min |
| 5.10 | Etiketten: echter Druck | Probedruck auf Papier mit „Tatsächliche Größe“: Messlinie genau 100 mm; gegen einen echten Bogen halten; danach einen Bogen bedrucken. Einmal bewusst mit „An Seite anpassen“ drucken, um den Unterschied zu sehen | Windows, macOS, echter Drucker, ein Etikettenbogen | 30 min |
| 5.11 | QR-Code für Überweisungen | Mit mindestens drei verschiedenen Banking-Apps scannen: Empfänger, IBAN, Betrag, Verwendungszweck kommen richtig an, auch Umlaute. Nicht freigeben | Handys mit Banking-Apps | 30 min |
| 5.12 | QR-Code erstellen | WLAN-Code mit iPhone- und Android-Kamera (verbindet sich), Kontakt (vCard mit Umlauten), Link | iPhone, Android | 15 min |
| 5.13 | SEPA-Sammelüberweisung | Erzeugte Datei im echten Onlinebanking hochladen und die Vorschau prüfen, nicht freigeben (plan.md Abschnitt 9) | Computer, Onlinebanking | 30 min |
| 5.14 | Passwort-Generator | „Kopieren“ legt das Passwort in die Zwischenablage | iPhone Safari, Android | 5 min |
| 5.15 | Arbeitstage-Rechner | Datumsauswahl des Systems auf iOS und Android; Tabelle scrollt innerhalb ihres Rahmens | iPhone, Android | 10 min |
| 5.16 | Startseite: Datei ablegen | Ziehen und Ablegen in Safari, Firefox, Edge; Auswahl des passenden Werkzeugs | macOS, Windows | 15 min |
| 5.17 | pdf.js-Werkzeuge in Safari und Firefox | PDF-Seiten bearbeiten, PDF zu Bildern, PDF schwärzen, Unterschrift einfügen, PDF-Formular ausfüllen: Vorschau erscheint, keine Fehlermeldung | macOS Safari, Firefox | 30 min |
| 5.18 | Offline | Jede Werkzeugseite laden, dann Flugmodus, dann Datei verarbeiten | Handy | 30 min |
| 5.19 | Screenreader | Eine Werkzeugseite je Kategorie mit VoiceOver (iOS, macOS), TalkBack (Android) und NVDA (Windows): Ablage, Einstellungen, Ergebnis, Meldungen werden vorgelesen | alle | 1–2 h |
| 5.20 | Fokusring im Dunkelmodus | Datumsfelder und Kacheln: Ist der Fokus im Dunkelmodus auf deinem Bildschirm gut sichtbar? Der Wert `--primary-soft` hat 1,21:1 zur Karte (plan-phase2.md, Paket 1); Entscheidung, ob ich ihn anheben soll | Computer | 10 min |

Befunde bitte mit Gerät, Browser-Version und Schritt melden; Bildschirmfotos helfen.

### 6. Freigaben, die noch ausstehen

| # | Was | Schätzung |
|---|---|---|
| 6.1 | Texte von Paket 7 (Etiketten, Arbeitstage-Rechner) in `docs/texte-zur-freigabe.md` | 20 min |
| 6.2 | Seite `/pro/`: bleibt sie zum Livegang sichtbar (derzeit `noindex`, im Menü verlinkt), oder blende ich den Menüpunkt bis zum Start von Pro aus? | 5 min |

## Aufgaben für Claude nach Leons Zuarbeit

| # | Aufgabe | Voraussetzung | Schätzung |
|---|---|---|---|
| C1 | Deine Texte für Impressum und Datenschutz unverändert einbauen, Platzhalter-Markierungen (`<mark>`) und die Kästen „Entwurf: …“ entfernen; prüfen, dass kein `<mark>` und kein „Entwurf“ mehr in den Rechtsseiten steht (als Build-Test) | 1.1–1.5, 2.1 | 1 h |
| C2 | `noindex` von Impressum und Datenschutz aufheben (`index: true` in `build/pages.ts`), Kanonische URL prüfen; `/lizenzen/` und `/404.html` bleiben `noindex` | C1 | 15 min |
| C3 | Sitemap prüfen: alle indexierten Seiten, nur `https://lokalwerk.eu/…`, keine `noindex`-Seiten; `robots.txt` verweist darauf; Test ergänzen, der das festschreibt | C2 | 30 min |
| C4 | Freigegebene Texte von Paket 7 einarbeiten, Entwurf-Markierungen in den Werkzeugen entfernen (`<!-- Erklärtext: Entwurf … -->`, Hinweis im Arbeitstage-Rechner) | 6.1, 2.6 | 30 min |
| C5 | Ergebnis der Rechtsprüfung in Werkzeug-Hinweise einarbeiten (nur auf Anweisung, Wortlaut von dir) und Quelldateien in `docs/` nachführen | 2.2–2.9 | 1–2 h |
| C6 | `docs/deployment.md` nachführen: Offline-Test nennt noch „alle drei Werkzeuge“, gemeint sind jetzt 39 Seiten; Liste der Dashboard-Einstellungen gegen deine Rückmeldung aus 4.3 abgleichen | – | 20 min |
| C7 | Nach dem ersten Deployment: Header-Ausgabe aus 4.5 gegen `public/_headers` vergleichen; die Endprüfung (alle Seiten, hell/dunkel, 360/1280 px, offline, Netzwerk) gegen `https://lokalwerk.eu` statt gegen die lokale Vorschau laufen lassen, auch auf `/cdn-cgi/`-Skripte prüfen | 4.4, 4.5 | 1 h |
| C8 | Befunde aus den Gerätetests (Abschnitt 5) beheben, je Befund ein Commit mit Browser-Prüfung | 5 | je nach Befund, 2–6 h |
| C9 | Falls entschieden: Fokusring im Dunkelmodus anheben (Werte vorher vorlegen) | 5.20 | 30 min |
| C10 | Falls entschieden: Menüpunkt „Pro“ bis zum Start ausblenden | 6.2 | 15 min |
| C11 | Letzter Durchlauf vor dem Umschalten: `npm run check` mit `.local-specs/`, `docs/texte-zur-freigabe.md` neu erzeugen und auf offene Markierungen prüfen, Bericht an dich | alles oben | 30 min |

## Nicht für den ersten Livegang nötig

- **Lokalwerk Pro:** Zahlungsanbieter (Paddle oder Lemon Squeezy), Lizenzschlüssel, AGB (Entwurf in `docs/agb-entwurf.md`), Gewerbeanmeldung vor der ersten Zahlung (plan.md Abschnitt 9), Datenschutzerklärung zum Zahlungsablauf.
- **camt.053 zu Excel/CSV und SEPA-Lastschrift (pain.008):** warten auf die Unterlagen der Deutschen Kreditwirtschaft in `.local-specs/dk/` (E17).
- **Bankleitzahlen in der IBAN-Liste:** wartet auf die Antwort der Bundesbank (E9).
- **Länge ausländischer IBANs außerhalb des EWR:** wartet auf die SWIFT IBAN Registry in `.local-specs/swift/` (plan.md O4).
- **Gläubiger-ID, Stelle 8:** wird nicht geprüft, solange der Wortlaut der Bundesbank nicht vorliegt.
- **BGB-Fristenrechner:** erst nach Rechtsprüfung (E12).

## Summe grob

- Leon: etwa 17 bis 19 Stunden eigene Arbeit (davon rund 8½ Stunden Gerätetests), dazu Wartezeit auf Registrar und Rechtsprüfung.
- Claude nach Zuarbeit: etwa 6½ Stunden, dazu 2 bis 6 Stunden für Befunde aus den Gerätetests.
