# Plan Phase 3: PDF-Werkstatt

Stand: 26.09.2026. Entwurf zur Freigabe durch Leon. Noch kein Produktivcode. Es gelten AGENTS.md, plan.md und plan-phase2.md unverändert; wo dieser Plan etwas Neues festlegt, steht es hier.

Klickbarer Oberflächen-Entwurf: `prototype/pdf-werkstatt-entwurf.html` (nur Referenz, wird nie gebaut oder ausgeliefert; Platzhalter-Seiten statt echter PDFs).

Aufwand wie in plan-phase2.md Abschnitt 0: **S** ein Schritt, höchstens ein Tag; **M** zwei bis drei Tage; **L** eine Woche oder mehr.

---

## 1. Ziel und Grundprinzip

Die PDF-Werkstatt ist ein zusammenhängender Arbeitsbereich für PDFs unter `/pdf-werkstatt/`, eine Seite von Lokalwerk wie alle anderen: Kopfzeile, „0 B hochgeladen“-Plakette, Footer, Designsystem, Seitenregister. Sie ersetzt die Einzelwerkzeuge nicht; diese bleiben als eigene Seiten (Suchmaschinen) und verlinken auf die Werkstatt.

**Nicht-destruktiv:** Der Arbeitsbereich besteht aus Dokumenten, die nur Verweise auf Seiten enthalten (Quelle, Seitenindex, Drehung, später weitere Operationen). Ein Dokument kann Seiten aus beliebig vielen Quellen mischen („virtuelles Dokument“). Die geladenen Dateien werden nie verändert. Echte PDFs entstehen erst beim Export, im Worker mit pdf-lib.

**Befehle statt direkter Änderungen:** Jede Änderung ist ein Befehl, der aus dem alten Zustand einen neuen erzeugt. Der Zustand ist unveränderlich (neue Objekte statt Änderungen), der Verlauf ist eine Liste von Zuständen. Rückgängig und Wiederholen sind damit einfach und sicher; weil Zustände nur Verweise enthalten, kostet ein Verlaufsschritt wenige Kilobyte, auch bei 500 Seiten.

**Alles bleibt im Browser** (AGENTS.md Regel 1): keine Anfrage an fremde Domains, kein Browser-Speicher (Regel 5), Warnung vor dem Verlassen der Seite mit ungesicherter Arbeit.

## 2. Datenmodell

Reine Typen und Funktionen in `src/core/workshop/` (neu), ohne DOM, vollständig in Node testbar.

```ts
/** Eine geladene Datei. Bytes liegen nur im Worker und bei pdf.js, nicht im Zustand. */
interface Source {
  id: SourceId;              // fortlaufend, z. B. 's3'
  kind: 'pdf' | 'image';
  name: string;              // Dateiname, nur zur Anzeige
  pageCount: number;         // Bilder: 1
  pageSizes: PageBox[];      // Breite/Höhe in pt je Seite, für Platzhalter und Leerseiten
  facts: SourceFacts;        // Formularfelder, Lesezeichen, Signatur, XFA (für Export-Hinweise)
}

/** Eine Seite im Dokument: Verweis plus Operationen */
type PageRef =
  | { key: PageKey; kind: 'source'; source: SourceId; index: number; rotate: Rotation; ops: PageOp[] }
  | { key: PageKey; kind: 'blank'; box: PageBox; rotate: Rotation; ops: PageOp[] };
// key: stabile ID je Seitenverweis (für Auswahl, DOM, Ansagen), auch bei Duplikaten eindeutig
// Bilder sind Quellen mit einer Seite: kind 'source' mit Source.kind === 'image'

/** Später (Stufe 2): Operationen, die erst beim Export angewendet werden */
type PageOp = { type: 'stamp'; ... } | { type: 'signature'; ... };   // siehe Abschnitt 7.2

interface Doc {
  id: DocId;
  name: string;              // änderbar; Vorgabe: Dateiname ohne .pdf
  pages: readonly PageRef[];
  docOps: DocOp[];           // Stufe 2: z. B. Seitenzahlen (hängen von der Endreihenfolge ab)
}

interface WorkshopState {
  docs: readonly Doc[];      // Reihenfolge der Spalten
  sources: ReadonlyMap<SourceId, Source>;
}

/** Auswahl gehört nicht zum Verlauf (Rückgängig ändert die Auswahl nicht mit) */
interface Selection { keys: ReadonlySet<PageKey>; anchor: PageKey | null; focus: PageKey | null }

/** Ein Befehl: Name für Ansage und Menü, reine Funktion Zustand -> Zustand */
interface Command { label: string; apply(state: WorkshopState): WorkshopState }

interface History { past: WorkshopState[]; present: WorkshopState; future: WorkshopState[]; limit: number }
```

