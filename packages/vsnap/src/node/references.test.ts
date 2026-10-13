import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { createLayout } from './layout.ts';
import { encodePng, type RgbaImage } from './png.ts';
import { checkReference, checkReferences, findOrphans, findReferenceCandidates, findReferences, registerRoot, removeReference, toReferenceGlob } from './references.ts';

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
    it('finds the PNGs that carry a hash, where the reference path puts them, and no other PNGs', () => {
        const root = join(dir, 'tree');
        mkdirSync(join(root, 'views', 'visual-tests'), { recursive: true });
        writeFileSync(join(root, 'views', 'visual-tests', 'one.png'), encodePng(createImage(1)));
        writePlainPng(join(root, 'views', 'visual-tests', 'texture.png'));
        writePlainPng(join(root, 'views', 'not-a-reference.png'));
        const layout = createLayout({ root, referencePath: '{testFileDir}/{imageName}.png' });
        expect(findReferences(layout, ['views/visual-tests/hud.test.ts']).map((r) => r.file)).toEqual([join(root, 'views', 'visual-tests', 'one.png')]);
    });

    it('leaves out a PNG with a hash that the reference path could not produce, such as a copy in a docs folder, and keeps those of a deleted test file', () => {
        const root = join(dir, 'outside');
        mkdirSync(join(root, 'views', 'visual-tests'), { recursive: true });
        mkdirSync(join(root, 'docs'), { recursive: true });
        writeFileSync(join(root, 'views', 'visual-tests', 'hud.Hud.png'), encodePng(createImage(1)));
        writeFileSync(join(root, 'docs', 'hud.Hud.png'), encodePng(createImage(1)));
        // No test file is left, but the image is still the reference of one, unused.
        expect(findReferences(createLayout({ root }), []).map((r) => r.file)).toEqual([join(root, 'views', 'visual-tests', 'hud.Hud.png')]);
    });

    it('tells which test file an image is of by its stem, when stems and image names hold dots', () => {
        const root = join(dir, 'stems');
        const tests = join(root, 'views', 'visual-tests');
        mkdirSync(tests, { recursive: true });
        writeFileSync(join(tests, 'hud.view.Hud-three.js-lit.png'), encodePng(createImage(1)));
        writeFileSync(join(tests, 'menu.Menu-open.png'), encodePng(createImage(2)));
        writeFileSync(join(tests, 'no-stem.png'), encodePng(createImage(3)));
        writePlainPng(join(tests, 'hud.view.texture.png'));
        const files = findReferences(createLayout({ root }), ['views/visual-tests/hud.view.test.ts']).map((r) => r.file);
        // menu.test.ts was deleted, and its image is unused. A PNG without a
        // stem is not a reference, nor is one without a hash.
        expect(files).toEqual([join(tests, 'hud.view.Hud-three.js-lit.png'), join(tests, 'menu.Menu-open.png')]);
    });

    it('skips a folder below the root that is a root of visual tests of its own', () => {
        const root = join(dir, 'nested');
        mkdirSync(join(root, 'fixture'), { recursive: true });
        writeFileSync(join(root, 'own.png'), encodePng(createImage(1)));
        registerRoot(join(root, 'fixture'));
        writeFileSync(join(root, 'fixture', 'theirs.png'), encodePng(createImage(2)));
        const referencePath = '{testFileDir}/{imageName}.png';
        expect(findReferences(createLayout({ root, referencePath }), ['own.test.ts']).map((r) => r.file)).toEqual([join(root, 'own.png')]);
        expect(findReferences(createLayout({ root: join(root, 'fixture'), referencePath }), ['theirs.test.ts']).map((r) => r.file)).toEqual([join(root, 'fixture', 'theirs.png')]);
    });

    it('gives each of two vsnap calls with one root only the images of the test files that its include matches', () => {
        const root = join(dir, 'two-calls');
        mkdirSync(join(root, 'a', '__references__', 'x.visual.test.ts'), { recursive: true });
        mkdirSync(join(root, 'b', '__references__', 'y.visual.test.ts'), { recursive: true });
        writeFileSync(join(root, 'a', '__references__', 'x.visual.test.ts', 'A.png'), encodePng(createImage(1)));
        writeFileSync(join(root, 'b', '__references__', 'y.visual.test.ts', 'B.png'), encodePng(createImage(2)));
        const referencePath = '{testFileDir}/__references__/{testFileName}/{imageName}.png';
        const a = createLayout({ root, include: ['a/**/*.visual.test.ts'], referencePath });
        const b = createLayout({ root, include: ['b/**/*.visual.test.ts'], referencePath });
        expect(findReferences(a, ['a/x.visual.test.ts']).map((r) => r.file)).toEqual([join(root, 'a', '__references__', 'x.visual.test.ts', 'A.png')]);
        expect(findReferences(b, ['b/y.visual.test.ts']).map((r) => r.file)).toEqual([join(root, 'b', '__references__', 'y.visual.test.ts', 'B.png')]);
    });

    it('gives a template without the test file name only the images in the folders of its test files, not a copy in a docs folder', () => {
        const root = join(dir, 'folders');
        mkdirSync(join(root, 'views'), { recursive: true });
        mkdirSync(join(root, 'docs'), { recursive: true });
        writeFileSync(join(root, 'views', 'Hud.png'), encodePng(createImage(1)));
        writeFileSync(join(root, 'docs', 'Hud.png'), encodePng(createImage(1)));
        const layout = createLayout({ root, referencePath: '{testFileDir}/{imageName}.png' });
        expect(findReferences(layout, ['views/hud.visual.test.ts']).map((r) => r.file)).toEqual([join(root, 'views', 'Hud.png')]);
    });

    it('reads a template that names the whole test file path, and one with folders around the test file name', () => {
        const root = join(dir, 'templates');
        mkdirSync(join(root, 'refs', 'src', 'hud.visual.test.ts'), { recursive: true });
        mkdirSync(join(root, 'refs', 'other', 'menu.spec.ts'), { recursive: true });
        writeFileSync(join(root, 'refs', 'src', 'hud.visual.test.ts', 'Hud.png'), encodePng(createImage(1)));
        writeFileSync(join(root, 'refs', 'other', 'menu.spec.ts', 'Menu.png'), encodePng(createImage(2)));
        const byPath = createLayout({ root, include: ['src/**/*.visual.test.ts'], referencePath: 'refs/{testFilePath}/{imageName}.png' });
        expect(findReferences(byPath, []).map((r) => r.file)).toEqual([join(root, 'refs', 'src', 'hud.visual.test.ts', 'Hud.png')]);
        const byName = createLayout({ root, include: ['src/*.visual.test.ts'], referencePath: 'shots/{testFileName}-{imageName}.png' });
        mkdirSync(join(root, 'shots'), { recursive: true });
        writeFileSync(join(root, 'shots', 'hud.visual.test.ts-Hud.png'), encodePng(createImage(1)));
        writeFileSync(join(root, 'shots', 'gone.visual.test.ts-Old.png'), encodePng(createImage(2)));
        expect(findReferences(byName, ['src/hud.visual.test.ts']).map((r) => r.file)).toEqual([join(root, 'shots', 'hud.visual.test.ts-Hud.png')]);
    });
});

