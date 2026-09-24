import { describe, expect, it } from 'vitest';
import { outputName, savedPercent, targetSize } from '../../../src/core/images/resize.ts';

describe('targetSize', () => {
  it.each([
    [4000, 3000, 1920, 1920, 1440],
    [3000, 4000, 1920, 1920, 2560],
    [1000, 800, 1920, 1000, 800],
    [1920, 1080, 1920, 1920, 1080],
    [4000, 3000, 0, 4000, 3000],
    [5000, 1, 800, 800, 1],
    [3001, 2001, 800, 800, 533],
  ])('%d×%d bei max. %d → %d×%d', (w, h, max, ew, eh) => {
    expect(targetSize(w, h, max)).toEqual({ width: ew, height: eh });
  });

  it.each([
    [0, 10],
    [10, 0],
    [Number.NaN, 10],
  ])('lehnt %d×%d ab', (w, h) => {
    expect(() => targetSize(w, h, 800)).toThrow(RangeError);
  });
});

describe('outputName', () => {
  it.each([
    ['IMG_1234.JPG', 'image/jpeg', 'IMG_1234-klein.jpg'],
    ['Urlaub 2026.HEIC', 'image/jpeg', 'Urlaub 2026-klein.jpg'],
    ['foto.png', 'image/webp', 'foto-klein.webp'],
    ['archiv.tar.jpg', 'image/jpeg', 'archiv.tar-klein.jpg'],
    ['ohne-endung', 'image/jpeg', 'ohne-endung-klein.jpg'],
    ['.jpg', 'image/jpeg', 'foto-klein.jpg'],
  ] as const)('%s → %s', (name, type, expected) => {
    expect(outputName(name, type)).toBe(expected);
  });
});

describe('savedPercent', () => {
  it.each([
    [1000, 280, 72],
    [1000, 1000, 0],
    [1000, 1200, -20],
    [0, 10, 0],
  ])('%d → %d B: %d %%', (input, output, expected) => {
    expect(savedPercent(input, output)).toBe(expected);
  });
});
