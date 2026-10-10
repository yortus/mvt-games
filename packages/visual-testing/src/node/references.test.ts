import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { createLayout } from './layout';
import { encodePng, type RgbaImage } from './png';
import { checkReference, findOrphans, findReferenceCandidates, findReferences, removeReference } from './references';

const dir = mkdtempSync(join(tmpdir(), 'visual-references-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function createImage(seed: number): RgbaImage {
    const pixels = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * seed) & 0xff;
    return { width: 8, height: 8, pixels };
}

function write(name: string, bytes: Uint8Array): string {
    const file = join(dir, name);
    writeFileSync(file, bytes);
    return file;
}

function writePlainPng(file: string): void {
    writeFileSync(file, PNG.sync.write(new PNG({ width: 2, height: 2 })));
}

describe('findReferences', () => {
    it('finds the PNGs that carry a hash, in any folder, and no other PNGs', () => {
        const root = join(dir, 'tree');
        mkdirSync(join(root, 'views', 'visual-tests'), { recursive: true });
        writeFileSync(join(root, 'views', 'visual-tests', 'one.png'), encodePng(createImage(1)));
        writePlainPng(join(root, 'views', 'visual-tests', 'texture.png'));
        writePlainPng(join(root, 'views', 'not-a-reference.png'));
        const found = findReferences(root).map((r) => r.file);
        expect(found).toEqual([join(root, 'views', 'visual-tests', 'one.png')]);
    });

    it('skips a folder below the root that is a project of its own', () => {
        const root = join(dir, 'nested');
        mkdirSync(join(root, 'fixture'), { recursive: true });
        writeFileSync(join(root, 'own.png'), encodePng(createImage(1)));
        writeFileSync(join(root, 'fixture', 'vitest.visual.config.ts'), '');
        writeFileSync(join(root, 'fixture', 'theirs.png'), encodePng(createImage(2)));
        expect(findReferences(root).map((r) => r.file)).toEqual([join(root, 'own.png')]);
        expect(findReferences(join(root, 'fixture')).map((r) => r.file)).toEqual([join(root, 'fixture', 'theirs.png')]);
    });
});

describe('findReferenceCandidates', () => {
    it('finds the PNGs that the reference path matches, with or without a hash', () => {
        const root = join(dir, 'candidates');
        const folder = join(root, 'views', 'visual-tests');
        mkdirSync(folder, { recursive: true });
        writeFileSync(join(folder, 'A.ref.png'), encodePng(createImage(1)));
        writePlainPng(join(folder, 'B.ref.png'));
        writePlainPng(join(folder, 'texture.png'));
        const layout = createLayout({ root, referencePath: '{testFileDir}/{imageName}.ref.png' });
        const found = findReferenceCandidates(layout, join(folder, 'hud.test.ts')).sort();
        expect(found).toEqual([join(folder, 'A.ref.png'), join(folder, 'B.ref.png')]);
    });
});

describe('checkReference', () => {
    it('passes a file whose pixels match its hash', () => {
        expect(checkReference(write('good.png', encodePng(createImage(3))))).toBeUndefined();
    });

    it('fails a file whose pixels were changed without its hash', () => {
        // This file has the hash of one image and the pixels of another. It
        // is as if a paint program edited the pixels but kept the text chunk
        // that holds the hash.
        const original = encodePng(createImage(3));
        const edited = encodePng(createImage(5));
        const textEnd = 33 + 12 + new DataView(original.buffer, original.byteOffset).getUint32(33);
        const editedTextEnd = 33 + 12 + new DataView(edited.buffer, edited.byteOffset).getUint32(33);
        const forged = new Uint8Array([...original.subarray(0, textEnd), ...edited.subarray(editedTextEnd)]);
        expect(checkReference(write('forged.png', forged))).toMatch(/^its pixels hash to /);
    });

    it('fails a PNG that carries no hash', () => {
        const png = new PNG({ width: 2, height: 2 });
        expect(checkReference(write('plain.png', PNG.sync.write(png)))).toMatch(/carries no pixel hash/);
    });
});

describe('findOrphans', () => {
    it('returns the references that were not compared with, however their paths are written', () => {
        const references = join(tmpdir(), 'views', '__references__', 'a.visual.tsx');
        const kept = join(references, 'kept.png');
        const orphan = join(references, 'renamed.png');
        // Vitest writes paths with forward slashes.
        expect(findOrphans({ references: [kept, orphan], compared: [kept.replaceAll('\\', '/')] })).toEqual([orphan]);
    });
});

describe('removeReference', () => {
    it('deletes the file and the folders that it leaves empty, up to the root', () => {
        const root = join(dir, 'removal');
        const views = join(root, 'views');
        const one = join(views, '__references__', 'one.visual.tsx');
        const two = join(views, '__references__', 'two.visual.tsx');
        mkdirSync(one, { recursive: true });
        mkdirSync(two, { recursive: true });
        writeFileSync(join(one, 'a.png'), encodePng(createImage(1)));
        writeFileSync(join(one, 'b.png'), encodePng(createImage(2)));
        writeFileSync(join(two, 'c.png'), encodePng(createImage(3)));

        writeFileSync(join(views, 'one.visual.tsx'), '');

        removeReference(join(one, 'a.png'), root);
        expect(existsSync(join(one, 'b.png'))).toBe(true);

        removeReference(join(one, 'b.png'), root);
        expect(existsSync(one)).toBe(false);
        expect(existsSync(two)).toBe(true);

        removeReference(join(two, 'c.png'), root);
        expect(existsSync(join(views, '__references__'))).toBe(false);
        expect(existsSync(views)).toBe(true);
    });

    it('never deletes the root, even when it is left empty', () => {
        const root = join(dir, 'removal-root');
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, 'a.png'), encodePng(createImage(1)));
        removeReference(join(root, 'a.png'), root);
        expect(existsSync(root)).toBe(true);
    });
});