Befehle der Stufe 1 (je eine reine Funktion mit Tests): `addSources`, `newDoc`, `renameDoc`, `closeDoc`, `duplicateDoc`, `movePages(keys, targetDoc, targetIndex)`, `copyPages`, `rotatePages(keys, ±90)`, `deletePages`, `duplicatePages`, `insertBlank(doc, index, box)`, `insertImages(doc, index, sources)`, `splitDoc(doc, index)`, `mergeDocs(ids)`, `extractToNewDoc(keys)`.

Verlaufsgrenze: 100 Schritte (Frage 7). Quellen, auf die weder der aktuelle Zustand noch der Verlauf verweist, werden freigegeben (pdf.js-Dokument schließen, Bytes im Worker löschen).

## 3. Architektur

```
Hauptthread (page.ts der Werkstatt)
  Zustand + Verlauf (core/workshop)      Oberfläche: Spalten, Auswahl, Ziehen, Tastatur, Vorschau
  pdf.js (ui/pdfjs) für Vorschaubilder   ↔  eigener pdf.js-Worker (wie heute)
  Export-Auftrag: Zustand (nur Verweise) →  workshop.worker.ts (pdf-lib)
                                              hält die Quell-Bytes, baut PDFs, ZIP
```

- **Quellen laden:** Datei → Worker bekommt die `File` (strukturierte Kopie, kein Einlesen im Hauptthread), liest sie, prüft sie mit pdf-lib (`loadPdf`, verschlüsselt → Ablehnung wie heute), sammelt Fakten (Formular, Lesezeichen, Signatur), behält die Bytes. Parallel öffnet der Hauptthread die Datei mit pdf.js (`openPdf`) für Seitengrößen und Vorschaubilder. Die Bytes liegen damit zweimal im Speicher (Export-Worker, pdf.js-Worker), im Hauptthread nicht.
- **Vorschaubilder:** `LazyRenderer` (vorhanden) rendert nur sichtbare Seiten, eines nach dem anderen; neu kommt Freigeben beim Verlassen des sichtbaren Bereichs (Canvas auf 0 × 0) und eine Obergrenze gleichzeitig gehaltener Bilder (z. B. 200). Platzhalter haben das Seitenverhältnis aus `pageSizes`, damit nichts springt.
- **Große Vorschau:** eine Seite in hoher Auflösung, nur solange sie offen ist.
- **Export:** Der Worker bekommt nur die Verweise der betroffenen Dokumente, lädt jede Quelle einmal mit pdf-lib, kopiert Seiten (`copyPages`), setzt Drehung, fügt Leerseiten und Bildseiten ein (Platzierung aus `from-images`), schreibt ohne Producer-Angaben (`updateMetadata: false`). Mehrere Dokumente → ZIP (vorhandener eigener ZIP-Code). Fortschritt über das Worker-Protokoll.
- **Seitenwechsel ohne Neuladen** für die Übergabe aus Startseite und Einzelwerkzeugen (Abschnitt 5.3).

## 4. Wiederverwendung: vorhanden, erweitert, neu

### 4.1 Unverändert wiederverwendet

| Modul | Wofür in der Werkstatt |
|---|---|
| `src/core/pdf/merge.ts` (`loadPdf`, `PdfError`, `toPdfError`) | Laden und Fehlerarten (leer, verschlüsselt, beschädigt, zu wenig Speicher) im Worker |
| `src/core/pdf/from-images.ts` (`placeImage`, `A4`, `MM`) | Bildseiten und DIN-A4-Leerseiten |
| `src/core/pdf/stamp-geometry.ts` (`normalizeRotation`, `visibleSize`) | Drehung und sichtbare Seitengröße |
| `src/core/pdf/page-ranges.ts` | Eingabe „Seiten 3–7“ beim Teilen und Auswählen per Tastatur |
| `src/core/pdf/stamp.ts` (`isSigned`, `inspectForStamp`) | Signatur erkennen für den Export-Hinweis |
| `src/core/pdf/form.ts` (`readForm`) | Formularfelder und XFA erkennen für den Export-Hinweis |
| `src/ui/pdfjs/pdfjs.ts` (`openPdf`, `closePdf`, `pageSize`, `renderPageAt`, `PdfOpenError`) | Vorschaubilder, große Vorschau, Seitengrößen |
| `src/ui/worker-protocol.ts` | Aufträge an den Werkstatt-Worker |
| `src/ui/dropzone.ts`, `src/ui/toast.ts`, `src/ui/download.ts`, `src/ui/zip.ts`, `src/ui/local-counter.ts`, `src/ui/dom.ts` | Ablegen, Meldungen, Speichern, ZIP, Plakette |
| `src/core/files/classify.ts` | PDF und Bilder beim Ablegen unterscheiden |
| Designsystem (`src/styles/`), Icons (`src/partials/icons.svg`), Seitenrahmen (`build/html-partials.ts`) | Aussehen wie alle Seiten |

### 4.2 Erweitert (abwärtskompatibel, Einzelwerkzeuge nutzen sie weiter)

