import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createLayout } from './layout.ts';
import { escapeGlob, findVisualTestFiles } from './test-files.ts';

const dir = mkdtempSync(join(tmpdir(), 'visual-test-files-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const CANVAS = 'canvasTest(\'a\', () => view);';
const HTML = 'htmlTest(\'a\', () => element);';

/** Creates a project folder with these files in it, and returns its root. */
function createProject(name: string, files: Record<string, string>): string {
    const root = join(dir, name);
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    return root;
}

describe('escapeGlob', () => {
    it('escapes the characters that globs give a meaning to, and leaves a plain path alone', () => {
        expect(escapeGlob('src/hud/hud-view.visual.test.tsx')).toBe('src/hud/hud-view.visual.test.tsx');
        expect(escapeGlob('src/routes/[slug]/(auth)/view.visual.test.tsx')).toBe('src/routes/\\[slug\\]/\\(auth\\)/view.visual.test.tsx');
        expect(escapeGlob('a/{b}/c*?!+@.ts')).toBe('a/\\{b\\}/c\\*\\?\\!\\+\\@.ts');
    });
});

describe('findVisualTestFiles', () => {
    it('sorts the files that match the globs by the kind of test they declare', () => {
        const root = createProject('kinds', {
            'src/b.visual.tsx': CANVAS,
            'src/a.visual.ts': HTML,
            'src/c.test.ts': CANVAS,
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/**/*.visual.{ts,tsx}'] }));
        expect(files).toEqual({ canvas: ['src/b.visual.tsx'], html: ['src/a.visual.ts'] });
    });

    it('finds tests in visual-tests folders, by another glob', () => {
        const root = createProject('folders', {
            'src/hud/visual-tests/hud.test.ts': CANVAS,
            'src/hud/hud.test.ts': 'it(\'is a unit test\', () => {});',
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/**/visual-tests/*.test.ts'] }));
        expect(files).toEqual({ canvas: ['src/hud/visual-tests/hud.test.ts'], html: [] });
    });

    it('ignores a folder that matches the globs, and installed packages', () => {
        const root = createProject('folders-matched', {
            'src/a.visual.tsx': CANVAS,
            'src/__references__/a.visual.tsx/A.png': '',
            'node_modules/lib/x.visual.tsx': CANVAS,
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['**/*.visual.tsx'] }));
        expect(files).toEqual({ canvas: ['src/a.visual.tsx'], html: [] });
    });

    it('counts the modifiers .skip, .only and .todo as declarations', () => {
        const root = createProject('modifiers', {
            'src/a.visual.ts': "canvasTest.only('a', () => view);",
            'src/b.visual.ts': "htmlTest.skip('b', () => element);",
            'src/c.visual.ts': "canvasTest.todo('c');",
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/*.visual.ts'] }));
        expect(files).toEqual({ canvas: ['src/a.visual.ts', 'src/c.visual.ts'], html: ['src/b.visual.ts'] });
    });

    it('throws for a file that declares both kinds, or neither', () => {
        const both = createProject('both', { 'src/a.visual.ts': `${CANVAS}\n${HTML}` });
        expect(() => findVisualTestFiles(createLayout({ root: both, include: ['src/*.visual.ts'] }))).toThrow(/declares both/);
        const neither = createProject('neither', { 'src/a.visual.ts': 'export {};' });
        expect(() => findVisualTestFiles(createLayout({ root: neither, include: ['src/*.visual.ts'] }))).toThrow(/declares no canvasTest or htmlTest/);
    });
});
