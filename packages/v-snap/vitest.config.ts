import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

// v-snap's own tests: its unit tests in Node, its visual tests and calibration
// set, and the fixture project. The fixture's reference images are named
// without their test file's stem, so each one belongs to its folder, not to
// one file. `npm test` runs them all.
const visual = vsnap({ root: import.meta.dirname, exclude: ['fixtures/**'] });
const fixture = vsnap({
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
            ...visual,
            ...fixture,
        ],
    },
});