| Modul | Erweiterung |
|---|---|
| `src/core/pdf/organize.ts` | wird zu einem Sonderfall des neuen `assemble.ts` (eine Quelle); API `organizePdf` bleibt, Tests bleiben |
| `src/ui/lazy-render.ts` | optionales Freigeben beim Verlassen des Sichtbereichs (`observe(el, job, release?)`), Obergrenze gleichzeitig gehaltener Bilder, Abbruch bei `clear()` |
| `src/ui/worker-protocol.ts` | optionales `transfer` auch für Anfragen (große Puffer ohne Kopie); bestehende Aufrufe unverändert |
| `src/tools/home/page.ts` (Werkzeug öffnen ohne Neuladen) | Kern wandert nach `src/ui/tool-switch.ts`, damit auch Einzelwerkzeuge in die Werkstatt wechseln können; die Startseite nutzt dasselbe Modul |
| `src/tools/home/loaders.ts` | Eintrag für die Werkstatt; bei PDFs steht „In der PDF-Werkstatt öffnen“ zuerst |
| `src/tools/bilder-zu-pdf/prepare.ts` | wandert nach `src/ui/image-prepare.ts` (Bilder neu kodieren, Metadaten weg), damit Werkstatt und „Bilder zu PDF“ denselben Code nutzen |
| `build/pages.ts` (Register) | neuer Eintrag `pdf-werkstatt`; neues optionales Feld `featured` für die hervorgehobene Karte auf Startseite und `/werkzeuge/` |
| `build/licenses.ts` (`USED_IN`) | `pdf-werkstatt` bei pdf-lib und pdfjs-dist (der Build prüft das ohnehin) |
| PDF-Einzelwerkzeuge (`src/tools/pdf-*/page.ts`) | Stufe 1: Knopf „In der PDF-Werkstatt weiterbearbeiten“ nach dem Laden. Stufe 2: einbettbar (Abschnitt 7.1) |

### 4.3 Neu

| Modul | Inhalt | Größe (geschätzt) |
|---|---|---|
| `src/core/workshop/model.ts` | Typen, IDs, Hilfsfunktionen (Seite finden, Position in Dokument) | ~150 Zeilen |
| `src/core/workshop/commands.ts` | die Befehle aus Abschnitt 2, rein | ~350 Zeilen |
| `src/core/workshop/history.ts` | Verlauf mit Grenze, Rückgängig, Wiederholen, freigebbare Quellen ermitteln | ~80 Zeilen |
| `src/core/workshop/selection.ts` | Auswahl wie im Dateimanager (Klick, Umschalt-Bereich über Dokumentgrenzen, Strg/Cmd umschalten) | ~120 Zeilen |
| `src/core/pdf/assemble.ts` | Export mehrerer Dokumente aus mehreren Quellen, Leer- und Bildseiten | ~150 Zeilen |
| `src/tools/pdf-werkstatt/` | `main.html`, `page.ts`, `workshop.worker.ts`, `columns.ts`, `thumbs.ts`, `drag.ts`, `keyboard.ts`, `context-menu.ts`, `preview.ts`, `announce.ts`, `mobile.ts` | ~1.800 Zeilen zusammen |
| `src/ui/tool-switch.ts` | Seitenwechsel ohne Neuladen, gemeinsam für Startseite und Einzelwerkzeuge | ~80 Zeilen |
| `pages/pdf-werkstatt/index.html` | Seitenrahmen wie alle Werkzeuge | – |

## 5. Oberfläche und Integration

### 5.1 Aufbau (Desktop)

Kopf wie jede Werkzeugseite (Icon, Titel „PDF-Werkstatt“, ein Satz). Darunter:

- **Werkzeugleiste** (bleibt beim Scrollen oben): Hinzufügen (PDF oder Bilder), Neues Dokument · Drehen links/rechts, Duplizieren, Leere Seite, Löschen · Teilen, Zusammenführen · Rückgängig, Wiederholen · Große Vorschau · Werkzeuge (Stufe 2) · Exportieren. Knöpfe mit Text, nicht nur Symbole; was zur Auswahl nicht passt, ist deaktiviert.
- **Spalten**: ein Dokument je Spalte, nebeneinander, waagerecht scrollbar. Spaltenkopf mit Name (umbenennbar), Seitenzahl, Menü (Umbenennen, Duplizieren, Hier teilen, Exportieren, Schließen). Seiten als Vorschaubilder untereinander, zwei Spalten breit, mit Seitennummer und farbiger Marke der Quelle (A, B, …), damit gemischte Dokumente lesbar bleiben.
- **Rechte Spalte** (wie bei allen Werkzeugen): Auswahl („3 Seiten aus 2 Dokumenten“), Export (Dokument, Auswahl als neue PDF, alle als ZIP), Hinweise zu Formularfeldern, Lesezeichen, Signaturen.
- **Große Vorschau**: Überlagerung mit einer Seite, Blättern, Drehen, Schließen mit Esc.

### 5.2 Startseite, `/werkzeuge/` und Einzelwerkzeuge

