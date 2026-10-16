import { describe, expect, it } from 'vitest';
import { useCached } from './bounded-cache';

describe('useCached', () => {
    it('makes a value once, and releases the one used least recently when it holds too many', () => {
        const cache = new Map<string, string>();
        const released: string[] = [];
        let made = 0;
        const use = (key: string): string => useCached(cache, { key, limit: 2, create: () => `${key}${++made}`, release: (value) => released.push(value) });
        expect(use('a')).toBe('a1');
        expect(use('b')).toBe('b2');
        expect(use('a')).toBe('a1');
        // 'b' was used least recently, so it goes
        expect(use('c')).toBe('c3');
        expect(released).toEqual(['b2']);
        expect([...cache.keys()]).toEqual(['a', 'c']);
    });
});
