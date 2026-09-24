import { describe, expect, it } from 'vitest';
import { formatBytes } from '../../../src/core/format/bytes.ts';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '2 KB'],
    [18 * 1024, '18 KB'],
    [1023 * 1024, '1023 KB'],
    [1024 * 1024 - 1, '1,0 MB'],
    [1024 * 1024, '1,0 MB'],
    [1.44 * 1024 * 1024, '1,4 MB'],
    [350 * 1024 * 1024, '350,0 MB'],
    [1024 ** 3 - 1, '1,0 GB'],
    [2.5 * 1024 ** 3, '2,5 GB'],
    [5000 * 1024 ** 3, '5000,0 GB'],
  ])('%d → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('lehnt %d ab', (bytes) => {
    expect(() => formatBytes(bytes)).toThrow(RangeError);
  });
});
