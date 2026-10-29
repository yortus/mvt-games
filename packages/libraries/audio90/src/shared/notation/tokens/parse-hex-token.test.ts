import { describe, expect, it } from 'vitest';
import { parseHexToken } from './parse-hex-token';

describe('parseHexToken', () => {
    it('reads a hex token only when its prefix and length match', () => {
        expect(parseHexToken('a37', 'a', 2)).toBe(0x37);
        expect(parseHexToken('a3', 'a', 2)).toBeUndefined();
        expect(parseHexToken('aZZ', 'a', 2)).toBeUndefined();
        expect(parseHexToken('v9', 'a', 1)).toBeUndefined();
    });
});
