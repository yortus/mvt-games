import { describe, expect, it } from 'vitest';
import { checkLoop } from './check-loop';

describe('checkLoop', () => {
    it('takes a loop point within the order, or -1 for none', () => {
        expect(checkLoop(undefined, 3)).toBe(-1);
        expect(checkLoop(2, 3)).toBe(2);
        expect(() => checkLoop(3, 3)).toThrow('song: loop 3 is not an index into its order (0 to 2)');
        expect(() => checkLoop(0.5, 3)).toThrow(/not an index/);
    });
});
