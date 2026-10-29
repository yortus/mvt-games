import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkReferencePath, createLayout, matchReferenceName, resolveReferencePath, resolveReferencePattern, toFileStem } from './layout.ts';

const root = join('/', 'project');
const testFile = join(root, 'src', 'views', 'hud-view.visual.tsx');

function resolve(referencePath: string): string {
    return resolveReferencePath(createLayout({ root, referencePath }), testFile, 'HudView-at-the-start');
}

describe('checkReferencePath', () => {
    it('accepts a template with every variable', () => {
        expect(checkReferencePath('refs/{testFileDir}/{testFileName}/{testFilePath}/{testFileStem}.{imageName}.png')).toBeUndefined();
    });

    it('rejects an unknown variable, and names the known ones', () => {
        expect(checkReferencePath('{testFileDir}/{platform}/{imageName}.png')).toMatch(/unknown variable \{platform\}.*\{testFileDir\}/);
    });

    it('rejects a template without {imageName}, or with two', () => {
        expect(checkReferencePath('{testFileDir}/image.png')).toMatch(/exactly once/);
        expect(checkReferencePath('{testFileDir}/{imageName}-{imageName}.png')).toMatch(/exactly once/);
    });

    it('rejects {imageName} outside the file name', () => {
        expect(checkReferencePath('{testFileDir}/{imageName}/image.png')).toMatch(/in its file name/);
    });

    it('rejects a file name that does not end in .png', () => {
        expect(checkReferencePath('{testFileDir}/{imageName}.webp')).toMatch(/\.png/);
    });

    it('rejects a template that leaves the project', () => {
        expect(checkReferencePath('../refs/{imageName}.png')).toMatch(/inside it/);
        expect(checkReferencePath('/refs/{imageName}.png')).toMatch(/inside it/);
        expect(checkReferencePath('C:/refs/{imageName}.png')).toMatch(/inside it/);
    });

    it('makes createLayout throw, quoting the template', () => {
        expect(() => createLayout({ root, referencePath: '{imageName}.jpg' })).toThrow(/'\{imageName\}\.jpg' must end in \.png/);
    });
});

describe('resolveReferencePath', () => {
    it('fills in the test file\'s folder, name and path', () => {
        expect(resolve('{testFileDir}/__references__/{testFileName}/{imageName}.png'))
            .toBe(join(root, 'src', 'views', '__references__', 'hud-view.visual.tsx', 'HudView-at-the-start.png'));
        expect(resolve('{testFileDir}/{imageName}.png')).toBe(join(root, 'src', 'views', 'HudView-at-the-start.png'));
        expect(resolve('visual-references/{testFilePath}/{imageName}.png'))
            .toBe(join(root, 'visual-references', 'src', 'views', 'hud-view.visual.tsx', 'HudView-at-the-start.png'));
    });

    it('fills in the test file\'s stem', () => {
        expect(resolve('{testFileDir}/{testFileStem}.{imageName}.png')).toBe(join(root, 'src', 'views', 'hud-view.visual.HudView-at-the-start.png'));
    });

    it('by default, puts each image beside its test file, named for the file\'s stem and the image', () => {
        const layout = createLayout({ root });
        expect(resolveReferencePath(layout, join(root, 'src', 'views', 'visual-tests', 'hud-view.test.tsx'), 'HudView-at-the-start'))
            .toBe(join(root, 'src', 'views', 'visual-tests', 'hud-view.HudView-at-the-start.png'));
    });

    it('handles a test file at the project\'s root', () => {
        const layout = createLayout({ root, referencePath: '{testFileDir}/__references__/{imageName}.png' });
        expect(resolveReferencePath(layout, join(root, 'a.visual.ts'), 'A')).toBe(join(root, '__references__', 'A.png'));
    });
});

describe('resolveReferencePattern and matchReferenceName', () => {
    const layout = createLayout({ root, referencePath: '{testFileDir}/visual-tests/ref-{imageName}.ref.png' });
    const pattern = resolveReferencePattern(layout, testFile);

    it('gives the folder, and the file name around the image name', () => {
        expect(pattern).toEqual({ dir: join(root, 'src', 'views', 'visual-tests'), prefix: 'ref-', suffix: '.ref.png' });
    });

    it('takes the image name from a matching file name, and nothing from others', () => {
        expect(matchReferenceName(pattern, 'ref-HudView-at-the-start.ref.png')).toBe('HudView-at-the-start');
        expect(matchReferenceName(pattern, 'HudView-at-the-start.ref.png')).toBeUndefined();
        expect(matchReferenceName(pattern, 'ref-HudView.png')).toBeUndefined();
        expect(matchReferenceName(pattern, 'ref-.ref.png')).toBeUndefined();
    });
});

describe('toFileStem', () => {
    it('leaves out .test or .spec and the extension', () => {
        expect(toFileStem('hud-view.test.tsx')).toBe('hud-view');
        expect(toFileStem('menu.spec.ts')).toBe('menu');
        expect(toFileStem('hud.view.test.mjs')).toBe('hud.view');
    });

    it('leaves out only the extension of another name', () => {
        expect(toFileStem('hud-view.tsx')).toBe('hud-view');
        expect(toFileStem('hud.visual.ts')).toBe('hud.visual');
        expect(toFileStem('README')).toBe('README');
    });
});
