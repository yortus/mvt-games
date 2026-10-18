import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { configDefaults, type Plugin } from 'vitest/config';
import { DEFAULT_VIEWPORT, vsnapProjects } from './config.ts';
import { forgetVsnapCalls } from './test-files.ts';

const root = mkdtempSync(join(tmpdir(), 'vsnap-config-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, 'src', 'visual-tests'), { recursive: true });
writeFileSync(join(root, 'src', 'visual-tests', 'menu.test.ts'), "htmlTest('a', () => element);\n");

describe('vsnapProjects', () => {
    // Each test's call claims the one test file afresh.
    beforeEach(forgetVsnapCalls);

    it('gives the page a 1280 by 800 viewport and the dark colour scheme by default', () => {
        const [project] = vsnapProjects({ name: 'page-defaults', root });
        expect(DEFAULT_VIEWPORT).toEqual({ width: 1280, height: 800 });
        expect(project.test?.browser?.viewport).toEqual(DEFAULT_VIEWPORT);
        expect(project.test?.provide).toMatchObject({ vsnapViewport: DEFAULT_VIEWPORT, vsnapColorScheme: 'dark' });
    });

    it("sets the page's viewport and colour scheme from its options, for the browser and for the tests", () => {
        const viewport = { width: 1600, height: 1000 };
        const [project] = vsnapProjects({ name: 'page-options', root, viewport, colorScheme: 'light' });
        expect(project.test?.browser?.viewport).toEqual(viewport);
        expect(project.test?.provide).toMatchObject({ vsnapViewport: viewport, vsnapColorScheme: 'light' });
        expect(JSON.stringify(project.test?.browser?.provider)).toContain('"colorScheme":"light"');
    });

    it('gives each project its own files, setup files and browser back, in place of those of the config it inherits, and keeps the rest', () => {
        const [project] = vsnapProjects({ name: 'own-settings', root });
        const plugin = (project.plugins as Plugin[]).find((p) => p.name === 'v-snap:own-settings');
        const alias = [{ find: 'lib', replacement: './lib' }];
        // What Vite makes of the project and the config's test block together: lists joined, objects merged.
        const test: Record<string, unknown> = {
            include: ['src/**/*.test.ts', ...(project.test?.include ?? [])],
            exclude: ['legacy/**'],
            setupFiles: ['./unit-setup.ts', ...(project.test?.setupFiles as string[])],
            environment: 'jsdom',
            environmentOptions: { jsdom: {} },
            browser: { instances: [{ browser: 'firefox' }, { browser: 'chromium' }] },
            alias,
        };
        (plugin?.configResolved as (config: unknown) => void)({ test });
        expect(test.include).toEqual(project.test?.include);
        expect(test.exclude).toEqual(configDefaults.exclude);
        expect(test.setupFiles).toEqual(project.test?.setupFiles);
        expect(test.browser).toBe(project.test?.browser);
        expect(test).not.toHaveProperty('environment');
        expect(test).not.toHaveProperty('environmentOptions');
        expect(test.alias).toBe(alias);
    });
});
