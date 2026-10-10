import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import { createVisualConfig, DEFAULT_MAX_PIXELS } from './src/node';

// The harness's own visual tests, and the calibration set. Run them with
// `npm run test:visual -w @mvtjs/visual-testing`.
const config = createVisualConfig({ maxPixels: DEFAULT_MAX_PIXELS });

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
