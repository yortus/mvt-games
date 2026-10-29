import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shortenPath, toOutputBase } from './paths.ts';

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

describe('shortenPath', () => {
    const path = 'src/entries/fruit-machine/views/three/visual-tests/bandit-view.test.tsx';

    it('leaves a path that fits as it is', () => {
        expect(shortenPath(path, path.length)).toBe(path);
    });

    it('drops folders from the middle, keeping the first and as much of the end as fits', () => {
        expect(shortenPath(path, 50)).toBe('src/…/three/visual-tests/bandit-view.test.tsx');
        expect(shortenPath(path, 40)).toBe('src/…/visual-tests/bandit-view.test.tsx');
    });

    it('keeps the file name, even if it alone is too long', () => {
        expect(shortenPath(path, 25)).toBe('…/bandit-view.test.tsx');
        expect(shortenPath(path, 5)).toBe('…/bandit-view.test.tsx');
    });
});
