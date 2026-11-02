/**
 * Web Worker für „Seitengröße ändern“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { resizePages, type ResizeOptions } from '../../core/pdf/resize.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

servePdfTool<ResizeOptions>(async (bytes, options) => [
  { name: '', bytes: await resizePages(bytes, options) },
]);
