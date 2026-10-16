import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { EXPORT_DEPENDENCIES, EXPORT_DEV_DEPENDENCIES } from '../../libraries';
import { EXAMPLES, findExample, STARTERS } from '../examples';
import type { ProjectFile } from '../runtime';
import { exportProject, type PackageVersion, zipExportedProject } from './export-project';

/** The repo's root, whose `node_modules` an exported project's imports resolve to here. */
const ROOT = resolve(import.meta.dirname, '../../../../..');

/** Each package's version and whether it is private, as installed in the repo. */
const PACKAGES = readPackages([...EXPORT_DEPENDENCIES, ...EXPORT_DEV_DEPENDENCIES]);
/** The same, with @mvtjs/audio on npm, as it will be. */
const PACKAGES_WITH_AUDIO = { ...PACKAGES, '@mvtjs/audio': { ...PACKAGES['@mvtjs/audio'], isPrivate: false } };

const PROJECT = {
    name: 'Bouncing Ball!',
    files: [
        { path: 'main.ts', text: `import { definePixiProject } from 'playground';\nexport const project = definePixiProject({ width: 1, height: 1, start: () => {} });\n` },
        { path: 'models/a/deep.ts', text: `import type { StartOptions } from "playground";\nexport type A = StartOptions;\n` },
    ],
};

function fileOf(files: readonly ProjectFile[], path: string): string {
    const file = files.find((f) => f.path === path);
    if (file === undefined) throw new Error(`No ${path} in the export`);
    return file.text;
}

describe('exporting a project', () => {
    it('depends on each published package at the version the playground runs, and on none that is private', () => {
        const { folder, files } = exportProject({ ...PROJECT, packages: PACKAGES });
        expect(folder).toBe('bouncing-ball');
        const json = JSON.parse(fileOf(files, 'package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
        for (const name of EXPORT_DEPENDENCIES) {
            expect(json.dependencies[name], name).toBe(PACKAGES[name].isPrivate ? undefined : `^${PACKAGES[name].version}`);
        }
        for (const name of EXPORT_DEV_DEPENDENCIES) expect(json.devDependencies[name], name).toBe(`^${PACKAGES[name].version}`);
    });

    it('puts the project under src/, its imports of playground made paths to src/playground.ts', () => {
        const { files } = exportProject({ ...PROJECT, packages: PACKAGES });
        expect(fileOf(files, 'src/main.ts')).toContain(`from './playground'`);
        expect(fileOf(files, 'src/models/a/deep.ts')).toContain(`from "../../playground"`);
    });

    it('runs the project with the sandbox\'s own runner, and only its renderer\'s host', () => {
        const { files } = exportProject({ ...PROJECT, packages: PACKAGES });
        const runner = files.filter((f) => f.path.startsWith('src/runner/')).map((f) => f.path).sort();
        expect(runner).toEqual(['src/runner/fit-to-window.ts', 'src/runner/pixi-host.ts', 'src/runner/renderer-host.ts', 'src/runner/run-project.ts']);
        expect(fileOf(files, 'src/runner/pixi-host.ts')).toContain(`from '../playground'`);
        expect(fileOf(files, 'src/index.ts')).toContain('createHost: createPixiHost');
    });

    it('has no sound while @mvtjs/audio is not on npm, and says so', () => {
        const { files } = exportProject({ ...PROJECT, packages: PACKAGES });
        expect(fileOf(files, 'src/playground.ts')).not.toContain(`from '@mvtjs/audio'`);
        expect(fileOf(files, 'src/index.ts')).not.toContain('createSound');
        expect(fileOf(files, 'README.md')).toContain('no sound');
    });

    it('has sound once @mvtjs/audio is on npm', () => {
        const { files } = exportProject({ ...PROJECT, packages: PACKAGES_WITH_AUDIO });
        expect(fileOf(files, 'src/playground.ts')).toContain(`from '@mvtjs/audio'`);
        expect(fileOf(files, 'src/index.ts')).toContain('createSound');
        expect(fileOf(files, 'README.md')).not.toContain('Not on npm yet');
    });

    it('puts the project\'s description in its README', () => {
        const { files } = exportProject({ ...PROJECT, description: 'A ball that bounces.', packages: PACKAGES });
        expect(fileOf(files, 'README.md')).toContain('A ball that bounces.');
    });

    it('zips each file into the project\'s folder', () => {
        const exported = exportProject({ ...PROJECT, packages: PACKAGES });
        const unzipped = unzipSync(zipExportedProject(exported));
        expect(Object.keys(unzipped).sort()).toEqual(exported.files.map((f) => `${exported.folder}/${f.path}`).sort());
        expect(strFromU8(unzipped['bouncing-ball/src/main.ts'])).toBe(fileOf(exported.files, 'src/main.ts'));
    });
});

describe('an exported project', { timeout: 60_000 }, () => {
    // Written inside the repo's node_modules, so its imports resolve to the packages installed here
    const OUT = join(ROOT, 'node_modules/.cache/playground-export-check');
    afterAll(() => rmSync(OUT, { recursive: true, force: true }));

    const cases = [
        ...STARTERS.map((s) => ({ label: `the ${s.name} starting project`, project: { name: s.name, files: s.files }, packages: PACKAGES })),
        { label: 'an example with JSX views', project: findExample('bouncing-ball-jsx')!, packages: PACKAGES },
        { label: 'a project with sound, once @mvtjs/audio is on npm', project: EXAMPLES[0], packages: PACKAGES_WITH_AUDIO },
    ];
    for (const { label, project, packages } of cases) {
        it(`type-checks as a project of its own: ${label}`, () => {
            const exported = exportProject({ name: project.name, files: project.files, packages });
            const dir = join(OUT, exported.folder + (packages === PACKAGES ? '' : '-with-sound'));
            for (const file of exported.files) {
                mkdirSync(dirname(join(dir, file.path)), { recursive: true });
                writeFileSync(join(dir, file.path), file.text);
            }
            expect(typeProblemsIn(dir)).toEqual([]);
        });
    }
});

/** Each package's version and whether it is private, from its package.json in the repo's node_modules. */
function readPackages(names: readonly string[]): Record<string, PackageVersion> {
    const packages: Record<string, PackageVersion> = {};
    for (const name of names) {
        const json = JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { version: string; private?: boolean };
        packages[name] = { version: json.version, isPrivate: json.private === true };
    }
    return packages;
}

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
