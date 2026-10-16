import { describe, expect, it } from 'vitest';
import { memoiseLast } from './memoise-last';

describe('memoiseLast', () => {
    it('runs the function on the first call', () => {
        const text = memoiseLast((n: number) => `#${n}`);
        expect(text(42)).toBe('#42');
    });

    it('runs it again only when the argument changes', () => {
        let runs = 0;
        const text = memoiseLast((n: number) => {
            runs++;
            return `#${n}`;
        });

        expect(text(1)).toBe('#1');
        expect(text(1)).toBe('#1');
        expect(runs).toBe(1);

        expect(text(2)).toBe('#2');
        expect(runs).toBe(2);
    });

    it('remembers only the last argument', () => {
        let runs = 0;
        const text = memoiseLast((n: number) => {
            runs++;
            return `#${n}`;
        });

        text(1);
        text(2);
        text(1);
        expect(runs).toBe(3);
    });

    it('returns the same result object while the argument is unchanged', () => {
        const wrap = memoiseLast((s: string) => ({ s }));
        expect(wrap('a')).toBe(wrap('a'));
    });

    it('treats undefined as an argument like any other', () => {
        let runs = 0;
        const count = memoiseLast((_arg: undefined) => ++runs);
        expect(count(undefined)).toBe(1);
        expect(count(undefined)).toBe(1);
    });
});
