import { describe, expect, it } from 'vitest';
import { parseOrder } from './parse-order';

describe('parseOrder', () => {
    it('reads an order of pattern names, a whole name before a transposition', () => {
        const names = ['verse', 'part-2'];
        expect(parseOrder(['verse', 'verse+5', 'verse-12', 'part-2'], names)).toEqual([
            { pattern: 0, transpose: 0 },
            { pattern: 0, transpose: 5 },
            { pattern: 0, transpose: -12 },
            { pattern: 1, transpose: 0 },
        ]);
        expect(() => parseOrder([], names)).toThrow('song: order is empty');
        expect(() => parseOrder(['chorus'], names)).toThrow("song: order names 'chorus', which is not a pattern");
    });
});
