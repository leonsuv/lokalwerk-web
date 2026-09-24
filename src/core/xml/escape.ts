/** Text für XML-Elementinhalte und Attributwerte maskieren (EPC217-08 Kap. 6.2 nennt die fünf Zeichen). */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}
