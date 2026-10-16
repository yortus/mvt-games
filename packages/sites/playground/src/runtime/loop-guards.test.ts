import { describe, expect, it } from 'vitest';
import { addLoopGuards } from './loop-guards';

/** Guards a module's code, and returns the loops it guarded. */
function guard(code: string): { code: string; loops: string[] } {
    const loops: string[] = [];
    return { code: addLoopGuards({ code, path: 'a.ts', loops }), loops };
}

describe('addLoopGuards', () => {
    it('guards while, do, for-of and for-in loops, naming each loop\'s line', () => {
        const { loops } = guard('while (go()) {}\ndo {} while (go());\nfor (const x of xs) {}\nfor (const k in o) {}\n');
        expect(loops).toEqual(['a.ts:1', 'a.ts:2', 'a.ts:3', 'a.ts:4']);
    });

    it('keeps every line where it was', () => {
        const code = 'let n = 0;\nwhile (n < 10)\n    n = n + 1;\nthrow new Error("line 4");\n';
        const lines = guard(code).code.split('\n');
        expect(lines.length).toBe(code.split('\n').length);
        expect(lines[3]).toContain('line 4');
    });

    it('leaves out counted loops, whose bound is a name or a number', () => {
        const { loops } = guard([
            'for (let i = 0; i < n; i++) {}',
            'for (let i = 10; i >= 0; i -= 2) {}',
            'for (let i = 0, len = n; i < len; i++) {}',
            'for (let c = 0; c < SIGHT && isEmpty(c); c++) {}',
        ].join('\n'));
        expect(loops).toEqual([]);
    });

    it('guards a counted loop that may never end', () => {
        const { loops } = guard([
            // The body may grow the array it counts to
            'for (let i = 0; i < items.length; i++) items.push(i);',
            // The body moves the counter
            'for (let i = 0; i < n; i++) { i = 0; }',
            // The body moves the bound
            'for (let i = 0; i < n; i++) { n++; }',
            // The test compares something else
            'for (let i = 0; go(); i++) {}',
        ].join('\n'));
        expect(loops).toEqual(['a.ts:1', 'a.ts:2', 'a.ts:3', 'a.ts:4']);
    });

    it('stops a loop that runs too long, through the check it calls', () => {
        const { code } = guard('let turns = 0;\nwhile (true) { turns++; }\n');
        const check = (id: number): void => {
            throw new Error(`loop ${id} stopped`);
        };
        const run = new Function('globalThis', code.replace(/globalThis\.__pgLoopCheck/g, 'globalThis.check'));
        expect(() => run({ check })).toThrow('loop 0 stopped');
    });

    it('leaves code with no loops as it was', () => {
        expect(guard('export const a = 1;').code).toBe('export const a = 1;');
    });
});
