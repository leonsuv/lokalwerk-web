# Gesetzliche Feiertage: Wortlaut der Landesgesetze

Grundlage für den „Arbeitstage-Rechner“ (plan-phase2.md Werkzeug 29, Entscheidung E12). Abgerufen am 26.09.2026 aus den amtlichen Portalen der Länder, dem Bundesrecht und den Gesetzblättern. Die Texte wurden automatisch aus den Seiten gelesen und hier unverändert zitiert (Aufzählungszeichen und Nummern der Portale teils weggelassen). Keine Rechtsberatung.

## Was der Rechner daraus macht

- **Zeitraum:** 1. Januar 2018 bis 31. Dezember 2035. Für 2018 bis heute sind die Fassungen unten belegt; ab heute gilt der Stand vom 26.09.2026. Spätere Gesetzesänderungen kennt der Rechner nicht, die Seite nennt den Stand.
- **Gültigkeit:** Ein Feiertag zählt, wenn die Fassung, die ihn aufführt, an seinem Datum galt.
- **Landesweit** zählen die Feiertage aus der Liste des jeweiligen Landes, dazu der 3. Oktober nach Art. 2 Abs. 2 Einigungsvertrag (in Baden-Württemberg steht er nicht im Landesgesetz).
- **Regional** (nur als abwählbare Zusätze, Vorgabe E12): Mariä Himmelfahrt und Augsburger Friedensfest in Bayern, Fronleichnam in Teilen Sachsens und Thüringens. Welche Gemeinden das sind, legen Verordnungen und Bekanntmachungen fest; der Rechner kennt sie nicht.
- **Enthalten:** einmalige Feiertage, die in den Feiertagsgesetzen selbst stehen (Berlin: 8. Mai 2020, 8. Mai 2025, 17. Juni 2028).
- **Nicht enthalten:** einmalige Feiertage, die eine Landesregierung durch Verordnung bestimmen kann; solche Verordnungen wurden nicht recherchiert (z. B. § 2 Abs. 3 FTG M-V, § 2 Abs. 2 LFtG RP, § 2 Abs. 2 SFTG SH, § 2 Abs. 3 ThürFGtG, § 2 Abs. 1 Nr. 1 FeiertG HH), kirchliche oder religiöse Feiertage ohne Arbeitsruhe (z. B. Gründonnerstag und Buß- und Bettag in Baden-Württemberg), Gedenktage. Heiligabend und Silvester sind in keinem Land gesetzliche Feiertage.
- **Oster- und Pfingstsonntag** (Brandenburg) fallen immer auf einen Sonntag und ändern die Zählung nicht.

## Bund: Tag der Deutschen Einheit

