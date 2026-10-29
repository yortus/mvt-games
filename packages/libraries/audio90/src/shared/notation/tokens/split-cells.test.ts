import { describe, expect, it } from 'vitest';
import { splitCells } from './split-cells';

describe('splitCells', () => {
    it('splits a row into the text of its cells, and needs a row to start with |', () => {
        expect(splitCells('| C-4 L | ... |', 'here')).toEqual([' C-4 L ', ' ... ', '']);
        expect(() => splitCells('C-4 | ...', 'song: pattern \'a\', row 2')).toThrow("song: pattern 'a', row 2: a row starts with |");
    });
});
