// Erzeugt JPEG-Testbilder mit ImageIO (macOS): eines mit GPS-Position, Kameradaten und
// Aufnahmedatum, wie ein Handyfoto, und eines ohne diese Angaben.
// Aufruf im Projektordner: swift tests/fixtures/images/erzeuge-fixtures.swift

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func image(width: Int, height: Int) -> CGImage {
  let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpace(name: CGColorSpace.sRGB)!,
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(red: 0.1, green: 0.6, blue: 0.55, alpha: 1)
  ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
  ctx.setFillColor(red: 0.9, green: 0.3, blue: 0.3, alpha: 1)
  ctx.fill(CGRect(x: 0, y: 0, width: width / 2, height: height / 2))
  return ctx.makeImage()!
}

func write(_ name: String, properties: [CFString: Any]) {
  let url = URL(fileURLWithPath: "tests/fixtures/images/\(name)") as CFURL
  let dest = CGImageDestinationCreateWithURL(url, UTType.jpeg.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, image(width: 640, height: 480), properties as CFDictionary)
  guard CGImageDestinationFinalize(dest) else { fatalError("Konnte \(name) nicht schreiben") }
}

write("mit-gps-und-kamera.jpg", properties: [
  kCGImageDestinationLossyCompressionQuality: 0.9,
  kCGImagePropertyGPSDictionary: [
    kCGImagePropertyGPSLatitude: 52.5163, kCGImagePropertyGPSLatitudeRef: "N",
    kCGImagePropertyGPSLongitude: 13.3777, kCGImagePropertyGPSLongitudeRef: "E",
  ],
  kCGImagePropertyTIFFDictionary: [
    kCGImagePropertyTIFFMake: "Lokalwerk Testkamera", kCGImagePropertyTIFFModel: "Modell 1",
  ],
  kCGImagePropertyExifDictionary: [
    kCGImagePropertyExifDateTimeOriginal: "2026:09:24 12:00:00",
  ],
])
write("ohne-metadaten.jpg", properties: [kCGImageDestinationLossyCompressionQuality: 0.9])
print("Fertig: 2 Testbilder in tests/fixtures/images/")
