/**
 * Betriebsart von pdf.js, gemeinsam für Hauptthread und Worker (plan-phase2.md E4, Frage 4).
 *
 * - Mit WebAssembly: Die Dekoder für JPEG 2000 und JBIG2/CCITT kommen als WASM und brauchen
 *   `'wasm-unsafe-eval'` in der CSP der Seite.
 * - Ohne WebAssembly (heutige CSP): pdf.js nutzt seine JS-Ersatzdekoder (./fallbacks.ts).
 *
 * Bis Leon entschieden hat, wählt die Umgebungsvariable VITE_PDFJS_WASM=1 beim Build die
 * WASM-Variante (nur für die Testbuilds aus Schritt 0).
 */

export const PDFJS_WASM = import.meta.env.VITE_PDFJS_WASM === '1';