- **Register:** eigener Eintrag, Kategorie PDF, `featured: true`. Auf `/werkzeuge/` steht sie als breite erste Karte der Kategorie PDF, auf der Startseite als hervorgehobene Karte über dem Werkzeug-Raster.
- **Startseite:** Beim Ablegen von PDFs (auch mehreren, auch gemischt mit Bildern, Frage 9) erscheint „In der PDF-Werkstatt öffnen“ als erste Option. Die Dateien bleiben im Arbeitsspeicher.
- **Einzelwerkzeuge:** Nach dem Laden einer Datei erscheint „In der PDF-Werkstatt weiterbearbeiten“. Klick: Werkstatt ohne Neuladen öffnen, Datei(en) im Speicher übergeben. Betroffen: PDFs zusammenfügen, PDF teilen, PDF-Seiten bearbeiten, PDF zu Bildern, PDF schwärzen, Unterschrift einfügen, PDF-Formular ausfüllen, Seitenzahlen, Stempel, PDF-Metadaten entfernen, Bilder zu PDF, Dokument scannen (nach dem Erzeugen).
- Die Erklärtexte der Einzelwerkzeuge bekommen einen Satz mit Link zur Werkstatt (Texte zur Freigabe).

### 5.3 Übergabe im Speicher ohne Browser-Speicher

Wie heute auf der Startseite (`src/tools/home/page.ts`): Markup der Werkstatt dynamisch laden, in `<main>` einsetzen, `history.pushState` auf `/pdf-werkstatt/`, Titel und Beschreibung setzen, Dateien übergeben. Die Zurück-Taste lädt die vorige Seite neu. Werkstatt-Code und pdf-lib werden erst dabei geladen (chunk-guard bleibt erfüllt, weil das dynamisch geschieht). Kein `localStorage`, kein IndexedDB, kein `postMessage` an andere Fenster. Bei ungesicherter Arbeit in der Werkstatt fragt die Zurück-Taste vorher (`beforeunload`).

### 5.4 Handy (390 px): ehrliche Einschätzung

Mehrere Spalten und Ziehen zwischen Dokumenten sind auf 390 px nicht sinnvoll: Vorschaubilder wären zu klein, Ziehen kollidiert mit Scrollen, lange Wege über mehrere Dokumente. Vorschlag für eine **vereinfachte Ansicht**:

- Ein Dokument zur Zeit, Wechsel über eine Auswahlleiste oben („Vertrag (6) ▾“).
- Raster mit drei Seiten je Zeile.
- Tippen öffnet die große Vorschau; ein Knopf „Auswählen“ schaltet in den Auswahlmodus mit Häkchen (lange drücken ebenso).
- Untere Aktionsleiste: Drehen, Löschen, Verschieben nach …, Mehr. „Verschieben nach …“ öffnet eine Liste der Dokumente und eine Position („Anfang“, „Ende“, „nach Seite …“). Das ersetzt Ziehen zwischen Dokumenten.
- Umsortieren innerhalb eines Dokuments: in der großen Vorschau „Nach vorne“/„Nach hinten“; Ziehen nur mit Griff und nach kurzem Halten (Frage 10).
- Export und Rückgängig wie am Desktop.
- Grenze: auf älteren Handys weniger Seiten (Speicher), Meldung wie in Abschnitt 8.

## 6. Interaktion

### 6.1 Maus

- Klick wählt eine Seite, Umschalt+Klick wählt einen Bereich (auch über Dokumentgrenzen, in der Reihenfolge der Spalten), Strg/Cmd+Klick schaltet einzelne Seiten dazu oder weg. Klick auf freie Fläche hebt die Auswahl auf.
- Ziehen: Seiten der Auswahl (oder die gezogene Seite) wandern gemeinsam; eine Einfügemarke zeigt das Ziel, auch in anderen Spalten und in leeren Dokumenten; am Rand scrollt die Ansicht mit. Esc bricht ab. Alt beim Loslassen kopiert statt zu verschieben.
- Doppelklick öffnet die große Vorschau. Rechtsklick öffnet das Kontextmenü mit allen Aktionen.
- Ablegen von Dateien aus dem Dateimanager auf eine Spalte fügt sie dort ein, auf freie Fläche als neues Dokument.

### 6.2 Tastatur (jede Aktion ohne Ziehen, WCAG 2.1.1 und 2.5.7)

