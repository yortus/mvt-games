import { defineConfig } from 'vitest/config';
import { visualProject } from './scripts/visual/projects';
import { createVisualReporter } from './scripts/visual/reporter';

// The visual tests, apart from the unit tests: run them with `npm run test:visual`
// (scripts/visual/run.ts), which installs the browser on first use.
export default defineConfig({
    test: {
        projects: [visualProject({ kind: 'pixi' }), visualProject({ kind: 'html' })],
        reporters: ['default', createVisualReporter()],
    },
});
