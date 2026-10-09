import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import { createVisualProject, createVisualReporters, DEFAULT_MAX_PIXELS, type VisualProjectOptions } from './src/node';

// The harness's own visual tests, and the calibration set. Run them with
// `npm run test:visual -w @mvtjs/visual-testing`.
export default defineConfig({
    test: {
        projects: [createProject({ kind: 'canvas' }), createProject({ kind: 'html' })],
        reporters: createVisualReporters(),
    },
});

/**
 * Creates one of the harness's projects. Inside this repo, the @mvtjs
 * libraries resolve to their source under the `@mvtjs/source` condition, as
 * they do in the repo's other Vite configs.
 */
function createProject(options: Pick<VisualProjectOptions, 'kind'>): ReturnType<typeof createVisualProject> {
    return {
        ...createVisualProject({ ...options, maxPixels: DEFAULT_MAX_PIXELS }),
        resolve: { conditions: ['@mvtjs/source', ...defaultClientConditions] },
    };
}