| Taste | Wirkung |
|---|---|
| Tab / Umschalt+Tab | zwischen Werkzeugleiste, Spalten, rechter Spalte |
| Pfeiltasten | Fokus auf die nächste Seite (links/rechts im Raster, oben/unten) |
| Strg/Cmd+Pfeil links/rechts | Fokus ins Nachbardokument |
| Leertaste | Seite mit Fokus auswählen oder abwählen |
| Umschalt+Pfeiltasten | Auswahl erweitern |
| Strg/Cmd+A | alle Seiten des Dokuments auswählen |
| Esc | Auswahl aufheben, Ziehen oder Menü abbrechen |
| Strg/Cmd+X, Strg/Cmd+C, Strg/Cmd+V | Seiten ausschneiden, kopieren, vor der Fokus-Seite einfügen (interne Ablage, nicht die Zwischenablage des Systems) |
| Alt+Pfeil hoch/runter | Auswahl eine Position nach vorne/hinten |
| Alt+Pfeil links/rechts | Auswahl ans Ende des Nachbardokuments |
| R / Umschalt+R | rechts / links drehen |
| Entf | Auswahl löschen |
| Strg/Cmd+Umschalt+D | Auswahl duplizieren (Strg+D belegt der Browser für Lesezeichen) |
| Strg/Cmd+Z, Strg/Cmd+Umschalt+Z, Strg+Y | Rückgängig, Wiederholen |
| Eingabe | große Vorschau; darin Pfeiltasten blättern, Esc schließt |
| F2 | Dokument umbenennen (im Spaltenkopf) |
| Umschalt+F10 oder Kontextmenü-Taste | Kontextmenü |

Kürzel gelten nur, wenn der Fokus in den Spalten liegt, nie in Eingabefeldern. Eine Übersicht öffnet sich mit „?“ (Frage 5).

### 6.3 Touch

Auf Tablets wie am Desktop, Ziehen nach kurzem Halten (300 ms), damit Scrollen frei bleibt. Auf Handys die vereinfachte Ansicht (5.4).

### 6.4 Screenreader

- Jede Spalte ist eine Liste mit Mehrfachauswahl (`role="listbox"`, `aria-multiselectable`), jede Seite eine Option mit Beschriftung wie „Seite 3 von 12, aus Anlagen.pdf Seite 1, gedreht um 90 Grad, ausgewählt“. Fokus über „roving tabindex“.
- Ansagen über eine unsichtbare Live-Region (`aria-live="polite"`): „3 Seiten ausgewählt“, „2 Seiten nach Vertrag an Position 4 verschoben“, „Rückgängig: Drehen“, „Export fertig: Vertrag.pdf“.
- Die Einfügemarke beim Ziehen hat eine Textentsprechung („Ziel: vor Seite 5 von Vertrag“).

### 6.5 Ziehen: selbst bauen

Eigene Umsetzung mit Pointer Events (etwa 350 Zeilen in `drag.ts`), keine Bibliothek. Gründe: HTML5-Drag-and-Drop funktioniert auf iOS-Touch und bei Mehrfachauswahl schlecht; vorhandene Bibliotheken passen nicht (dnd-kit braucht React; SortableJS, MIT, etwa 45 KB, deckt Mehrfachziehen zwischen Listen nur mit Zusatzmodul ab und bringt keine Tastaturbedienung mit, die wir ohnehin selbst bauen müssen). Die Pointer-Logik existiert schon in ähnlicher Form in `src/ui/rect-editor.ts`.

**Keine neuen Abhängigkeiten in Stufe 1 und 2.**

## 7. Stufe 2: vorhandene Werkzeuge in der Werkstatt

### 7.1 Einbetten statt Nachbau

Die sechs Werkzeuge (Seitenzahlen, Stempel, Schwärzen, Unterschrift, Metadaten entfernen, Formular ausfüllen) werden einbettbar: Ihre `page.ts` bekommt eine Funktion `mount(host)`, die dasselbe Markup (`main.html`) in einen Bereich der Werkstatt setzt und statt „Speichern“ das Ergebnis an die Werkstatt zurückgibt. Auf den Einzelseiten ruft der Seitenrahmen `mount` mit dem bisherigen Verhalten auf. Bedienung und Texte sind dieselben. Dafür nötig:

- Elemente nicht mehr beim Laden des Moduls suchen, sondern in `mount` (heute `$('#…')` auf Modulebene).
- Eine kleine Schnittstelle `ToolHost`: Eingabe (PDF-Bytes des betroffenen Dokuments oder der Auswahl), Ergebnis (neue Bytes), Abbruch.
- Der Werkstatt-Bereich zeigt das Werkzeug als Seitenleiste oder Überlagerung (Entwurf: rechte Spalte).

### 7.2 Wie ein Werkzeug auf virtuelle Dokumente wirkt

Zwei Wege, je nach Werkzeug:

| Werkzeug | Weg | Begründung |
|---|---|---|
| Seitenzahlen | Dokument-Operation, erst beim Export | hängt von der Endreihenfolge ab („Seite 3 von 12“) |
| Stempel und Wasserzeichen | Seiten-Operation, erst beim Export | Seiten bleiben verschiebbar |
| Unterschrift einfügen | Seiten-Operation, erst beim Export | Platzierung relativ zur Seite (vorhanden: `place-image.ts`) |
| Schwärzen | „Einbacken“: betroffene Seiten werden gerastert, das Ergebnis wird eine neue Quelle | nichts vom Original darf übrig bleiben |
| Formular ausfüllen | „Einbacken“ des betroffenen Dokuments | Formulare hängen am ganzen Dokument |
| Metadaten entfernen | Export-Einstellung (ohnehin ohne Info-Einträge; Hinweis) | kein Seitenbezug |

