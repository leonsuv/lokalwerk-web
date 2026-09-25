import { describe, expect, it } from 'vitest';
import {
  chunks,
  pageIndices,
  parsePageRanges,
  rangeLabel,
  singlePages,
} from '../../../src/core/pdf/page-ranges.ts';

const ok = (input: string, pages = 10) => {
  const result = parsePageRanges(input, pages);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.ranges.map((r) => [r.from, r.to]);
};

describe('parsePageRanges', () => {
  it.each([
    [
      '1-3, 5, 8-',
      [
        [1, 3],
        [5, 5],
        [8, 10],
      ],
    ],
    ['5', [[5, 5]]],
    ['-3', [[1, 3]]],
    [
      '2 - 4; 6',
      [
        [2, 4],
        [6, 6],
      ],
    ],
    ['3–5', [[3, 5]]],
    [
      '7, 1-2',
      [
        [7, 7],
        [1, 2],
      ],
    ],
    [
      '1,,2,',
      [
        [1, 1],
        [2, 2],
      ],
    ],
    ['1-1', [[1, 1]]],
    ['10-', [[10, 10]]],
  ])('„%s“ → %o', (input, ranges) => {
    expect(ok(input)).toEqual(ranges);
  });

  it.each([
    ['', { code: 'empty' }],
    [' , ', { code: 'empty' }],
    ['a', { code: 'syntax', part: 'a' }],
    ['1-2-3', { code: 'syntax', part: '1-2-3' }],
    ['-', { code: 'syntax', part: '-' }],
    ['1.5', { code: 'syntax', part: '1.5' }],
    ['0', { code: 'out-of-range', part: '0', pages: 10 }],
    ['11', { code: 'out-of-range', part: '11', pages: 10 }],
    ['9-12', { code: 'out-of-range', part: '9-12', pages: 10 }],
    ['5-3', { code: 'reversed', part: '5-3' }],
  ])('„%s“ → Fehler %o', (input, error) => {
    expect(parsePageRanges(input, 10)).toEqual({ ok: false, error });
  });
});

describe('Aufteilungen', () => {
  it('jede Seite einzeln', () => {
    expect(singlePages(3)).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 2 },
      { from: 3, to: 3 },
    ]);
  });

  it('in Teile mit gleich vielen Seiten, der letzte darf kürzer sein', () => {
    expect(chunks(7, 3)).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 6 },
      { from: 7, to: 7 },
    ]);
    expect(chunks(4, 10)).toEqual([{ from: 1, to: 4 }]);
    expect(chunks(2, 0)).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 2 },
    ]);
  });

  it('Seitennummern ab 0 und Beschriftung', () => {
    expect(pageIndices({ from: 3, to: 5 })).toEqual([2, 3, 4]);
    expect(rangeLabel({ from: 3, to: 5 })).toBe('3-5');
    expect(rangeLabel({ from: 4, to: 4 })).toBe('4');
  });
});
