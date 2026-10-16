import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { configDefaults, type TestProjectInlineConfiguration, type ViteUserConfig } from 'vitest/config';
import { DEFAULT_INCLUDE } from './layout.ts';
import { withVsnap } from './with-vsnap.ts';

const root = mkdtempSync(join(tmpdir(), 'vsnap-with-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, 'src', 'visual-tests'), { recursive: true });
writeFileSync(join(root, 'src', 'visual-tests', 'hud.test.ts'), "canvasTest('a', () => view);\n");

/** Returns a config's projects, as inline configs. */
function listProjects(config: ViteUserConfig): TestProjectInlineConfiguration[] {
    return (config.test?.projects ?? []) as TestProjectInlineConfiguration[];
}

describe('withVsnap', () => {
    it("moves a flat config's unit test settings into a unit project, which leaves out the visual tests, and adds v-snap's projects", () => {
        const plugin = { name: 'views' };
        const config = withVsnap({
            vsnap: { name: 'shots', root },
            root,
            plugins: [plugin],
            test: { environment: 'jsdom', setupFiles: ['./setup.ts'], include: ['src/**/*.test.ts'], reporters: ['dot'], coverage: { enabled: true } },
        });
        expect('vsnap' in config).toBe(false);
        expect(config.plugins).toEqual([plugin]);
        expect(config.test?.reporters).toEqual(['dot']);
        expect(config.test?.coverage).toEqual({ enabled: true });
        expect(config.test?.environment).toBeUndefined();
        expect(config.test?.setupFiles).toBeUndefined();
        const [unit, ...visual] = listProjects(config);
        expect(unit).toEqual({
            extends: true,
            test: {
                name: 'unit',
                environment: 'jsdom',
                setupFiles: ['./setup.ts'],
                include: ['src/**/*.test.ts'],
                exclude: [...configDefaults.exclude, ...DEFAULT_INCLUDE],
            },
        });
        expect(visual.map((p) => p.test?.name)).toEqual(['shots-canvas']);
    });

    it("keeps a flat config's own exclude and name for the unit project", () => {
        const config = withVsnap({ vsnap: { name: 'shots', root }, root, test: { name: 'node', exclude: ['legacy/**'] } });
        expect(listProjects(config)[0].test).toEqual({ name: 'node', exclude: ['legacy/**', ...DEFAULT_INCLUDE] });
    });

    it("adds v-snap's projects after the projects of a config that has them", () => {
        const own = { test: { name: 'node' } };
        const config = withVsnap({ vsnap: { name: 'shots', root }, root, test: { projects: [own] } });
        expect(listProjects(config).map((p) => p.test?.name)).toEqual(['node', 'shots-canvas']);
    });

    it("moves v-snap's globs to the config's root when v-snap's root is a folder inside it", () => {
        const config = withVsnap({ vsnap: { name: 'shots', root }, root: join(root, '..') });
        const folder = root.slice(root.lastIndexOf(root.includes('\\') ? '\\' : '/') + 1);
        expect(listProjects(config)[0].test?.exclude).toEqual([...configDefaults.exclude, ...DEFAULT_INCLUDE.map((glob) => `${folder}/${glob}`)]);
    });

    it('takes a config function', async () => {
        const config = withVsnap(() => ({ vsnap: { name: 'shots', root }, root, test: { environment: 'node' } }));
        const resolved = await config({ command: 'serve', mode: 'test' });
        expect(listProjects(resolved)[0].test?.environment).toBe('node');
        expect(listProjects(resolved).map((p) => p.test?.name)).toEqual(['unit', 'shots-canvas']);
    });
});
