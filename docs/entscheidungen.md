# Entscheidungen für den Durchlauf (kein Nachfragen)

Gültig ab 01.11.2026 (Leon: „du arbeitest durch, ohne einmal zu fragen“). Diese Datei ersetzt Rückfragen. Wo hier nichts steht, entscheidet der Agent nach dem einfacheren, testbaren Weg und trägt es unten im Protokoll ein.

## Festgelegt

| Nr. | Frage | Entscheidung |
|---|---|---|
| E1 | E-Rechnung (K1) | Regel 7 bleibt. Alle E-Rechnungsteile entfallen und werden in `docs/STATUS.md` als „übersprungen“ geführt. |
| E2 | Werkzeuge mit Netzwerk (K2) | Entfallen: Bildschirm-Support, Online-Senden, Handy-Brücke, Rechtschreibung per Server. Währungsrechner nur mit Kurs von Hand. |
| E3 | Steuer, Lohn, Sozial, Fristen mit Rechtswirkung (K3) | Letzte Phase. Ein Werkzeug wird nur gebaut, wenn der Agent die amtliche Quelle (Gesetzestext, BMF-Programmablaufplan) findet, in `docs/quellen.md` mit URL, Stand und Abrufdatum einträgt und das Ergebnis gegen deren Beispielwerte testet. Sonst wird übersprungen. |
| E4 | Rechtstexte (K4) | Werkzeuge mit eigenem Rechtstext entfallen. Werkzeuge ohne Rechtstext (z. B. DIN-5008-Brief ohne Klausel) werden gebaut. |
| E5 | Speicher (K5) | Nur auf Knopfdruck des Nutzers. Normalfall ist Export und Import als Datei. Merkliste und „Zuletzt verwendet“ nur als Knopf „Auf diesem Gerät merken“. Wo dadurch die Datenschutzerklärung betroffen ist, steht ein Hinweis an Leon im Bericht; der Agent schreibt keinen Rechtstext. |
| E6 | Abhängigkeiten | Als freigegeben gelten alle Pakete aus Abschnitt 6 des Plans, **wenn** Lizenz MIT, BSD, Apache-2.0 oder ISC, keine Telemetrie, kein Netzwerkzugriff zur Laufzeit. Vorher Angaben nach AGENTS.md Abschnitt 4 in `docs/abhaengigkeiten.md` eintragen. Sonst Werkzeug überspringen. |
| E7 | Große Editoren | Zuletzt, nach allem anderen. |
| E8 | Bedienung und Design | Unverändert. Nur neue Seiten im bestehenden Designsystem. Neue Kategorien bekommen keine neue Farbe, sie nutzen die nächstliegende bestehende. |
| E9 | Übersichtsseite | Jedes neue Werkzeug wird im bestehenden Muster ergänzt. Ein neues Such- oder Filtermuster wird erst gebaut, wenn über 60 Werkzeuge existieren, und dann in der bestehenden Gestaltung. |

## Regeln für Unklarheit (statt Rückfrage)

1. Format unbekannt oder keine offizielle Quelle auffindbar: Werkzeug überspringen, vermerken, nie raten.
2. Test oder Build schlägt fehl: höchstens drei Reparaturversuche, dann Werkzeug als „zurückgestellt“ markieren, Änderung zurücknehmen, nächstes Werkzeug.
3. Widerspruch zwischen Plan und AGENTS.md Regeln 1 bis 8: Regeln gewinnen, Werkzeug überspringen.
4. Mehrere Wege möglich: der einfachere, testbare Weg ohne neue Abhängigkeit.
5. Commits auf dem Arbeitsbranch `ausbau-werkzeuge`, Autor `leonsuv <leon.suvorkov@outlook.de>`, ein Commit pro Werkzeug oder pro abgeschlossener Verbesserung. Kein Push auf `main`, kein Deploy.

## Protokoll

| Datum | Werkzeug | Entscheidung | Grund |
|---|---|---|---|
| 01.11.2026 | (Umgebung) | Node 24 liegt unter `~/.local/node` (Prüfsumme gegen SHASUMS256 geprüft). Aufruf mit `PATH=$HOME/.local/node/bin:$PATH`. | Auf der Maschine war kein Node vorhanden |
| 01.11.2026 | Arbeitstage Schweiz | übersprungen | SECO-Tabelle nicht abrufbar, nur Sonntags-gleichgestellte Feiertage, teils nach Bezirk/Gemeinde; Regel 8 |
| 01.11.2026 | Texte vergleichen | Modi Zeile/Wort/Zeichen nicht nachgebaut | Lokalwerk markiert Wörter schon in der Zeile; Bedienung bleibt (E8) |
| 01.11.2026 | OCR (tesseract.js) | übersprungen, nichts installiert | Braucht `'wasm-unsafe-eval'` und `connect-src`; widerspricht plan-phase2.md E4 (kein WebAssembly) und weicht die CSP auf, die das Produktversprechen trägt. Regel: bei Widerspruch gewinnt die bestehende Entscheidung |

| 02.11.2026 | (UI-Prüfung, alle Seiten) | Nur Trefferflächen, Fokus und ein fehlender Feldstil geändert, keine neuen Farben oder Bausteine (E8): Fuß- und Zurück-Links und Regler über 24 px (WCAG 2.5.8), kleine Knöpfe, Segmente und Sprungmarken bei Fingerbedienung 44 px (`pointer: coarse`), `scroll-padding-top` für die feste Kopfzeile (2.4.11), Passwortfeld im Feldstil, Werkstatt-Bereichstitel 12 px statt 11,8 px. „Alle Werkzeuge“ zusätzlich im Fuß | Prüfung mit Headless-Chrome über alle 55 Seiten (360/1280 px, hell/dunkel): kein Kontrastfehler, kein Querscrollen, keine Konsolenfehler. Unter 640 px ist die Hauptnavigation ausgeblendet; im Fuß bleibt der Weg zur Übersicht auf jeder Seite erreichbar |
