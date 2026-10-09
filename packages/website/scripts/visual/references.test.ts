import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { encodePng, type Picture } from './png';
import { checkReference, findReferences, findOrphans, findReferenceDir, removeReference } from './references';

const dir = mkdtempSync(join(tmpdir(), 'visual-references-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function createPicture(seed: number): Picture {
    const pixels = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * seed) & 0xff;
    return { width: 8, height: 8, pixels };
}

function write(name: string, bytes: Uint8Array): string {
    const file = join(dir, name);
    writeFileSync(file, bytes);
    return file;
}

describe('findReferences', () => {
    it('finds the PNGs in __screenshots__ directories, and only those', () => {
        const root = join(dir, 'tree');
        mkdirSync(join(root, 'views', '__screenshots__', 'a.visual.tsx'), { recursive: true });
        writeFileSync(join(root, 'views', '__screenshots__', 'a.visual.tsx', 'one.png'), encodePng(createPicture(1)));
        writeFileSync(join(root, 'views', 'not-a-reference.png'), encodePng(createPicture(1)));
        const found = findReferences(root).map((r) => r.file);
        expect(found).toEqual([join(root, 'views', '__screenshots__', 'a.visual.tsx', 'one.png')]);
    });
});

describe('checkReference', () => {
    it('passes a file whose pixels match its hash', () => {
        expect(checkReference(write('good.png', encodePng(createPicture(3))))).toBeUndefined();
    });

    it('fails a file whose pixels were changed without its hash', () => {
        // The hash of one picture, the pixels of another: as if edited in a paint program that kept the text chunk
        const original = encodePng(createPicture(3));
        const edited = encodePng(createPicture(5));
        const textEnd = 33 + 12 + new DataView(original.buffer, original.byteOffset).getUint32(33);
        const editedTextEnd = 33 + 12 + new DataView(edited.buffer, edited.byteOffset).getUint32(33);
        const forged = new Uint8Array([...original.subarray(0, textEnd), ...edited.subarray(editedTextEnd)]);
        expect(checkReference(write('forged.png', forged))).toMatch(/^pixels hash to /);
    });

    it('fails a PNG that carries no hash', () => {
        const png = new PNG({ width: 2, height: 2 });
        expect(checkReference(write('plain.png', PNG.sync.write(png)))).toMatch(/carries no pixel hash/);
    });
});

describe('orphansOf', () => {
    it('gives the references not compared with, whichever way their paths are written', () => {
        const references = findReferenceDir(join(tmpdir(), 'views', 'a.visual.tsx'));
        const kept = join(references, 'kept.png');
        const orphan = join(references, 'renamed.png');
        // Vitest writes paths with forward slashes
        expect(findOrphans({ references: [kept, orphan], compared: [kept.replaceAll('\\', '/')] })).toEqual([orphan]);
    });
});

describe('removeReference', () => {
    it('deletes the file, and the directories it leaves empty', () => {
        const views = join(dir, 'removal', 'views');
        const one = findReferenceDir(join(views, 'one.visual.tsx'));
        const two = findReferenceDir(join(views, 'two.visual.tsx'));
        mkdirSync(one, { recursive: true });
        mkdirSync(two, { recursive: true });
        writeFileSync(join(one, 'a.png'), encodePng(createPicture(1)));
        writeFileSync(join(one, 'b.png'), encodePng(createPicture(2)));
        writeFileSync(join(two, 'c.png'), encodePng(createPicture(3)));

        removeReference(join(one, 'a.png'));
        expect(existsSync(join(one, 'b.png'))).toBe(true);

        removeReference(join(one, 'b.png'));
        expect(existsSync(one)).toBe(false);
        expect(existsSync(two)).toBe(true);

        removeReference(join(two, 'c.png'));
        expect(existsSync(join(views, '__screenshots__'))).toBe(false);
        expect(existsSync(views)).toBe(true);
    });
});
