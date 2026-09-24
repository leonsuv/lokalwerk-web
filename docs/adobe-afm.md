# Adobe Core 14 AFM: Lizenz der Schriftmetriken in pdf-lib

Stand: 24.09.2026. Betrifft `@pdf-lib/standard-fonts` 1.0.0 (Abhängigkeit von pdf-lib 1.17.1), ausgeliefert im PDF-Worker.

## Worum es geht

`@pdf-lib/standard-fonts` enthält die Metriken der 14 PDF-Standardschriften (Courier, Helvetica, Times je in vier Schnitten, Symbol, ZapfDingbats). Sie stammen aus Adobes „Core 14 AFM“-Dateien. In den ausgelieferten Daten steht je Schrift ein Adobe-Hinweis („Copyright (c) … Adobe Systems Incorporated. All Rights Reserved.“). Die zugehörige Erklärung von Adobe liegt dem npm-Paket nicht bei.

## Lizenz: Adobe Postscript AFM License (SPDX: APAFML)

Wortlaut in `build/third-party/APAFML.txt`, übernommen aus der SPDX-Lizenzliste und auf `/lizenzen/` beim Eintrag von `@pdf-lib/standard-fonts` wiedergegeben.

| Quelle | Adresse | Ergebnis |
|---|---|---|
| SPDX-Lizenzliste, Kennung APAFML (Textquelle) | https://spdx.org/licenses/APAFML.html (Rohdaten: https://spdx.org/licenses/APAFML.json) | Urheberzeile und Absatz übernommen |
| Fedora Licensing Wiki | https://fedoraproject.org/wiki/Licensing/AdobePostscriptAFM | als weitere Quelle von SPDX genannt |
| Originaldatei `MustRead.html` im Repository von @pdf-lib/standard-fonts | https://github.com/Hopding/standard-fonts/blob/2bd6bc65d2ee2fe15097259cc89cb71549abaebc/font_metrics/MustRead.html (Commit vom 24.12.2018, SHA-256 der Datei `b226bfc00e1b8b8a80c7b3cfbbc322d13b4b0401f94cdeafdd93b2210ad802eb`) | Absatz wortgleich (ohne die weiß-auf-weiß-Zeichen „or“ und „Col“ im HTML) |
| SPEC, Abschrift von `MustRead.html` aus Adobes `Core14_AFMs.tar` | https://www.spec.org/cpu2017/Docs/licenses/Adobe-Core14-AFM.txt | Absatz wortgleich |

Abgleich am 24.09.2026 automatisiert (Leerzeichen normalisiert): Der Lizenzabsatz ist in allen drei Quellen identisch.

**Urheberzeile:** Die Zeile „Copyright (c) 1985, 1987, 1989, 1990, 1991, 1992, 1993, 1997 Adobe Systems Incorporated. All Rights Reserved.“ stammt aus SPDX; in `MustRead.html` selbst steht keine Urheberzeile. Sie fasst die Hinweise der einzelnen AFM-Dateien zusammen. Auffällig: Das Jahr 1988 aus dem ZapfDingbats-Hinweis fehlt darin. Die einzelnen Hinweise aller 14 Schriften stehen zusätzlich wörtlich auf `/lizenzen/` (aus den ausgelieferten Daten gelesen).

SHA-256 von `build/third-party/APAFML.txt`: `708c77776f111da3d7aa6228b78d95e45fb1af359f6144b8655837abb8fc7993`.

## Bedingungen der APAFML und wie wir sie erfüllen

| Bedingung | Umsetzung |
|---|---|
| Urheberhinweise bleiben erhalten | In den ausgelieferten Daten enthalten (Feld `Notice`) und auf `/lizenzen/` wiedergegeben. |
| AFM-Dateien nicht ohne diese Erklärung weitergeben | Erklärung wörtlich auf `/lizenzen/`. |
| Änderungen an den AFM-Dateien deutlich vermerken | Vermerk auf `/lizenzen/` (siehe Prüfung unten). pdf-lib selbst vermerkt die Umwandlung nur in der README des Pakets („The font metrics included in the original project were uncompressed“), nicht in den Daten. |
| Absatz nicht verändern | Wörtlich übernommen, Test in `tests/build/licenses.test.ts`. |
| „without charge“ | Siehe plan.md Abschnitt 9: zur rechtlichen Prüfung. |

## Prüfung: Wurden die Metriken verändert?

Alle 14 Original-AFM-Dateien aus dem Repository (Commit oben) wurden am 24.09.2026 Wert für Wert mit den Daten im installierten Paket verglichen (`Font.load()`):

- **Unverändert:** alle 4.172 Zeichenbreiten (`WX`) samt Zeichennamen und Reihenfolge, alle 19.046 Unterschneidungspaare (`KPX`), alle Kopfangaben (u. a. `FontName`, `FontBBox`, `Version`, `Notice`, `CapHeight`, `Ascender`) außer der folgenden.
- **Verändert:** `IsFixedPitch` ist im Paket bei allen 14 Schriften `true`; im Original nur bei den vier Courier-Schnitten. Vermutlich wurde der Text „false“ bei der Umwandlung als wahr gelesen. pdf-lib verwendet diese Angabe nicht (keine Fundstelle in `node_modules/pdf-lib/es/`).
- **Nicht übernommen:** Zeichencodes (`C`), Begrenzungsrahmen der Zeichen (`B`), Ligaturangaben (`L`) und die Kommentarzeilen (56 in den Originalen; übrig ist nur die jeweils letzte, z. B. „VMusage …“).
- **Format:** komprimiert (so beschrieben in der README von @pdf-lib/standard-fonts).

Der Vermerk auf `/lizenzen/` gibt diese Befunde wieder (`build/licenses.ts`, `REQUIRED_DATA_LICENSES`).

## Build-Prüfung

Wird `@pdf-lib/standard-fonts` ausgeliefert, verlangt der Build den APAFML-Eintrag auf `/lizenzen/` (`build/shipped-packages.ts`); fehlt er, bricht der Build ab.