„Einbacken“ ist ein normaler Befehl: Er ersetzt Seitenverweise durch Verweise auf die neue Quelle. Rückgängig macht ihn rückgängig; die alte Quelle bleibt, solange der Verlauf auf sie verweist (Speicher, Abschnitt 8).

## 8. Leistung und Speicher

Ziel: mindestens 500 Seiten über alle Dokumente ohne spürbares Ruckeln.

- **DOM:** 500 Seitenkacheln sind für den Browser unkritisch, wenn sie leicht sind: fester Platzhalter mit Seitenverhältnis, `content-visibility: auto` je Spalte, keine Schatten auf jeder Kachel beim Ziehen.
- **Bilder:** höchstens etwa 200 gerenderte Vorschaubilder gleichzeitig (bei 150 × 212 px rund 25 MB), außerhalb des Sichtbereichs freigeben. iOS Safari begrenzt den gesamten Canvas-Speicher einer Seite hart; Freigeben (Canvas 0 × 0) ist dort Pflicht, nicht Kür.
- **Befehle:** Verschieben von 100 Seiten ist ein neues Array je betroffenem Dokument, im Millisekundenbereich; die Oberfläche aktualisiert nur betroffene Spalten.
- **Speichergrenzen:** Summe der Quellgrößen mitführen; ab etwa 1 GB Hinweis, dass der Browser knapp werden kann. `out-of-memory` aus dem Worker (vorhanden in `PdfError`) und fehlgeschlagene Vorschaubilder werden verständlich gemeldet („Zu wenig Arbeitsspeicher für diese Datei. Schließe andere Dokumente oder lade die Seite neu.“). Chrome meldet Speicher über `performance.memory`, Safari und Firefox nicht; dort nur die Summe als Richtwert (Frage 6).
- **Export:** großer Export mit Fortschritt; mehrere Dokumente nacheinander, jede Quelle einmal geladen.

## 9. Export und Hinweise

- **Einzelnes Dokument**, **Auswahl als neue PDF**, **alle Dokumente als ZIP**.
- Dateiname: Dokumentname + `.pdf`; ZIP `pdf-werkstatt.zip` (Frage 11).
- Wie in den Einzelwerkzeugen gehen beim Neuzusammensetzen Formularfelder, Lesezeichen und Signaturen verloren (docs/pdf-lib.md). Die Werkstatt erkennt sie beim Laden und zeigt vor dem Export einen Hinweis an der betroffenen Datei, mit denselben Texten wie in „PDF-Seiten bearbeiten“ und „PDFs zusammenfügen“. Ist ein Dokument unverändert eine einzige Quelle, wird die Originaldatei ausgegeben (Frage 12).
- Verschlüsselte PDFs werden beim Laden abgelehnt, mit derselben Meldung wie heute.
- Vor dem Verlassen der Seite mit Änderungen seit dem letzten Export: Browser-Warnung (`beforeunload`).

## 10. Stufen, Schritte, Aufwand, Tests, Anhaltepunkte

### Stufe 1: Kern (insgesamt L)

| Schritt | Inhalt | Aufwand | Tests |
|---|---|---|---|
| 1.1 | `core/workshop` (Modell, Befehle, Verlauf, Auswahl) | M | Unit-Tests je Befehl; Eigenschaften: Rückgängig nach Befehl ergibt den alten Zustand, Wiederholen den neuen; Schlüssel bleiben eindeutig; keine Seite geht beim Verschieben verloren oder doppelt |
| 1.2 | `core/pdf/assemble.ts`, `organize.ts` darauf umstellen | S | mehrere Quellen, Drehung, Leer- und Bildseiten, ZIP; Text jeder Seite mit pdf.js zurücklesen; bestehende Tests von „PDF-Seiten bearbeiten“ bleiben grün |
| — | **Anhaltepunkt A**: Modell und Export vorlegen | | |
| 1.3 | Seite, Register, Worker, Laden, Spalten, Vorschaubilder (LazyRenderer erweitert) | M | Browser: 5 PDFs mit je 100 Seiten; Messungen siehe unten |
| 1.4 | Auswahl, Tastatur, Kontextmenü, Ansagen | M | Browser: nur Tastatur; Ansagen in der Live-Region prüfen |
| 1.5 | Ziehen (Maus, Touch), Einfügemarke, Mitscrollen | M | Browser: Ziehen innerhalb und zwischen Spalten, Mehrfachziehen, Abbruch |
| 1.6 | Große Vorschau, Leerseite, Bilder einfügen, Teilen, Zusammenführen, Export | M | Export gegen `assemble`-Tests; Hinweise bei Formular/Lesezeichen/Signatur |
| 1.7 | Handy-Ansicht | M | Browser 390 px; echtes Gerät (docs/livegang.md) |
| 1.8 | Integration: `tool-switch`, Startseite, Knöpfe in den Einzelwerkzeugen, `/werkzeuge/`, Texte | M | Übergabe ohne Neuladen; Zurück-Taste; chunk-guard; keine Anfragen |
| — | **Anhaltepunkt B**: Stufe 1 vorlegen, Texte zur Freigabe | | |

