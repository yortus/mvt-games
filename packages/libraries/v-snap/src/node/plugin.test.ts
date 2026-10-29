import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configDefaults, type Plugin, type ViteUserConfig } from 'vitest/config';
import { DEFAULT_INCLUDE } from './layout.ts';
import { listHostNames, vsnap, warnOfProjectFilter } from './plugin.ts';
import { forgetVsnapCalls } from './test-files.ts';

const root = mkdtempSync(join(tmpdir(), 'vsnap-plugin-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, 'src', 'visual-tests'), { recursive: true });
writeFileSync(join(root, 'src', 'visual-tests', 'hud.test.ts'), "canvasTest('a', () => view);\n");

/** The settings of a `test` block, as the tests read them. */
interface TestBlock {
    name?: unknown;
    exclude?: string[];
    projects?: unknown[];
    provide?: Record<string, unknown>;
}

/** Calls a plugin's config hook, as Vite does with the config file's contents. */
function callConfig(plugin: Plugin, config: ViteUserConfig): void {
    (plugin.config as (config: ViteUserConfig) => void)(config);
}

/** Calls a plugin's configResolved hook, with a resolved config's root and test block. */
function callConfigResolved(plugin: Plugin, resolved: { root: string; test: TestBlock }): void {
    (plugin.configResolved as (config: unknown) => void)(resolved);
}

describe('vsnap', () => {
    beforeEach(forgetVsnapCalls);

    it("names a flat config's tests unit, unless the config names them, and leaves a config with projects as it is", () => {
        const flat: ViteUserConfig = { test: { include: ['src/**/*.test.ts'] } };
        callConfig(vsnap(), flat);
        expect(flat.test?.name).toBe('unit');
        const named: ViteUserConfig = { test: { name: 'node' } };
        callConfig(vsnap(), named);
        expect(named.test?.name).toBe('node');
        const withProjects: ViteUserConfig = { test: { projects: [{ test: { name: 'node' } }] } };
        callConfig(vsnap(), withProjects);
        expect(withProjects.test?.name).toBeUndefined();
    });

    it("leaves the visual test files out of a flat config's tests, beside the files that Vitest leaves out", () => {
        const test: TestBlock = {};
        callConfigResolved(vsnap(), { root, test });
        expect(test.exclude).toEqual([...configDefaults.exclude, ...DEFAULT_INCLUDE]);
        const own: TestBlock = { exclude: ['legacy/**'] };
        callConfigResolved(vsnap(), { root, test: own });
        expect(own.exclude).toEqual(['legacy/**', ...DEFAULT_INCLUDE]);
    });

    it('leaves them out of each project listed inline, but not out of a project in a file of its own, or one of its own projects', () => {
        const node = { test: { name: 'node', exclude: ['legacy/**'] } };
        const unnamed = { extends: false };
        const visual = { test: { name: 'visual-canvas', provide: { vsnapPageKind: 'canvas' } } };
        const test: TestBlock = { projects: ['packages/*', node, unnamed, visual] };
        callConfigResolved(vsnap(), { root, test });
        expect(node.test.exclude).toEqual(['legacy/**', ...DEFAULT_INCLUDE]);
        expect(unnamed).toEqual({ extends: false, test: { exclude: [...configDefaults.exclude, ...DEFAULT_INCLUDE] } });
        expect(visual.test).not.toHaveProperty('exclude');
        expect(test.projects?.[0]).toBe('packages/*');
    });

    it("moves the globs to the config's root when v-snap's root is a folder inside it", () => {
        const test: TestBlock = {};
        callConfigResolved(vsnap({ root: 'site', include: ['**/*.visual.ts'] }), { root, test });
        expect(test.exclude).toEqual([...configDefaults.exclude, 'site/**/*.visual.ts']);
    });

    it("leaves v-snap's own projects as they are, which load the config again since they inherit it", () => {
        const test: TestBlock = { provide: { vsnapPageKind: 'html' } };
        callConfig(vsnap(), { test } as ViteUserConfig);
        callConfigResolved(vsnap(), { root, test });
        expect(test).toEqual({ provide: { vsnapPageKind: 'html' } });
    });

    it("adds v-snap's projects and its reporter once for each Vitest instance, from Vitest's root", async () => {
        const plugin = vsnap({ name: 'once' });
        const injectTestProjects = vi.fn(async (_projects: unknown) => []);
        const vitest = { config: { root, reporters: [] as unknown[], watch: false }, vite: {} };
        const hook = plugin.configureVitest as (context: unknown) => Promise<void>;
        await hook({ vitest, injectTestProjects });
        await hook({ vitest, injectTestProjects });
        expect(injectTestProjects).toHaveBeenCalledOnce();
        const projects = injectTestProjects.mock.calls[0][0] as { root?: string; test?: { name?: string } }[];
        expect(projects.map((p) => p.test?.name)).toEqual(['once-canvas']);
        expect(projects[0].root).toBe(root);
        expect(vitest.config.reporters).toHaveLength(1);
    });
});

describe('warnOfProjectFilter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    afterEach(() => warn.mockClear());
    afterAll(() => warn.mockRestore());

    it('warns when a --project filter picks the visual projects but leaves out the project that adds them', () => {
        warnOfProjectFilter({ config: { test: {} }, options: { name: 'warns' }, argv: ['vitest', 'run', '-p', 'warns-*'] });
        expect(warn).toHaveBeenCalledOnce();
        expect(warn.mock.calls[0][0]).toContain('v-snap: --project warns-* leaves out the visual tests.');
        expect(warn.mock.calls[0][0]).toContain('through the unit project, and this filter leaves it out.');
        expect(warn.mock.calls[0][0]).toContain(`v-snap finds visual test files with ${DEFAULT_INCLUDE.join(', ')}.`);
    });

    it('stays quiet without a filter, with one that keeps a project that adds them, or with one that picks none of them', () => {
        const config = { test: {} };
        warnOfProjectFilter({ config, options: { name: 'quiet' }, argv: ['vitest', 'run'] });
        warnOfProjectFilter({ config, options: { name: 'quiet' }, argv: ['vitest', 'run', '-p', 'unit', '-p', 'quiet-*'] });
        warnOfProjectFilter({ config, options: { name: 'quiet' }, argv: ['vitest', 'run', '--project=unit'] });
        expect(warn).not.toHaveBeenCalled();
    });

    it("names the project's own globs for the visual test files, when it has them", () => {
        const include = ['src/**/*.visual.ts', 'docs/**/*.visual.ts'];
        warnOfProjectFilter({ config: { test: {} }, options: { name: 'globs', include }, argv: ['vitest', '-p', 'globs-html'] });
        expect(warn.mock.calls[0][0]).toContain(`v-snap finds visual test files with ${include.join(', ')}.`);
    });
});

describe('listHostNames', () => {
    it("names a flat config's tests unit, unless the config names them", () => {
        expect(listHostNames({ test: {} })).toEqual(['unit']);
        expect(listHostNames({ test: { name: 'node' } })).toEqual(['node']);
        expect(listHostNames({ test: { name: { label: 'node', color: 'green' } } })).toEqual(['node']);
    });

    it('names the projects listed inline that inherit the config, and the plugin with it', () => {
        expect(listHostNames({ test: { projects: [{ test: { name: 'node' } }, { extends: false, test: { name: 'lint' } }, { extends: './other.config.ts', test: { name: 'other' } }] } })).toEqual(['node']);
    });

    it("can't tell for a project in a file of its own, or one without a name", () => {
        expect(listHostNames({ test: { projects: ['packages/*'] } })).toBeUndefined();
        expect(listHostNames({ test: { projects: [{ test: {} }] } })).toBeUndefined();
    });
});
