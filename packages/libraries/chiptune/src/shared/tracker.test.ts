import { describe, expect, it } from 'vitest';
import { checkLoop, checkTempo, parseHexToken, parseOrder, splitCells, splitRows, splitTokens } from './tracker';

describe('the tracker grammar', () => {
    it('splits rows, dropping comments and blank lines but keeping a sharp note', () => {
        const rows = splitRows(`
            # lead   | bass
            | F#5 L  | C-3 B   # bar 1

            | ...    | ===
        `);
        expect(rows).toEqual(['| F#5 L  | C-3 B', '| ...    | ===']);
    });

    it('splits a row into the text of its cells, and needs a row to start with |', () => {
        expect(splitCells('| C-4 L | ... |', 'here')).toEqual([' C-4 L ', ' ... ', '']);
        expect(() => splitCells('C-4 | ...', 'song: pattern \'a\', row 2')).toThrow("song: pattern 'a', row 2: a row starts with |");
    });

    it('splits a cell into tokens, and an empty cell into none', () => {
        expect(splitTokens('  C-4  L v9 ')).toEqual(['C-4', 'L', 'v9']);
        expect(splitTokens('   ')).toEqual([]);
    });

    it('reads a hex token only when its prefix and length match', () => {
        expect(parseHexToken('a37', 'a', 2)).toBe(0x37);
        expect(parseHexToken('a3', 'a', 2)).toBeUndefined();
        expect(parseHexToken('aZZ', 'a', 2)).toBeUndefined();
        expect(parseHexToken('v9', 'a', 1)).toBeUndefined();
    });

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

    it('takes a loop point within the order, or -1 for none', () => {
        expect(checkLoop(undefined, 3)).toBe(-1);
        expect(checkLoop(2, 3)).toBe(2);
        expect(() => checkLoop(3, 3)).toThrow('song: loop 3 is not an index into its order (0 to 2)');
        expect(() => checkLoop(0.5, 3)).toThrow(/not an index/);
    });

    it('fills in a tempo\'s defaults, and refuses a tempo out of range', () => {
        expect(checkTempo({ bpm: 120 })).toEqual({ rowsPerBeat: 4, swing: 0 });
        expect(() => checkTempo({ bpm: 0 })).toThrow('song: bpm must be above 0; got 0');
        expect(() => checkTempo({ bpm: 120, swing: 0.6 })).toThrow(/swing/);
    });
});
