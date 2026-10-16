import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fingerprintSources, isLeftOutByCommandLine } from './rebundle.ts';

const dir = mkdtempSync(join(tmpdir(), 'vsnap-rebundle-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('fingerprintSources', () => {
    it('stays the same for unchanged sources, and changes when one changes, or a new one appears', () => {
        mkdirSync(join(dir, 'src'), { recursive: true });
        writeFileSync(join(dir, 'src', 'view.ts'), "import { Container } from 'pixi.js';\n");
        const first = fingerprintSources(dir);
        expect(fingerprintSources(dir)).toBe(first);
        writeFileSync(join(dir, 'src', 'view.ts'), "import { Container } from 'pixi.js';\nimport { Filter } from 'pixi-filters';\n");
        const edited = fingerprintSources(dir);
        expect(edited).not.toBe(first);
        writeFileSync(join(dir, 'src', 'new-view.tsx'), 'export {};\n');
        expect(fingerprintSources(dir)).not.toBe(edited);
    });

    it('leaves out installed packages, hidden folders, coverage reports and files that are not sources', () => {
        writeFileSync(join(dir, 'notes.md'), 'no imports\n');
        const before = fingerprintSources(dir);
        mkdirSync(join(dir, 'node_modules', 'lib'), { recursive: true });
        writeFileSync(join(dir, 'node_modules', 'lib', 'index.js'), 'export {};\n');
        mkdirSync(join(dir, '.vitest'), { recursive: true });
        writeFileSync(join(dir, '.vitest', 'out.js'), 'export {};\n');
        mkdirSync(join(dir, 'coverage'), { recursive: true });
        writeFileSync(join(dir, 'coverage', 'prettify.js'), 'export {};\n');
        writeFileSync(join(dir, 'notes.md'), 'still no imports\n');
        utimesSync(join(dir, 'notes.md'), new Date(), new Date());
        expect(fingerprintSources(dir)).toBe(before);
    });
});

describe('isLeftOutByCommandLine', () => {
    const names = ['visual-canvas', 'visual-html'];
    const run = (...args: string[]): boolean => isLeftOutByCommandLine(names, ['node', 'vitest', 'run', ...args]);

    it('leaves the projects out only when every filter misses them', () => {
        expect(run('-p', 'unit')).toBe(true);
        expect(run('--project=unit', '--project', 'docs')).toBe(true);
        expect(run('-p', 'visual-*')).toBe(false);
        expect(run('-p', 'unit', '-p', 'VISUAL-HTML')).toBe(false);
    });

    it('runs them with no filter, or with a filter that only leaves other projects out', () => {
        expect(run()).toBe(false);
        expect(run('--project', '!unit')).toBe(false);
    });

    it('leaves them out when a negated filter matches them', () => {
        expect(run('-p', '!visual-*')).toBe(true);
    });

    it("runs them when a filter is cut short, since it can't tell", () => {
        expect(run('-p')).toBe(false);
        expect(run('-p', '--watch')).toBe(false);
    });
});
