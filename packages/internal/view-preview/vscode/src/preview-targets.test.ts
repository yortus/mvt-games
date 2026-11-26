import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPackageRoot, findServerScript, listPreviewTargets, toPageHash } from './preview-targets';

const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');
const TEST_FILE = resolve(PACKAGE_ROOT, 'src/entries/hud/views/visual-tests/hud-view.test.tsx');

describe('listPreviewTargets', () => {
    it('finds a pose written in place by its line, and one passed by name by its test\'s name', () => {
        const code = [
            `canvasTest('a score', SIZE, () => HudView({ score: () => 1230 }));`,
            `for (const level of LEVELS) {`,
            `    canvasTest(\`at \${level}\`, SIZE,`,
            `        () => poseLevel(level));`,
            `}`,
            `canvasTest('from a helper', SIZE, poseHelper);`,
            `canvasTest(\`\${name}, from a helper\`, poseHelper);`,
        ].join('\n');
        const targets = listPreviewTargets({ code, fileName: TEST_FILE }).map(({ offset, target }) => ({ at: code.slice(offset, offset + 14), ...target }));
        expect(targets).toEqual([
            { at: 'canvasTest(\'a ', file: TEST_FILE, line: 1 },
            { at: 'canvasTest(`at', file: TEST_FILE, line: 4 },
            { at: 'canvasTest(\'fr', file: TEST_FILE, name: 'from a helper' },
            { at: 'canvasTest(`${', file: TEST_FILE },
        ]);
    });
});

describe('toPageHash', () => {
    it('names a test file by its path under src/, and the test by its pose\'s line or its name', () => {
        expect(toPageHash({ packageRoot: PACKAGE_ROOT, target: { file: TEST_FILE, line: 4 } })).toBe('entries%2Fhud%2Fviews%2Fvisual-tests%2Fhud-view.test.tsx::@4');
        expect(toPageHash({ packageRoot: PACKAGE_ROOT, target: { file: TEST_FILE, name: 'a, b' } })).toBe('entries%2Fhud%2Fviews%2Fvisual-tests%2Fhud-view.test.tsx::a%2C%20b');
    });

    it('leaves out a file outside src/, which the page doesn\'t list', () => {
        expect(toPageHash({ packageRoot: PACKAGE_ROOT, target: { file: resolve(PACKAGE_ROOT, 'visual-tests/a.test.ts') } })).toBeUndefined();
    });
});

describe('findPackageRoot and findServerScript', () => {
    it('find the package a file belongs to, and the server its node_modules reaches', () => {
        expect(findPackageRoot(resolve(import.meta.dirname, 'preview-targets.ts'))).toBe(resolve(import.meta.dirname, '..'));
        expect(findServerScript(resolve(PACKAGE_ROOT, '../../sites/puzzles'))).toMatch(/[\\/]@mvtjs[\\/]view-preview[\\/]src[\\/]node[\\/]serve\.ts$/);
    });
});
