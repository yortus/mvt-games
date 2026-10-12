import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from './src/node';

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
