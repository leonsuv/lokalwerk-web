import { describe, expect, it } from 'vitest';
import { checkText } from '../../scripts/check-dist.mjs';

describe('checkText', () => {
  it('erlaubt die eigene Domain', () => {
    expect(checkText('<link rel="canonical" href="https://lokalwerk.eu/pro/">', 'html')).toEqual(
      [],
    );
    expect(checkText('a{background:url(https://lokalwerk.eu/x.png)}', 'css')).toEqual([]);
  });

  it('findet fremde Domains in HTML, CSS und JS', () => {
    expect(
      checkText('<link href="https://fonts.googleapis.com/css2?family=Onest">', 'html'),
    ).toHaveLength(1);
    expect(checkText('@import url(//cdn.example.com/a.css);', 'css')).toHaveLength(1);
    expect(checkText('import("https://cdnjs.cloudflare.com/x.js")', 'js')).toHaveLength(1);
    expect(checkText('new WebSocket("wss://example.com/s")', 'js')).toHaveLength(1);
  });

  it('lässt sich nicht mit ähnlichen Domains täuschen', () => {
    expect(checkText('"https://lokalwerk.eu.example.com/"', 'js')).toHaveLength(1);
    expect(checkText('"https://lokalwerk.eu@example.com/"', 'js')).toHaveLength(1);
  });

  it('findet Inline-Skripte, style-Blöcke und style-Attribute in HTML', () => {
    expect(checkText('<script>alert(1)</script>', 'html')).toHaveLength(1);
    expect(checkText('<script type="module" src="/assets/a.js"></script>', 'html')).toEqual([]);
    expect(checkText('<style>a{}</style>', 'html')).toHaveLength(1);
    expect(checkText('<div style="color:red">', 'html')).toHaveLength(1);
  });

  it('ignoriert Kommentare mit Leerzeichen nach //', () => {
    expect(checkText('const a = 1; // siehe plan.md', 'js')).toEqual([]);
  });
});
