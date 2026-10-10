import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import { createVisualConfig } from '../../src/node';

// A project that keeps its visual tests in a visual-tests folder inside each
// view folder, with their reference images beside them. The package's own
// run checks this layout end to end. Run it alone with
// `npm run test:visual:fixture -w @mvtjs/visual-testing`.
const config = createVisualConfig({
    include: ['src/**/visual-tests/*.test.ts'],
    referencePath: '{testFileDir}/{imageName}.png',
});

// Inside this repo, the @mvtjs libraries resolve to their source under the
// `@mvtjs/source` condition, as they do in the repo's other Vite configs.
export default defineConfig({
    test: {
        ...config,
        projects: config.projects.map((project) => ({
            ...project,
            resolve: { conditions: ['@mvtjs/source', ...defaultClientConditions] },
        })),
    },
});
