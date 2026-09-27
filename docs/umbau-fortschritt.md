# PDF-Werkstatt: Umbau zum Editor, Fortschritt

Auftrag von Leon am 27.09.2026: Die Werkstatt wird zu einem Programm im Stil von Acrobat oder
InDesign umgebaut, autonom bis zum Ende. Entscheidungen: `docs/umbau-entscheidungen.md`. Neue
Texte: `docs/texte-pdf-werkstatt.md`, Abschnitt „Umbau, zur Durchsicht“.

Wer eine abgebrochene Sitzung fortsetzt: Zweig `claude/kind-meitner-vkoynd`, Liste unten von oben
nach unten abarbeiten, nach jedem Commit den Status hier aktualisieren.

## Zielbild

- Programm-Layout über die ganze Breite unter der Kopfzeile von Lokalwerk
- Menüleiste: Datei, Bearbeiten, Seite, Dokument, Werkzeuge, Ansicht, Hilfe, mit allen Aktionen
  und Tastenkürzeln
- Werkzeugleiste mit Symbolen und Tooltips, gruppiert
- links: Dokumente als Liste, darunter die Seitenminiaturen des aktiven Dokuments
- Mitte: Arbeitsfläche, umschaltbar zwischen Seitenraster (Zoom per Schieberegler und
  Strg+Mausrad) und Einzelseite groß
- rechts: Eigenschaften (Auswahl, Seite, Dokument, aktives Werkzeug) und Verlauf mit anklickbaren
  Schritten
- unten: Statusleiste (Seiten, Auswahl, Zoom, Speicherhinweis)
- Auswahl per Klick, Umschalt, Strg und Auswahlrechteck
- Ziehen mit Animationen: Seiten weichen aus, Einfügemarke, Stapel mit Zähler, sanftes Einrasten;
  zwischen Dokumenten, auch auf die Dokumentliste
- Trennlinien zwischen Seiten, „An Trennlinien teilen“ in einem Schritt, Scheren-Werkzeug
- Kontextmenüs auf Seiten, Zwischenräumen, Dokumenten und leerer Fläche, mit Untermenüs
- Dokumente per Ziehen zusammenführen, Dialog mit Reihenfolge
- Animationen unter 200 ms, aus bei prefers-reduced-motion
- alle bisherigen Funktionen bleiben (Stufe 1 und 2, Übergaben, versteckte Angaben, Schwärzen mit
  allen Sicherheitsregeln)

## Teilschritte

| Nr. | Schritt | Status |
|---|---|---|
| 1 | Fortschritt und Entscheidungen anlegen | fertig |
| 2 | Fachlogik: Trennlinien, Teilen an Trennlinien, Dokumente umordnen, Zusammenführen in Reihenfolge, Sprung im Verlauf, Auswahlrechteck, Auswahl umkehren, Zoom; mit Tests | fertig |
| 3 | Befehlsliste (eine Definition je Aktion für Menü, Werkzeugleiste, Kontextmenü, Tastatur) | fertig |
| 4 | Menüsystem mit Untermenüs und Menüleiste (Tastatur nach WAI-ARIA) | fertig |
| 5 | Programm-Layout (HTML, CSS), Werkzeugleiste mit Tooltips, Statusleiste | fertig |
| 6 | Seitenraster: Dokumente als Abschnitte, Zoom, Trennlinien, FLIP-Animationen | fertig |
| 7 | Dokumentliste und Seitenminiaturen links | fertig |
| 8 | Einzelseite groß (ersetzt die große Vorschau) | fertig |
| 9 | Eigenschaften und Verlauf rechts, eingebettete Werkzeuge dort | fertig |
| 10 | Auswahlrechteck, Ziehen mit Platzhalter, Stapel, Ziehen auf Dokumentliste, Dokumente ziehen (umordnen, zusammenführen) | fertig |
| 11 | Schere als Werkzeug, Kontextmenüs überall | fertig |
| 12 | Zusammenführen-Dialog mit Reihenfolge, Tastenkürzel-Übersicht aus der Befehlsliste | fertig |
| 13 | Handy-Ansicht (vereinfacht, alles erreichbar) | offen |
| 14 | Texte sammeln (texte-pdf-werkstatt.md), Erklärtext anpassen | fertig |
| 15 | Screenshots- und Leistungsskript an die neue Oberfläche anpassen, README-Screenshots | offen |
| 16 | Browser-Prüfung am Ende (Konsole, Netzwerk, CSP, hell/dunkel, 1280 px, Handy) | offen |
| 17 | npm run check, CI, Merge nach main, Abschlussbericht | offen |
