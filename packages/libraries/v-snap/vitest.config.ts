import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnapProjects } from 'v-snap/vitest';

// v-snap's own tests: its unit tests in Node, the vsnap() plugin's tests, its
// visual tests and calibration set, and the fixture project. The plugin's
// tests run Vitest on a fixture of their own, which starts a browser, so
// they are left out of the unit tests. The fixture's reference images are
// named without their test file's stem, so each one belongs to its folder,
// not to one file. `npm test` runs them all.
const visual = vsnapProjects({ root: import.meta.dirname, exclude: ['fixtures/**'] });
const fixture = vsnapProjects({
    name: 'visual-fixture',
    root: resolve(import.meta.dirname, 'fixtures/visual-tests-folders'),
    referencePath: '{testFileDir}/{imageName}.png',
});

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
                    exclude: [...configDefaults.exclude, '**/visual-tests/**'],
                },
            },
            { test: { name: 'plugin', include: ['fixtures/plugin-project.test.ts'] } },
            ...visual,
            ...fixture,
        ],
    },
});