**Leistungstests** (Skript wie `scripts/screenshots.mjs`, Chrome über das DevTools-Protokoll, nicht Teil von `check`): 500 Seiten aus fünf erzeugten PDFs; gemessen werden Zeit bis zu den ersten sichtbaren Vorschaubildern (Ziel unter 1 s), lange Aufgaben im Hauptthread beim Scrollen und Ziehen (Ziel: keine über 100 ms), Zeit für „100 Seiten verschieben“ (unter 50 ms bis zur Anzeige), Speicher nach Scrollen durch alle Seiten (Canvas-Anzahl bleibt unter der Obergrenze), Exportzeit für 500 Seiten. Unit-Test für Befehle mit 5.000 Seiten (Laufzeit).

### Stufe 2: Einzelwerkzeuge einbetten (insgesamt L)

| Schritt | Inhalt | Aufwand |
|---|---|---|
| 2.1 | `ToolHost`-Schnittstelle, Seitenzahlen als Dokument-Operation | M |
| 2.2 | Stempel und Unterschrift als Seiten-Operationen | M |
| 2.3 | Schwärzen und Formular als „Einbacken“ | M |
| 2.4 | Metadaten als Export-Einstellung, Hinweise | S |
| — | **Anhaltepunkt C** nach jedem Werkzeug (Browser-Prüfung vor jedem Commit wie immer) | |

Tests: Die bestehenden Tests der Werkzeuge bleiben; neu Tests für Operationen im Export (Seitenzahlen nach Umsortieren, Stempel auf gedrehten Seiten, Schwärzen ohne Rest des Originals auch nach „Einbacken“ und Rückgängig/Wiederholen).

### Stufe 3: später, nur Skizze

- **PDF verkleinern:** Bilder in PDFs neu kodieren (pdf-lib kann Bildströme lesen und ersetzen; Aufwand L, Qualität prüfen). Keine neue Bibliothek vorgesehen.
- **Texterkennung:** tesseract.js (bereits in AGENTS.md für Pro freigegeben), Sprachdaten lokal ausgeliefert; Textebene unsichtbar über die Seite legen. Aufwand L, CSP (`wasm-unsafe-eval`) nötig, getrennt zu entscheiden.
- **Projekt als lokale Datei speichern und öffnen:** eine Datei (z. B. `.lokalwerk`, ZIP mit Quellen und Zustand als JSON) über Speichern/Öffnen, kein Browser-Speicher. Aufwand M.

## 11. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Speicher: Quellen liegen doppelt (pdf.js-Worker, Export-Worker); große Dateien und viele Vorschaubilder | Bytes nicht im Hauptthread; Vorschaubilder begrenzen und freigeben; Summe anzeigen; Fehler verständlich melden |
| iOS Safari: harte Grenze für Canvas-Speicher, Seiten werden ohne Meldung neu geladen | Freigeben erzwingen, kleine Vorschaubilder, Handy-Ansicht mit einem Dokument zur Zeit |
| Safari allgemein: OffscreenCanvas im Worker erst ab 16.4, Unterschiede bei Pointer-Events | Rendern im Hauptthread wie heute; Tests auf echten Geräten |
| Große Dateien (mehrere hundert MB): Export braucht Quelle plus Ergebnis im Speicher | Export Dokument für Dokument; Hinweis vorab bei sehr großer Summe |
| Rückgängig bei großen Operationen (Stufe 2 „Einbacken“ erzeugt neue Quellen) | Verlaufsgrenze; Quellen freigeben, sobald kein Zustand mehr auf sie verweist; Hinweis, wenn Rückgängig wegen der Grenze nicht mehr möglich ist |
| Ziehen kollidiert mit Scrollen (Touch) | Halten vor dem Ziehen; Handy-Ansicht ohne Ziehen zwischen Dokumenten |
| Tastenkürzel kollidieren mit Browser und Screenreader | nur bei Fokus in den Spalten; keine Kürzel ohne Alternative im Menü; Liste zur Freigabe (Frage 5) |
| Umfang: die Werkstatt wird das größte Werkzeug | Stufen mit Anhaltepunkten; Einzelwerkzeuge bleiben unverändert nutzbar |

## 12. Auswirkungen

