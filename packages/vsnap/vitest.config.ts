import { resolve } from 'node:path';
import { defaultClientConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from './src/node';

/** The `exports` condition under which vsnap resolves to its source, so its tests need no build. */
const SOURCE_CONDITION = '@mvtjs/source';

// vsnap's own tests: its unit tests in Node, its visual tests and calibration
// set, and the fixture project, which keeps its tests in visual-tests
// folders with their reference images beside them. `npm test` runs them all.
const visual = vsnap({ root: import.meta.dirname });
const fixture = vsnap({
    name: 'visual-fixture',
    root: resolve(import.meta.dirname, 'fixtures/visual-tests-folders'),
    include: ['src/**/visual-tests/*.test.ts'],
    referencePath: '{testFileDir}/{imageName}.png',
});

export default defineConfig({
    // The fixture project imports vsnap by name.
    resolve: {
        conditions: [SOURCE_CONDITION, ...defaultClientConditions],
    },
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['src/**/*.test.ts'],
                    exclude: [...configDefaults.exclude, '**/*.visual.test.{ts,tsx}'],
                },
            },
            ...visual,
            ...fixture,
        ],
    },
});
