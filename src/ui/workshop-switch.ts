/**
 * Wechsel aus einem Einzelwerkzeug in die PDF-Werkstatt (workshop-link.ts). Eigenes Modul, damit
 * es nur beim Klick nachgeladen wird.
 */

import { toolById } from '../../build/pages.ts';
import type { PagePick } from '../core/workshop/model.ts';
import { switchToTool, type ToolLoader } from './tool-switch.ts';

/**
 * Nur die Werkstatt, nicht die Liste aller Werkzeuge der Startseite (src/tools/home/loaders.ts).
 * `layouts` gibt je Datei die Seitenfolge mit, in der die Werkstatt sie zeigt.
 */
function workshopLoader(layouts?: ReadonlyMap<File, readonly PagePick[]>): ToolLoader {
  return {
    markup: async () => (await import('../tools/pdf-werkstatt/main.html?raw')).default,
    open: async () => {
      const { openFiles } = await import('../tools/pdf-werkstatt/page.ts');
      return (files) => openFiles(files, layouts);
    },
  };
}

export async function openInWorkshop(
  files: File[],
  layouts?: ReadonlyMap<File, readonly PagePick[]>,
): Promise<boolean> {
  const page = toolById('pdf-werkstatt');
  return page ? switchToTool(page, workshopLoader(layouts), files) : false;
}
