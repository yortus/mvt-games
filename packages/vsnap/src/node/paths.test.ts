import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toOutputBase } from './paths.ts';

const repo = resolve('/work/repo');
const out = join(repo, '.vitest', 'vsnap');

describe('toOutputBase', () => {
    it('mirrors the repository in the output folder, without .png', () => {
        expect(toOutputBase(join(repo, 'src', '__references__', 'a.visual.test.tsx', 'A.png'), { repo, out }))
            .toBe(join(out, 'src', '__references__', 'a.visual.test.tsx', 'A'));
    });

    it('puts a reference outside the repository under outside/, so it stays in the output folder', () => {
        const base = toOutputBase(resolve('/elsewhere/refs/A.png'), { repo, out });
        expect(base.startsWith(join(out, 'outside'))).toBe(true);
        expect(base.endsWith(join('elsewhere', 'refs', 'A'))).toBe(true);
    });
});
