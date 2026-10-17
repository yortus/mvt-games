import { describe, expect, it } from 'vitest';
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

    it('read a damaged link as nothing', async () => {
        expect(await decodeSharedProject('not-a-project')).toBeUndefined();
    });
});

describe('readHashRequest', () => {
    it('reads an example', () => {
        expect(readHashRequest(toExampleHash('clock'))).toEqual({ kind: 'example', id: 'clock' });
    });

    it('reads a shared project', () => {
        expect(readHashRequest(toSharedHash('abc'))).toEqual({ kind: 'shared', encoded: 'abc' });
    });

    it('reads anything else as nothing', () => {
        expect(readHashRequest('')).toEqual({ kind: 'none' });
        expect(readHashRequest('#preset=clock')).toEqual({ kind: 'none' });
        expect(readHashRequest('#whatever')).toEqual({ kind: 'none' });
    });
});
