/**
 * Web Worker für „Kopf- und Fußzeile“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { addHeaderFooter } from '../../core/pdf/header-footer.ts';
import type { HeaderFooterOptions } from '../../core/pdf/header-footer-layout.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

servePdfTool<HeaderFooterOptions>(async (bytes, options) => [
  { name: '', bytes: await addHeaderFooter(bytes, options) },
]);