Einigungsvertrag, Art. 2 Abs. 2 (https://www.gesetze-im-internet.de/einigvtr/art_2.html):

> (2) Der 3. Oktober ist als Tag der Deutschen Einheit gesetzlicher Feiertag.

## Osterdatum

Rechenvorschrift der Physikalisch-Technischen Bundesanstalt, „Wann ist Ostern?“ (https://www.ptb.de/cms/ptb/fachabteilungen/abt4/fb-44/ag-441/darstellung-der-gesetzlichen-zeit/wann-ist-ostern.html), Gaußsche Osterformel in der Form von H. Lichtenberg:

> (1)  K = INT (X/100);
> (2)  M = 15 + INT ((3K+3)/4) - INT ((8K+13)/25);
> (3)  S = 2 - INT ((3K+3)/4);
> (4)  A = MOD (X, 19);
> (5)  D = MOD (19A+M, 30);
> (6)  R = INT (D/29) + (INT (D/28) - INT (D/ 29)) · INT (A/11);
> (7)  OG = 21 + D - R;
> (8)  SZ = 7 - MOD (X+INT (X/4)+S, 7);
> (9)  OE = 7 - MOD (OG-SZ, 7);

> OS = OG + OE ist das Datum des Ostersonntags, als Datum im Monat März dargestellt. (Der 32. März entspricht also dem 1. April, usw.)
> Liegt der Ostertermin (OS) erst einmal fest, so berechnen sich daraus weitere besondere Kalenderdaten, und zwar
> OS - 46: Aschermittwoch,
> OS + 39: Christi Himmelfahrt,
> OS + 49: Pfingstsonntag,
> OS+ 60: Fronleichnam.

Die Ostertabelle der PTB für 1980 bis 2031 liegt als Testfall in `tests/fixtures/ptb-ostertermine-1980-2031.json`.

Bewegliche Feiertage: Karfreitag = Ostersonntag − 2 Tage, Ostermontag + 1, Christi Himmelfahrt + 39, Pfingstsonntag + 49, Pfingstmontag + 50, Fronleichnam + 60 (die PTB nennt + 39, + 49 und + 60; NRW beschreibt Fronleichnam als „Donnerstag nach dem Sonntag Trinitatis“, also eine Woche nach Pfingstsonntag plus vier Tage).

Buß- und Bettag (nur Sachsen): Baden-Württemberg beschreibt ihn als „Mittwoch vor dem letzten Sonntag des Kirchenjahres“, Rheinland-Pfalz als „Mittwoch vor dem letzten Trinitatissonntag“. Der letzte Sonntag des Kirchenjahres ist der Sonntag vor dem 1. Advent (so beim Totensonntag in § 3 Abs. 6 FeiertG BE: „letzter Sonntag vor dem 1. Advent“). Der 1. Advent ist der vierte Sonntag vor dem 25. Dezember; der Buß- und Bettag liegt damit immer zwischen dem 16. und 22. November.

## Baden-Württemberg

Gesetz über die Sonntage und Feiertage (Feiertagsgesetz - FTG) in der Fassung der Bekanntmachung vom 8. Mai 1995, https://www.landesrecht-bw.de/bsbw/document/jlr-FeiertGBWrahmen. § 1 gültig ab 01.04.1995 (unverändert).

> Gesetzliche Feiertage sind:
> Neujahr,
> Erscheinungsfest (6. Januar),
> Karfreitag,
> Ostermontag,
> 1. Mai,
> Christi Himmelfahrt,
> Pfingstmontag,
> Fronleichnam,
> Allerheiligen (1. November),
> Erster Weihnachtstag,
> Zweiter Weihnachtstag.

Nur kirchliche Feiertage, keine gesetzlichen (§ 2):

> Kirchliche Feiertage sind:
> Gründonnerstag,
> Reformationsfest (31. Oktober),
> Allgemeiner Buß- und Bettag (Mittwoch vor dem letzten Sonntag des Kirchenjahres).

## Bayern

Gesetz über den Schutz der Sonn- und Feiertage (Feiertagsgesetz – FTG), BayRS 1131-3-I, https://www.gesetze-bayern.de/Content/Document/BayFTG-1. Zuletzt geändert durch § 1 Abs. 10 der Verordnung vom 26. März 2019 (GVBl. S. 98); diese ändert nur Art. 3 Abs. 3 (https://www.verkuendung-bayern.de/gvbl/2019-98/), die Änderung davor stammt vom 12. April 2016. Art. 1 gilt damit im ganzen Zeitraum.

> (1) Gesetzliche Feiertage sind
> im ganzen Staatsgebiet
> Neujahr,
> Heilige Drei Könige (Epiphanias),
> Karfreitag,
> Ostermontag,
> der 1. Mai,
> Christi Himmelfahrt,
> Pfingstmontag,
> Fronleichnam,
> der 3. Oktober als Tag der Deutschen Einheit,
> Allerheiligen,
> Erster Weihnachtstag,
> Zweiter Weihnachtstag,
> in Gemeinden mit überwiegend katholischer Bevölkerung
> Mariä Himmelfahrt.
> (2) In der Stadt Augsburg ist außerdem der 8. August (Friedensfest) gesetzlicher Feiertag.
> (3) 1Das Landesamt für Statistik stellt nach dem Ergebnis der letzten Volkszählung fest, in welchen Gemeinden entweder mehr katholische oder mehr evangelische Einwohner ihren Wohnsitz hatten. 2Ist danach Mariä Himmelfahrt in einer Gemeinde gesetzlicher Feiertag, so macht die Gemeinde dies ortsüblich bekannt.

## Berlin

Gesetz über die Sonn- und Feiertage vom 28. Oktober 1954, https://gesetze.berlin.de/bsbe/document/jlr-FeiertGBErahmen (Gesamtausgaben-Liste). § 1 Abs. 1 in den Fassungen seit 2018:

Fassung vom 01.01.2018 bis 06.02.2019:

> (1) Allgemeine Feiertage sind außer den Sonntagen:
> der Neujahrstag
> der Karfreitag
> der Ostermontag
> der 1. Mai
> der Himmelfahrtstag
> der Pfingstmontag
> der Tag der deutschen Einheit
> der 1. Weihnachtstag
> der 2. Weihnachtstag.

Fassung vom 07.02.2019 bis 08.05.2020 (Gesetz vom 30.01.2019, GVBl. S. 22):

> (1) Allgemeine Feiertage sind außer den Sonntagen:
> der Neujahrstag
> der Frauentag (8. März)
> der Karfreitag
> der Ostermontag
> der 1. Mai
> der Himmelfahrtstag
> der Pfingstmontag
> der Tag der deutschen Einheit
> der 1. Weihnachtstag
> der 2. Weihnachtstag
> der 8. Mai 2020 (75. Jahrestag der Befreiung vom Nationalsozialismus und der Beendigung des Zweiten Weltkrieges in Europa).

Fassung vom 09.05.2020 bis 20.07.2024:

> (1) Allgemeine Feiertage sind außer den Sonntagen:
> der Neujahrstag
> der Frauentag (8. März)
> der Karfreitag
> der Ostermontag
> der 1. Mai
> der Himmelfahrtstag
> der Pfingstmontag
> der Tag der deutschen Einheit
> der 1. Weihnachtstag
> der 2. Weihnachtstag.

Fassung vom 21.07.2024 bis 08.05.2025 (Gesetz vom 10.07.2024, GVBl. S. 460):

> (1) Allgemeine Feiertage sind außer den Sonntagen:
> der Neujahrstag
> der Frauentag (8. März)
> der Karfreitag
> der Ostermontag
> der 1. Mai
> der Himmelfahrtstag
> der Pfingstmontag
> der Tag der deutschen Einheit
> der 1. Weihnachtstag
> der 2. Weihnachtstag
> der 8. Mai 2025 (80. Jahrestag der Befreiung vom Nationalsozialismus und der Beendigung des Zweiten Weltkriegs in Europa).
> der 17. Juni 2028 (75. Jahrestag des Aufstandes vom 17. Juni 1953).

Fassung vom 09.05.2025 bis 17.06.2028 (aktuell):

> (1) Allgemeine Feiertage sind außer den Sonntagen:
> der Neujahrstag
> der Frauentag (8. März)
> der Karfreitag
> der Ostermontag
> der 1. Mai
> der Himmelfahrtstag
> der Pfingstmontag
> der Tag der deutschen Einheit
> der 1. Weihnachtstag
> der 2. Weihnachtstag
> der 17. Juni 2028 (75. Jahrestag des Aufstandes vom 17. Juni 1953).
> (2) Die in Absatz 1 bezeichneten Tage sind allgemeine, gesetzliche und staatlich anerkannte Feiertage und Festtage auch im Sinne anderer gesetzlicher Bestimmungen.

Fassung ab 18.06.2028 (im Portal als künftige Fassung):

> (1) Allgemeine Feiertage sind außer den Sonntagen:
> der Neujahrstag
> der Frauentag (8. März)
> der Karfreitag
> der Ostermontag
> der 1. Mai
> der Himmelfahrtstag
> der Pfingstmontag
> der Tag der deutschen Einheit
> der 1. Weihnachtstag
> der 2. Weihnachtstag.

Folgerung: Frauentag ab 2019; einmalig 8. Mai 2020, 8. Mai 2025 und 17. Juni 2028.

## Brandenburg

Gesetz über die Sonn- und Feiertage (Feiertagsgesetz - FTG) vom 21. März 1991, zuletzt geändert durch Gesetz vom 30. April 2015, https://bravors.brandenburg.de/gesetze/ftg_2015.

> (1) Gesetzlich anerkannte Feiertage sind:
> der Neujahrstag (1. Januar),
> der Karfreitag,
> der Ostersonntag,
> der Ostermontag,
> der 1. Mai (Tag der Arbeit),
> der Christi Himmelfahrtstag,
> der Pfingstsonntag,
> der Pfingstmontag,
> der Tag der deutschen Einheit (3. Oktober),
> das Reformationsfest (31. Oktober),
> der 1. Weihnachtsfeiertag (25. Dezember),
> der 2. Weihnachtsfeiertag (26. Dezember).

## Bremen

Gesetz über die Sonn-, Gedenk- und Feiertage vom 12. November 1954, aktuelle Fassung ab 30.06.2025, https://www.transparenz.bremen.de/metainformationen/gesetz-ueber-die-sonn-gedenk-und-feiertage-vom-12-november-1954-296390:

> (1) Staatlich anerkannte Feiertage sind:
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Himmelfahrtstag,
> der Pfingstmontag,
> der 3. Oktober - Tag der deutschen Einheit -,
> der 1. Weihnachtstag,
> der 2. Weihnachtstag,
> der Reformationstag.

Fassung vom 28.07.2015 bis 20.11.2017 (https://www.transparenz.bremen.de/sixcms/detail.php?gsid=bremen2014_tp.c.87915.de&template=00_html_to_pdf_d), nur der einmalige Reformationstag 2017:

> (1) Staatlich anerkannte Feiertage sind:
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Himmelfahrtstag,
> der Pfingstmontag,
> der 3. Oktober - Tag der deutschen Einheit -,
> der 1. Weihnachtstag,
> der 2. Weihnachtstag,
> der 31. Oktober 2017 (500. Jahrestag der Reformation).

Änderung: Gesetz zur Änderung des Gesetzes über die Sonn- und Feiertage vom 26. Juni 2018, Brem.GBl. 2018 Nr. 63 S. 302, verkündet am 28. Juni 2018 (https://www.gesetzblatt.bremen.de/fastmedia/218/2018_06_28_GBl_Nr_0063_signed.pdf):

> Artikel 1
> Gesetz zur Änderung des Gesetzes über die Sonn- und Feiertage
> Das Gesetz über die Sonn- und Feiertage vom 12. November 1954 (Brem.GBl.
> S. 115), zuletzt geändert am 21. Mai 2013 (Brem.GBl. S. 231), wird wie folgt
> geändert:
> 1. § 2 Absatz 1j wird wie folgt neu gefasst: der Reformationstag.
> 2. § 14 Absatz 2 wird gestrichen.
> Artikel 2
> Inkrafttreten
> Das Gesetz tritt am Tag nach seiner Verkündung in Kraft.

Fassung vom 14.03.2020 bis 29.06.2025 (https://www.transparenz.bremen.de/sixcms/detail.php?gsid=bremen2014_tp.c.145882.de&template=00_html_to_pdf_d), Reformationstag weiter enthalten:

> (1) Staatlich anerkannte Feiertage sind:
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Himmelfahrtstag,
> der Pfingstmontag,
> der 3. Oktober - Tag der deutschen Einheit -,
> der 1. Weihnachtstag,
> der 2. Weihnachtstag,
> der Reformationstag.

Folgerung: Reformationstag ab 29.06.2018 (erstmals 31.10.2018). Die Fassung vom 29.06.2018 bis 13.03.2020 selbst ließ sich im Portal nicht aufrufen; sie ergibt sich aus der Änderung von 2018, und die folgende Fassung enthält den Reformationstag ebenfalls.

## Hamburg

Gesetz über Sonntage, Feiertage, Gedenktage und Trauertage (Feiertagsgesetz) vom 16. Oktober 1953, https://www.landesrecht-hamburg.de/bsha/document/jlr-FeiertGHArahmen. § 1 gültig ab 21.03.2018.

> Gesetzliche Feiertage sind:
> Neujahrstag,
> Karfreitag,
> Ostermontag,
> 1. Mai,
> Himmelfahrtstag,
> Pfingstmontag,
> Tag der Deutschen Einheit (3. Oktober),
> 31. Oktober,
> 1. Weihnachtstag,
> 2. Weihnachtstag.

Folgerung: 31. Oktober ab 2018.

## Hessen

Hessisches Feiertagsgesetz (HFeiertagsG) in der Fassung der Bekanntmachung vom 29. Dezember 1971, https://www.rv.hessenrecht.hessen.de/bshe/document/jlr-FeiertGHE1952pP1 (Textnachweis ab 01.01.2004, keine spätere Fassung).

> (1) Gesetzliche Feiertage sind die Sonntage sowie
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Himmelfahrtstag,
> der Pfingstmontag,
> der Fronleichnamstag,
> der Tag der Deutschen Einheit,
> der 1. und 2. Weihnachtstag.

## Mecklenburg-Vorpommern

Feiertagsgesetz Mecklenburg-Vorpommern (FTG M-V) in der Fassung der Bekanntmachung vom 8. März 2002, https://www.landesrecht-mv.de/bsmv/document/jlr-FTGMVrahmen. § 2 gültig ab 13.07.2022.

> (1) Gesetzliche Feiertage sind:
> der Neujahrstag (1. Januar),
> der Frauentag (8. März),
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Christi-Himmelfahrtstag,
> der Pfingstmontag,
> der Tag der Deutschen Einheit (3. Oktober),
> der Reformationstag (31. Oktober),
> der 1. Weihnachtstag (25. Dezember),
> der 2. Weihnachtstag (26. Dezember).

Änderung: Viertes Gesetz zur Änderung des Feiertagsgesetzes Mecklenburg-Vorpommern vom 7. Juli 2022, GVOBl. M-V 2022 Nr. 31 S. 427, ausgegeben am 12. Juli 2022 (https://www.regierung-mv.de/static/Regierungsportal/Justizministerium/Inhalte/Rechtliches/GVOBI.M-V/GVOBl.%20Nr.%2031%20v.%2012.7.2022.pdf), Artikel 1:

> 1. § 2 Absatz 1 wird wie folgt geändert:
> a) Nach Nummer 1 wird folgende Nummer 2 eingefügt:
> „2. der Frauentag (8. März),“.
> b) Die bisherigen Nummern 2 bis 10 werden die Nummern 3
> bis 11.

> Artikel 2
> Inkrafttreten
> Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.

Folgerung: Frauentag ab 13.07.2022, erstmals am 8. März 2023.

## Niedersachsen

Niedersächsisches Gesetz über die Feiertage (NFeiertagsG), § 2, Fassung ab 29.06.2018, https://voris.wolterskluwer-online.de/browse/document/f74bc6e7-6ded-3c2c-9afb-b34620456e56.

> (1) Staatlich anerkannte Feiertage sind:
> Neujahrstag,
> Karfreitag,
> Ostermontag,
> der 1. Mai,
> Himmelfahrtstag,
> Pfingstmontag,
> der 3. Oktober, als Tag der Deutschen Einheit,
> der 31. Oktober, als Reformationstag,
> 1. Weihnachtstag,
> 2. Weihnachtstag.

Folgerung: Reformationstag ab 29.06.2018.

## Nordrhein-Westfalen

Gesetz über die Sonn- und Feiertage (Feiertagsgesetz NW), Bekanntmachung der Neufassung vom 23. April 1989, aktuelle Fassung gültig ab 01.01.2000, https://recht.nrw.de/lrgv/gesetz/01012000-bekanntmachung-der-neufassung-des-gesetzes-ueber-die-sonn-und-feiertage/. § 2 Abs. 1 zuletzt geändert durch Gesetz vom 20.12.1994.

> (1) Feiertage sind:
> 1. der Neujahrstag,
> 2. der Karfreitag,
> 3. der Ostermontag,
> 4. der 1. Mai als Tag des Bekenntnisses zu Freiheit und Frieden, sozialer Gerechtigkeit, Völkerversöhnung und Menschenwürde,
> 5. der Christi-Himmelfahrts-Tag,
> 6. der Pfingstmontag,
> 7. der Fronleichnamstag (Donnerstag nach dem Sonntag Trinitatis),
> 8. der 3. Oktober als Tag der Deutschen Einheit,
> 9. der Allerheiligentag (1. November),
> 10. der 1. Weihnachtstag,
> 11. der 2. Weihnachtstag.

## Rheinland-Pfalz

Landesgesetz über den Schutz der Sonn- und Feiertage (Feiertagsgesetz - LFtG -) vom 15. Juli 1970, https://landesrecht.rlp.de/bsrp/document/jlr-FeiertGRPrahmen. § 2 gültig ab 01.10.2001.

> (1) Gesetzliche Feiertage sind
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Tag Christi Himmelfahrt,
> der Pfingstmontag,
> der Fronleichnamstag,
> der Tag der Deutschen Einheit (3. Oktober),
> der Allerheiligentag (1. November) und
> der 1. und 2. Weihnachtstag (25. und 26. Dezember).

## Saarland

Gesetz Nr. 1040 über die Sonn- und Feiertage (Feiertagsgesetz - SFG) vom 18. Februar 1976, https://recht.saarland.de/bssl/document/jlr-FeiertGSL1976rahmen. § 2 gültig ab 24.12.2010.

> (1) Gesetzliche Feiertage sind
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Tag Christi Himmelfahrt,
> der Pfingstmontag,
> der Fronleichnamstag,
> der Maria Himmelfahrtstag (15. August),
> der Tag der Deutschen Einheit (3. Oktober),
> der Allerheiligentag (1. November),
> der 1. Weihnachtstag (25. Dezember),
> der 2. Weihnachtstag (26. Dezember).

## Sachsen

Gesetz über Sonn- und Feiertage im Freistaat Sachsen vom 10. November 1992, https://www.revosax.sachsen.de/vorschrift/3997-SaechsSFG. § 1 Abs. 1 zuletzt geändert durch Artikel 4 des Gesetzes vom 6. Juni 2002.

> (1) Gesetzliche Feiertage sind:
> Neujahr (1. Januar),
> Karfreitag,
> Ostermontag,
> Tag der Arbeit (1. Mai),
> Christi Himmelfahrt,
> Pfingstmontag,
> Fronleichnam (nur in den vom Staatsministerium des Innern durch
> Rechtsverordnung bestimmten Regionen),
> Tag der Deutschen Einheit (3. Oktober),
> Reformationsfest (31. Oktober),
> Buß- und Bettag,
> 1. Weihnachtstag (25. Dezember),
> 2. Weihnachtstag (26. Dezember).

## Sachsen-Anhalt

Gesetz über die Sonn- und Feiertage (FeiertG LSA) in der Fassung der Bekanntmachung vom 25. August 2004, https://www.landesrecht.sachsen-anhalt.de/bsst/document/jlr-FeiertGSTrahmen. § 2 gültig ab 01.01.2004; die Änderung vom 4. Mai 2026 betrifft nur §§ 1, 2a und 5.

> Staatlich anerkannte Feiertage sind:
> der Neujahrstag,
> der Tag Heilige Drei Könige (6. Januar),
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Tag Christi Himmelfahrt,
> der Pfingstmontag,
> der Tag der Deutschen Einheit (3. Oktober),
> der Reformationstag (31. Oktober),
> (weggefallen)
> der 1. Weihnachtsfeiertag,
> der 2. Weihnachtsfeiertag.

## Schleswig-Holstein

Gesetz über Sonn- und Feiertage (SFTG) vom 28. Juni 2004, https://www.gesetze-rechtsprechung.sh.juris.de/bssh/document/jlr-FeiertGSH2004rahmen. § 2 gültig ab 30.03.2018.

> (1) Gesetzliche Feiertage sind
> Neujahrstag,
> Karfreitag,
> Ostermontag,
> 1. Mai,
> Himmelfahrtstag,
> Pfingstmontag,
> 3. Oktober - Tag der Deutschen Einheit -,
> 31. Oktober - Reformationstag -,
> 1. Weihnachtstag,
> 2. Weihnachtstag.

Folgerung: Reformationstag ab 2018.

## Thüringen

Thüringer Feier- und Gedenktagsgesetz (ThürFGtG) vom 21. Dezember 1994, https://landesrecht.thueringen.de/bsth/document/jlr-FeiertGTHrahmen. § 2 gültig ab 27.03.2019:

> (1) Gesetzliche Feiertage sind
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Tag Christi Himmelfahrt,
> der Pfingstmontag,
> der 20. September als Weltkindertag,
> der 3. Oktober als Tag der Deutschen Einheit,
> der Reformationstag,
> der erste Weihnachtsfeiertag,
> der zweite Weihnachtsfeiertag.
> (2) Das für das Feiertagsrecht zuständige Ministerium wird ermächtigt, durch Rechtsverordnung für Gemeinden mit überwiegend katholischer Wohnbevölkerung den Fronleichnamstag als gesetzlichen Feiertag festzulegen.

Fassung vom 27.05.2016 bis 26.03.2019:

> (1) Gesetzliche Feiertage sind
> der Neujahrstag,
> der Karfreitag,
> der Ostermontag,
> der 1. Mai,
> der Tag Christi Himmelfahrt,
> der Pfingstmontag,
> der 3. Oktober als Tag der Deutschen Einheit,
> der Reformationstag,
> der erste Weihnachtsfeiertag,
> der zweite Weihnachtsfeiertag.

Folgerung: Weltkindertag ab 27.03.2019, erstmals am 20. September 2019.
