import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import { decodeSharedProject, encodeSharedProject } from './share-links';
import { readHashRequest, toExampleHash, toSharedHash } from './location-hash';

const PROJECT = {
    name: 'A project',
    files: [
        { path: 'main.ts', text: "import { definePixiProject } from 'playground';\n// Ünïcödé, and a </script>\n" },
        { path: 'models/a-model.ts', text: 'export const a = 1;\n'.repeat(50) },
    ],
};

describe('share links', () => {
    it('read back the project they were written from', async () => {
        const encoded = await encodeSharedProject(PROJECT);
        expect(encoded).toMatch(/^[\w-]+$/);
        expect(await decodeSharedProject(encoded)).toEqual({ ...PROJECT, isBarrelKept: true, description: '' });
    });

    it('say when the playground does not keep a project\'s barrels, and keep them otherwise', async () => {
        expect((await decodeSharedProject(await encodeSharedProject({ ...PROJECT, isBarrelKept: false })))?.isBarrelKept).toBe(false);
        expect((await decodeSharedProject(await encodeSharedProject(PROJECT)))?.isBarrelKept).toBe(true);
    });

    it('carry a project\'s description, and none where it has none', async () => {
        expect((await decodeSharedProject(await encodeSharedProject({ ...PROJECT, description: 'A ball' })))?.description).toBe('A ball');
        expect((await decodeSharedProject(await encodeSharedProject(PROJECT)))?.description).toBe('');
    });

    it('are smaller than the old playground\'s lz-string links', async () => {
        const json = JSON.stringify({ n: PROJECT.name, f: PROJECT.files.map((f) => [f.path, f.text]) });
        expect((await encodeSharedProject(PROJECT)).length).toBeLessThan(compressToEncodedURIComponent(json).length);
    });

    it('read a damaged link as nothing', async () => {
        expect(await decodeSharedProject('not-a-project')).toBeUndefined();
    });
});

describe('readHashRequest', () => {
    it('reads an example, and the old preset links the docs use', () => {
        expect(readHashRequest(toExampleHash('clock'))).toEqual({ kind: 'example', id: 'clock' });
        expect(readHashRequest('#preset=traffic-light-jsx')).toEqual({ kind: 'example', id: 'traffic-light-jsx' });
    });

    it('reads a shared project', () => {
        expect(readHashRequest(toSharedHash('abc'))).toEqual({ kind: 'shared', encoded: 'abc' });
    });

    it('reads the old playground\'s shared code', () => {
        const encoded = compressToEncodedURIComponent(JSON.stringify({ m: 'model', v: 'view', w: 200, h: 100 }));
        expect(readHashRequest(`#code=${encoded}`)).toEqual({
            kind: 'old-code',
            code: { modelCode: 'model', viewCode: 'view', canvasWidth: 200, canvasHeight: 100 },
        });
    });

    it('reads anything else as nothing', () => {
        expect(readHashRequest('')).toEqual({ kind: 'none' });
        expect(readHashRequest('#code=garbage')).toEqual({ kind: 'none' });
        expect(readHashRequest('#whatever')).toEqual({ kind: 'none' });
    });
});
