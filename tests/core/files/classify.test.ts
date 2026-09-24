import { describe, expect, it } from 'vitest';
import { isImage, isPdf } from '../../../src/core/files/classify.ts';

describe('isPdf', () => {
  it.each([
    [{ name: 'a.pdf', type: 'application/pdf' }, true],
    [{ name: 'Rechnung.PDF', type: '' }, true],
    [{ name: 'ohne-endung', type: 'application/pdf' }, true],
    [{ name: 'bild.jpg', type: 'image/jpeg' }, false],
    [{ name: 'pdf.txt', type: 'text/plain' }, false],
  ])('%o → %s', (file, expected) => {
    expect(isPdf(file)).toBe(expected);
  });
});

describe('isImage', () => {
  it.each([
    [{ name: 'a.jpg', type: 'image/jpeg' }, true],
    [{ name: 'a.heic', type: 'image/heic' }, true],
    [{ name: 'a.pdf', type: 'application/pdf' }, false],
    [{ name: 'a.jpg', type: '' }, false],
  ])('%o → %s', (file, expected) => {
    expect(isImage(file)).toBe(expected);
  });
});
