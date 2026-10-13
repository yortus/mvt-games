import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createLayout } from './layout.ts';
import { claimTestFiles, describeProblems, escapeGlob, findVisualTestFiles, forgetVsnapCalls } from './test-files.ts';

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
        expect(files).toEqual({ canvas: ['src/b.visual.tsx'], html: ['src/a.visual.ts'], problems: [] });
    });

    it('finds tests in visual-tests folders, by another glob', () => {
        const root = createProject('folders', {
            'src/hud/visual-tests/hud.test.ts': CANVAS,
            'src/hud/hud.test.ts': 'it(\'is a unit test\', () => {});',
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/**/visual-tests/*.test.ts'] }));
        expect(files).toEqual({ canvas: ['src/hud/visual-tests/hud.test.ts'], html: [], problems: [] });
    });

    it('by default, finds the test files in visual-tests folders, but not their helpers, nor tests elsewhere', () => {
        const root = createProject('defaults', {
            'src/hud/visual-tests/hud-view.test.tsx': CANVAS,
            'src/hud/visual-tests/poses.ts': CANVAS,
            'src/hud/hud-view.test.ts': CANVAS,
        });
        expect(findVisualTestFiles(createLayout({ root }))).toEqual({ canvas: ['src/hud/visual-tests/hud-view.test.tsx'], html: [], problems: [] });
    });

    it('leaves out a test file with the same stem as another in its folder, whose images would mix with its own', () => {
        const root = createProject('stems', {
            'src/visual-tests/hud.test.ts': CANVAS,
            'src/visual-tests/hud.test.tsx': CANVAS,
        });
        const files = findVisualTestFiles(createLayout({ root }));
        expect(files.canvas).toEqual(['src/visual-tests/hud.test.ts']);
        expect(files.problems).toEqual([{ file: 'src/visual-tests/hud.test.tsx', problem: expect.stringMatching(/same stem as src\/visual-tests\/hud\.test\.ts/) }]);
    });

    it('ignores a folder that matches the globs, and installed packages', () => {
        const root = createProject('folders-matched', {
            'src/a.visual.tsx': CANVAS,
            'src/__references__/a.visual.tsx/A.png': '',
            'node_modules/lib/x.visual.tsx': CANVAS,
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['**/*.visual.tsx'] }));
        expect(files).toEqual({ canvas: ['src/a.visual.tsx'], html: [], problems: [] });
    });

    it('leaves out the files that exclude matches', () => {
        const root = createProject('exclude', {
            'src/a.visual.ts': CANVAS,
            'src/fixtures/b.visual.ts': CANVAS,
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/**/*.visual.ts'], exclude: ['src/fixtures/**'] }));
        expect(files).toEqual({ canvas: ['src/a.visual.ts'], html: [], problems: [] });
    });

    it('counts the modifiers .skip, .only, .todo, .skipIf and .runIf as declarations, with .each and .for after them', () => {
        const root = createProject('modifiers', {
            'src/a.visual.ts': "canvasTest.only('a', () => view);",
            'src/b.visual.ts': "htmlTest.skip('b', () => element);",
            'src/c.visual.ts': "canvasTest.todo('c');",
            'src/d.visual.ts': "canvasTest.skipIf(isCi)('d', () => view);",
            'src/e.visual.ts': "htmlTest.runIf(hasFonts)('e', () => element);",
            'src/f.visual.ts': "canvasTest.skip.each([1, 2])('f %s', () => view);",
            'src/g.visual.ts': "htmlTest.only.for([1])('g', () => element);",
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/*.visual.ts'] }));
        expect(files).toEqual({
            canvas: ['src/a.visual.ts', 'src/c.visual.ts', 'src/d.visual.ts', 'src/f.visual.ts'],
            html: ['src/b.visual.ts', 'src/e.visual.ts', 'src/g.visual.ts'],
            problems: [],
        });
    });

    it('leaves out a file that declares both kinds, or neither, such as a new empty one, and says why', () => {
        const root = createProject('problems', {
            'src/both.visual.ts': `${CANVAS}\n${HTML}`,
            'src/empty.visual.ts': '',
            'src/fine.visual.ts': CANVAS,
        });
        const files = findVisualTestFiles(createLayout({ root, include: ['src/*.visual.ts'] }));
        expect(files.canvas).toEqual(['src/fine.visual.ts']);
        expect(files.html).toEqual([]);
        expect(files.problems.map((p) => p.file)).toEqual(['src/both.visual.ts', 'src/empty.visual.ts']);
        expect(files.problems[0].problem).toMatch(/declares both/);
        expect(files.problems[1].problem).toMatch(/declares no canvasTest or htmlTest/);
        expect(describeProblems(files.problems)).toMatch(/^2 files match .* left them out:\n {2}src\/both\.visual\.ts declares both/);
    });
});

describe('claimTestFiles', () => {
    const file = { key: '/work/src/visual-tests/hud.test.ts', file: '/work/src/visual-tests/hud.test.ts' };

    it('throws when two vsnap calls with different names claim one file', () => {
        forgetVsnapCalls();
        claimTestFiles('visual', [file]);
        claimTestFiles('visual', [file]);
        expect(() => claimTestFiles('ui', [file])).toThrow(/two vsnap calls, 'visual' and 'ui'/);
    });

    it('lets a call claim its files under a new name after Vitest restarts', () => {
        forgetVsnapCalls();
        claimTestFiles('visual', [file]);
        forgetVsnapCalls();
        expect(() => claimTestFiles('ui', [file])).not.toThrow();
        forgetVsnapCalls();
    });
});
