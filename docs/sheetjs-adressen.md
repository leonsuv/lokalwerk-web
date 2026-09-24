# SheetJS: Adressen im gebauten SEPA-Worker

Stand: 24.09.2026, SheetJS CE 0.20.3 (`vendor/xlsx-0.20.3.tgz`). `scripts/check-dist.mjs` findet diese 51 Adressen in `dist/assets/sheet.worker-*.js`, sonst in keiner Datei. SheetJS enthält weder `fetch` noch `XMLHttpRequest`; keine dieser Adressen wird abgerufen, die Content-Security-Policy (`connect-src 'none'`) würde es zusätzlich verhindern.

Fundstelle: Zeile in `node_modules/xlsx/xlsx.mjs`.

Vorschlag: Alle Einträge gelten nur für `assets/sheet.worker-*.js`, nicht global (wie die pdf-lib-Ausnahme).

## Gruppe A1: XML-Namensräume (19)

Kennungen, mit denen Office- und XML-Dateien ihre Elemente benennen. SheetJS vergleicht beim Lesen einer .xlsx/.ods-Datei die Namensräume in der Datei mit diesen Texten.

| # | Adresse | Zeile |
|---|---|---|
| A1.1 | `http://purl.oclc.org/ooxml/spreadsheetml/main` | 4127 |
| A1.2 | `http://purl.org/dc/dcmitype/` | 4116 |
| A1.3 | `http://purl.org/dc/elements/1.1/` | 4114, 5839, 23692, 24083 |
| A1.4 | `http://purl.org/dc/terms/` | 4115 |
| A1.5 | `http://schemas.microsoft.com/office/excel/2006/2` | 4129 |
| A1.6 | `http://schemas.microsoft.com/office/excel/2006/main` | 4128 |
| A1.7 | `http://schemas.microsoft.com/office/mac/excel/2008/main` | 4117 |
| A1.8 | `http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments` | 4113 |
| A1.9 | `http://schemas.openxmlformats.org/drawingml/2006/main` | 12091 |
| A1.10 | `http://schemas.openxmlformats.org/officeDocument/2006/custom-properties` | 4109 |
| A1.11 | `http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes` | 4120 |
| A1.12 | `http://schemas.openxmlformats.org/officeDocument/2006/extended-properties` | 4110 |
| A1.13 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships` | 4118 |
| A1.14 | `http://schemas.openxmlformats.org/package/2006/content-types` | 4111 |
| A1.15 | `http://schemas.openxmlformats.org/package/2006/metadata/core-properties` | 4108 |
| A1.16 | `http://schemas.openxmlformats.org/package/2006/relationships` | 4112 |
| A1.17 | `http://schemas.openxmlformats.org/spreadsheetml/2006/main` | 4126, 12542 |
| A1.18 | `http://www.w3.org/2001/XMLSchema` | 4122, 24098 |
| A1.19 | `http://www.w3.org/2001/XMLSchema-instance` | 4121, 24099 |

## Gruppe A2: Beziehungstypen nach ECMA-376 / OPC (29)

Keine XML-Namensräume im engeren Sinn, aber ebenfalls reine Kennungen: In einer .xlsx-Datei verweisen Teile über `Type="…/relationships/worksheet"` usw. aufeinander. SheetJS erkennt daran, welcher Teil ein Tabellenblatt, Kommentar, Bild usw. ist.

| # | Adresse | Zeile |
|---|---|---|
| A2.1 | `http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet` | 5709 |
| A2.2 | `http://schemas.microsoft.com/office/2006/relationships/vbaProject` | 5719 |
| A2.3 | `http://schemas.microsoft.com/office/2006/relationships/xlExternalLinkPath/xlPathMissing` | 5693 |
| A2.4 | `http://schemas.microsoft.com/office/2006/relationships/xlMacrosheet` | 5712 |
| A2.5 | `http://schemas.microsoft.com/office/2014/relationships/chartEx` | 5705 |
| A2.6 | `http://schemas.microsoft.com/office/2017/10/relationships/person` | 5717 |
| A2.7 | `http://schemas.microsoft.com/office/2017/10/relationships/threadedComment` | 5716 |
| A2.8 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart` | 5704 |
| A2.9 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet` | 5706 |
| A2.10 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments` | 5697 |
| A2.11 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/connections` | 5718 |
| A2.12 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties` | 5700 |
| A2.13 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml` | 5695 |
| A2.14 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps` | 5696 |
| A2.15 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/dialogsheet` | 5711 |
| A2.16 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing` | 5714 |
| A2.17 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties` | 5699 |
| A2.18 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink` | 5694 |
| A2.19 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath` | 5692 |
| A2.20 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink` | 5690 |
| A2.21 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/image` | 5713 |
| A2.22 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument` | 5688 |
| A2.23 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings` | 5701 |
| A2.24 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata` | 5715 |
| A2.25 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles` | 5702 |
| A2.26 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme` | 5703 |
| A2.27 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing` | 5691 |
| A2.28 | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet` | 5708 |
| A2.29 | `http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties` | 5698 |

## Gruppe B: einzeln zu prüfen (3)

| # | Adresse | Zeile | Art und Verwendung |
|---|---|---|---|
| B1 | `http://schemas.openxmlformats.org/package/2006/sheetjs/core-properties` | 4119 | Eigener Namensraum von SheetJS unter der Domain des OOXML-Standards (Präfix `sjs`), nur beim Schreiben eigener Dokumenteigenschaften. Wird nicht abgerufen; wir schreiben keine Excel-Dateien. |
| B2 | `http://sheetjs.com` | 1, 316, 1432, 1452, 24183 | Lizenz- und Urheberhinweis von SheetJS in einem erhaltenen Kommentar (`/*! … */`), zweimal im Bundle. Wird nie ausgeführt. |
| B3 | `http://sheetjs.openxmlformats.org/officeDocument/2006/relationships/officeDocument` | 5689 | Eigener Beziehungstyp von SheetJS mit ausgedachter Domain, erkennt von SheetJS geschriebene Dateien. Wird nicht abgerufen. |
