# Programmangabe in erzeugten .xlsx-Dateien

Stand: 25.09.2026. Entscheidung: plan-phase2.md P1-2 (Variante a).

## Ausgangslage

SheetJS CE 0.20.3 schreibt in jede .xlsx-Datei `docProps/app.xml` mit `<Application>SheetJS</Application>`. Die Angabe ist fest im Code (`node_modules/xlsx/xlsx.mjs`, Zeile 6001, `write_ext_props`: `cp.Application = "SheetJS";`) und wird nach den Workbook-Eigenschaften gesetzt. Geprüft: Weder `wb.Props.Application` noch die Schreiboption `Props` überschreiben sie. Eine offizielle Option gibt es nicht. Der Bibliothekscode bleibt unverändert.

## Darf das Element fehlen?

Ja. Quelle: ECMA-376 Teil 1, 5. Ausgabe (Dezember 2016), Abschnitt 22.2 „Extended File Properties“ (gedruckte Seite 3725, PDF-Seite 3735):

> „Each extended property is represented as an element in the extended properties part. Extended properties elements are non-repeatable and can be empty or omitted. If all extended property elements are omitted then the extended properties part can be excluded from a document.“

Die Schemas bestätigen das: In `shared-documentPropertiesExtended.xsd` steht `<xsd:element name="Application" minOccurs="0" maxOccurs="1" type="xsd:string"/>`, sowohl in der Strict-Fassung (Teil 1) als auch in der Transitional-Fassung (Teil 4, Namensraum `http://schemas.openxmlformats.org/officeDocument/2006/extended-properties`, den SheetJS schreibt). Dateien: `.local-specs/ecma376/` (docs/lokale-spezifikationen.md).

## Umsetzung

`src/core/sheet/write.ts`, `removeApplicationName`: Die fertige Datei wird mit der CFB-Schnittstelle gelesen, die SheetJS selbst mitliefert (`import { CFB } from 'xlsx'`). In `docProps/app.xml` wird genau das Element `<Application>…</Application>` entfernt, danach wird die Datei mit derselben Schnittstelle neu gepackt.

Geprüft am 25.09.2026 (`zipinfo`, `diff` der entpackten Dateien): gleiche Einträge in gleicher Reihenfolge, gleiche Kompression (deflate) und gleiche Zeitstempel; inhaltlich geändert ist nur `docProps/app.xml`.

Tests (`tests/core/sheet/read-write.test.ts`, „Programmangabe“):
- Die erzeugte Datei enthält kein `<Application>` und nirgends „SheetJS“.
- Alle anderen Teile sind unverändert, `app.xml` unterscheidet sich nur um das Element.
- SheetJS liest die Datei mit denselben Werten wieder ein (Test „ergibt eine Datei, die sich mit denselben Werten wieder lesen lässt“).

Offen: Gegenprobe mit einem echten Tabellenprogramm. LibreOffice ist auf dem Entwicklungsrechner nicht installiert; Leon prüft in Excel oder Numbers.
