import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fingerprintSources } from './rebundle.ts';

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
