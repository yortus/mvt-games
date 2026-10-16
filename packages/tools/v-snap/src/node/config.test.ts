import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VIEWPORT, vsnap } from './config.ts';
import { forgetVsnapCalls } from './test-files.ts';

const root = mkdtempSync(join(tmpdir(), 'vsnap-config-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, 'src', 'visual-tests'), { recursive: true });
writeFileSync(join(root, 'src', 'visual-tests', 'menu.test.ts'), "htmlTest('a', () => element);\n");

describe('vsnap', () => {
    // Each test's call claims the one test file afresh.
    beforeEach(forgetVsnapCalls);

    it('gives the page a 1280 by 800 viewport and the dark colour scheme by default', () => {
        const [project] = vsnap({ name: 'page-defaults', root });
        expect(DEFAULT_VIEWPORT).toEqual({ width: 1280, height: 800 });
        expect(project.test?.browser?.viewport).toEqual(DEFAULT_VIEWPORT);
        expect(project.test?.provide).toMatchObject({ vsnapViewport: DEFAULT_VIEWPORT, vsnapColorScheme: 'dark' });
    });

    it("sets the page's viewport and colour scheme from its options, for the browser and for the tests", () => {
        const viewport = { width: 1600, height: 1000 };
        const [project] = vsnap({ name: 'page-options', root, viewport, colorScheme: 'light' });
        expect(project.test?.browser?.viewport).toEqual(viewport);
        expect(project.test?.provide).toMatchObject({ vsnapViewport: viewport, vsnapColorScheme: 'light' });
        expect(JSON.stringify(project.test?.browser?.provider)).toContain('"colorScheme":"light"');
    });
});
