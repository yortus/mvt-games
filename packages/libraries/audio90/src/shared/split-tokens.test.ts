import { describe, expect, it } from 'vitest';
import { splitTokens } from './split-tokens';

describe('splitTokens', () => {
    it('splits a cell into tokens, and an empty cell into none', () => {
        expect(splitTokens('  C-4  L v9 ')).toEqual(['C-4', 'L', 'v9']);
        expect(splitTokens('   ')).toEqual([]);
    });
});