- **CSP (`public/_headers`):** keine Änderung in Stufe 1 und 2 (`connect-src 'none'`, Worker `'self'`, Bilder `blob:` sind schon erlaubt). Stufe 3 Texterkennung bräuchte `'wasm-unsafe-eval'` (eigene Entscheidung).
- **check-dist:** keine neuen Adressen, solange keine neue Bibliothek kommt; die Listen für pdf-lib und pdf.js gelten automatisch für die Werkstatt-Dateien (E14).
- **chunk-guard:** Die Werkstatt-Seite lädt statisch nur ihre `page.ts`; pdf.js dynamisch, pdf-lib nur im Worker. Startseite und Einzelwerkzeuge laden die Werkstatt dynamisch. Ein zusätzlicher Test stellt sicher, dass kein Einzelwerkzeug die Werkstatt statisch einbindet.
- **Lizenzseite:** `USED_IN` um `pdf-werkstatt` für pdf-lib und pdfjs-dist; der Build prüft es.
- **Datenschutzerklärung:** Stufe 1 und 2 verarbeiten wie alle Werkzeuge nur im Browser; nach meiner Einschätzung keine inhaltliche Änderung. Stufe 3 „Projekt speichern“ legt eine Datei beim Nutzer ab, auch lokal; Hinweis an die Rechtsprüfung, ob das erwähnt werden soll.
- **AGB:** nicht betroffen, solange kostenlos.

## 13. Kostenlos oder Pro (zur Entscheidung)

| Stufe | Vorschlag | Begründung |
|---|---|---|
| 1 Kern | **kostenlos** | Die Einzelwerkzeuge (Zusammenfügen, Teilen, Seiten bearbeiten, Bilder zu PDF) sind kostenlos; die Werkstatt verbindet sie nur. AGENTS.md Abschnitt 10: Kostenloses wird nicht nachträglich hinter Pro versteckt. Gutes Aushängeschild für Suchmaschinen. |
| 2 Werkzeuge in der Werkstatt | **kostenlos** für die Anwendung auf ein Dokument; **Pro-Kandidat**: dieselbe Aktion auf mehrere Dokumente in einem Schritt (Stapel) | Die Werkzeuge selbst sind kostenlos; Pro spart Zeit bei wiederkehrender Arbeit (wie auf der Pro-Seite beschrieben). |
| 3 Verkleinern | kostenlos oder Pro, offen | hoher Nutzen, hoher Aufwand |
| 3 Texterkennung | **Pro** | in AGENTS.md bereits als Pro vorgesehen |
| 3 Projekt speichern | **Pro-Kandidat** | typische Funktion für regelmäßige Arbeit |

## 14. Offene Fragen

1. **Übergabe ohne Neuladen:** Einverstanden, dass Einzelwerkzeuge wie die Startseite per Seitenwechsel ohne Neuladen in die Werkstatt wechseln (Adresse ändert sich, Zurück-Taste lädt neu)? Eine Alternative ohne Browser-Speicher gibt es nicht, außer einem neuen Tab mit `postMessage` (fehleranfälliger, zwei Fenster).
2. **Kostenlos oder Pro** je Stufe (Abschnitt 13).
3. **Name und Adresse:** „PDF-Werkstatt“ unter `/pdf-werkstatt/`?
4. **Hervorhebung:** breite Karte als erstes PDF-Werkzeug auf `/werkzeuge/` und eine hervorgehobene Karte auf der Startseite; soll die Startseiten-Ablage bei PDFs die Werkstatt sofort öffnen statt der Auswahl?
5. **Tastenkürzel:** Liste in 6.2 freigeben? Insbesondere Strg/Cmd+Umschalt+D statt Strg+D und die interne Ablage für Strg+X/C/V (nicht die System-Zwischenablage).
6. **Speichergrenze:** fester Hinweis ab 1 GB Quellen, oder eine harte Obergrenze mit Ablehnung?
7. **Verlauf:** 100 Schritte als Grenze?
8. **„PDF-Seiten bearbeiten“ und „PDFs zusammenfügen“:** bleiben unverändert als eigene Seiten (Vorgabe); sollen sie mittelfristig intern die Werkstatt-Module nutzen (weniger doppelter Code), sichtbar aber gleich bleiben?
9. **Bilder beim Ablegen:** Sollen gemischte Ablagen (PDFs und Bilder) auf der Startseite direkt die Werkstatt anbieten? Heute lehnt die Startseite gemischte Dateiarten ab.
10. **Handy:** Umsortieren nur über „Nach vorne/Nach hinten“ und „Verschieben nach …“, oder zusätzlich Ziehen mit Griff?
11. **Dateinamen beim Export:** Dokumentname + `.pdf`, ZIP `pdf-werkstatt.zip`?
12. **Unverändertes Dokument:** Originaldatei ausgeben (Formulare, Lesezeichen, Signaturen bleiben erhalten), oder immer neu zusammensetzen (einheitlich, aber verlustreich)?
13. **Stufe 2 „Einbacken“:** einverstanden, dass Schwärzen und Formular das betroffene Dokument neu erzeugen und Rückgängig dafür mehr Speicher braucht?
14. **Leerseite:** Größe wie die Nachbarseite als Vorgabe, DIN A4 als Alternative; Querformat anbieten?
