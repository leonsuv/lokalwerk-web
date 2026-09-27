/**
 * Wechsel aus einem Einzelwerkzeug in die PDF-Werkstatt (workshop-link.ts). Eigenes Modul, damit
 * es nur beim Klick nachgeladen wird.
 */

import { toolById } from '../../build/pages.ts';
import { switchToTool, type ToolLoader } from './tool-switch.ts';

/** Nur die Werkstatt, nicht die Liste aller Werkzeuge der Startseite (src/tools/home/loaders.ts) */
const WORKSHOP: ToolLoader = {
  markup: async () => (await import('../tools/pdf-werkstatt/main.html?raw')).default,
  open: async () => (await import('../tools/pdf-werkstatt/page.ts')).openFiles,
};

export async function openInWorkshop(files: File[]): Promise<boolean> {
  const page = toolById('pdf-werkstatt');
  return page ? switchToTool(page, WORKSHOP, files) : false;
}
