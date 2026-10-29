import { describe, expect, it } from 'vitest';
import { splitRows } from './split-rows';

describe('splitRows', () => {
    it('splits rows, dropping comments and blank lines but keeping a sharp note', () => {
        const rows = splitRows(`
            # lead   | bass
            | F#5 L  | C-3 B   # bar 1

            | ...    | ===
        `);
        expect(rows).toEqual(['| F#5 L  | C-3 B', '| ...    | ===']);
    });
});
