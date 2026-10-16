import { describe, expect, it } from 'vitest';
import { assert } from './assert';

describe('assert', () => {
    it('does nothing when the condition holds', () => {
        expect(() => assert(true, 'unreachable')).not.toThrow();
        expect(() => assert(1, 'unreachable')).not.toThrow();
    });

    it('throws an Error with the message when the condition fails', () => {
        expect(() => assert(false, 'it failed')).toThrow(new Error('it failed'));
        expect(() => assert(0, 'zero')).toThrow('zero');
        expect(() => assert(undefined, 'missing')).toThrow('missing');
    });

    it('builds a function message only on failure', () => {
        let built = 0;
        const message = (): string => {
            built++;
            return 'built';
        };

        assert(true, message);
        expect(built).toBe(0);

        expect(() => assert(false, message)).toThrow('built');
        expect(built).toBe(1);
    });

    it('narrows the type of what it checks', () => {
        const value = ['a', undefined][0] as string | undefined;
        assert(value !== undefined, 'value is defined');
        const length: number = value.length; // A type error without the narrowing
        expect(length).toBe(1);
    });
});
