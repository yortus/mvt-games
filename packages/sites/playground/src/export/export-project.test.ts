import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { EXPORT_DEPENDENCIES, EXPORT_DEV_DEPENDENCIES } from '../../libraries';
import type { ProjectFile } from '../runtime';
import { exportProject, zipExportedProject } from './export-project';
import { readPackages } from './read-packages.test-support';

/** Each package's version and whether it is private, as installed in the repo. */
const PACKAGES = readPackages([...EXPORT_DEPENDENCIES, ...EXPORT_DEV_DEPENDENCIES]);

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

    it('gives the project a sound chip from audio90, as the playground does', () => {
        const { files } = exportProject({ ...PROJECT, packages: PACKAGES });
        expect(fileOf(files, 'src/playground.ts')).toContain(`from 'audio90'`);
        expect(fileOf(files, 'src/index.ts')).toContain(`from 'audio90'`);
        expect(fileOf(files, 'src/index.ts')).toContain('createSound');
    });

    it('says in its README which packages are not on npm yet, and leaves them out', () => {
        const packages = { ...PACKAGES, '@mvtjs/three': { ...PACKAGES['@mvtjs/three'], isPrivate: true } };
        const { files } = exportProject({ ...PROJECT, packages });
        expect(fileOf(files, 'README.md')).toContain('## Not on npm yet');
        expect(fileOf(files, 'README.md')).toContain('`@mvtjs/three` is not on npm yet');
        expect(fileOf(files, 'package.json')).not.toContain('@mvtjs/three');
    });

    it('says nothing about npm in its README when every package is published', () => {
        const { files } = exportProject({ ...PROJECT, packages: PACKAGES });
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