describe('toReferenceGlob', () => {
    it('matches any folders for a folder variable, and any one name for a name variable', () => {
        expect(toReferenceGlob('{testFileDir}/__references__/{testFileName}/{imageName}.png')).toBe('**/__references__/*/*.png');
        expect(toReferenceGlob('{testFileDir}/{imageName}.ref.png')).toBe('**/*.ref.png');
        expect(toReferenceGlob('visual-references/{testFilePath}/{imageName}.png')).toBe('visual-references/**/*.png');
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

describe('checkReferences', () => {
    it('remembers the references that passed, and checks one again once it changes', () => {
        const cache = join(dir, 'checks', 'cache.json');
        const file = write('cached.png', encodePng(createImage(7)));
        expect(checkReferences([file], cache).get(file)).toBeUndefined();
        expect(existsSync(cache)).toBe(true);
        // Unchanged, it isn't decoded again: the cache, not the file, passes it.
        const cached = JSON.parse(readFileSync(cache, 'utf8')) as { passed: Record<string, string> };
        expect(Object.values(cached.passed)).toHaveLength(1);
        // A file whose pixels changed, without its hash, has a new time, so it
        // is checked again, and fails.
        const original = encodePng(createImage(7));
        const edited = encodePng(createImage(9));
        const textEnd = 33 + 12 + new DataView(original.buffer, original.byteOffset).getUint32(33);
        const editedTextEnd = 33 + 12 + new DataView(edited.buffer, edited.byteOffset).getUint32(33);
        writeFileSync(file, new Uint8Array([...original.subarray(0, textEnd), ...edited.subarray(editedTextEnd)]));
        utimesSync(file, new Date(), new Date(Date.now() + 5000));
        expect(checkReferences([file], cache).get(file)).toMatch(/^its pixels hash to /);
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
