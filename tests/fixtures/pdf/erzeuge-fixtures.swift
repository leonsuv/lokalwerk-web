// Erzeugt die PDF-Testdateien mit CoreGraphics (macOS), damit die Fehlerfälle mit echten,
// von einem verbreiteten Programm verschlüsselten Dateien getestet werden.
// Aufruf im Projektordner: swift tests/fixtures/pdf/erzeuge-fixtures.swift

import CoreGraphics
import Foundation

func make(_ name: String, user: String? = nil, owner: String? = nil) {
  let url = URL(fileURLWithPath: "tests/fixtures/pdf/\(name)")
  var box = CGRect(x: 0, y: 0, width: 200, height: 300)
  var info: [CFString: Any] = [kCGPDFContextTitle: "Lokalwerk Testdatei"]
  if let user { info[kCGPDFContextUserPassword] = user }
  if let owner {
    info[kCGPDFContextOwnerPassword] = owner
    info[kCGPDFContextAllowsCopying] = false
    info[kCGPDFContextAllowsPrinting] = false
  }
  guard let ctx = CGContext(url as CFURL, mediaBox: &box, info as CFDictionary) else {
    fatalError("Konnte \(name) nicht anlegen")
  }
  for gray in [0.2, 0.6] {
    ctx.beginPDFPage(nil)
    ctx.setFillColor(gray: gray, alpha: 1)
    ctx.fill(CGRect(x: 20, y: 20, width: 160, height: 260))
    ctx.endPDFPage()
  }
  ctx.closePDF()
}

make("coregraphics-2-seiten.pdf")
make("passwort-zum-oeffnen.pdf", user: "lokalwerk", owner: "lokalwerk-besitzer")
make("nur-rechteschutz.pdf", owner: "lokalwerk-besitzer")
print("Fertig: 3 Testdateien in tests/fixtures/pdf/")
