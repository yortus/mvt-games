import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { EXPORT_DEPENDENCIES, EXPORT_DEV_DEPENDENCIES } from '../../libraries';
import { findExample, STARTERS } from '../examples';
import { exportProject } from './export-project';
import { readPackages, ROOT } from './read-packages.test-support';

// Each case type-checks a whole project with TypeScript, which takes seconds.

/** Each package's version and whether it is private, as installed in the repo. */
const PACKAGES = readPackages([...EXPORT_DEPENDENCIES, ...EXPORT_DEV_DEPENDENCIES]);

describe('an exported project', { timeout: 60_000 }, () => {
    // Written inside the repo's node_modules, so its imports resolve to the packages installed here
    const OUT = join(ROOT, 'node_modules/.cache/playground-export-check');
    afterAll(() => rmSync(OUT, { recursive: true, force: true }));

    const cases = [
        ...STARTERS.map((s) => ({ label: `the ${s.name} starting project`, project: { name: s.name, files: s.files }, packages: PACKAGES })),
        { label: 'an example with JSX views', project: findExample('bouncing-ball-jsx')!, packages: PACKAGES },
    ];
    for (const { label, project, packages } of cases) {
        it(`type-checks as a project of its own: ${label}`, () => {
            const exported = exportProject({ name: project.name, files: project.files, packages });
            const dir = join(OUT, exported.folder);
            for (const file of exported.files) {
                mkdirSync(dirname(join(dir, file.path)), { recursive: true });
                writeFileSync(join(dir, file.path), file.text);
            }
            expect(typeProblemsIn(dir)).toEqual([]);
        });
    }
});

/**
 * The type problems in a project on disk, by its own tsconfig.json. The
 * repo's libraries resolve to their sources, as they do everywhere in the
 * repo, so nothing needs building first.
 */
function typeProblemsIn(dir: string): string[] {
    const config = ts.readConfigFile(join(dir, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dir);
    const program = ts.createProgram(parsed.fileNames, { ...parsed.options, customConditions: ['@mvtjs/source'] });
    return ts.getPreEmitDiagnostics(program).map((d) => {
        const where = d.file === undefined ? '' : `${d.file.fileName.slice(dir.length + 1)}: `;
        return where + ts.flattenDiagnosticMessageText(d.messageText, ' ');
    });
}
