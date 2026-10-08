import { defineConfig } from 'vitest/config';
import { DEFAULT_MAX_PIXELS, visualProject } from './scripts/visual/projects';
import { createVisualReporter } from './scripts/visual/reporter';

/**
 * The size budget: the most pixels a picture may have. A smooth view over
 * it is drawn at a lower resolution to fit; pixel art and HTML over it fail.
 */
const maxPixels = DEFAULT_MAX_PIXELS;

// The visual tests, apart from the unit tests: run them with `npm run test:visual`
// (scripts/visual/run.ts), which installs the browser on first use.
export default defineConfig({
    test: {
        projects: [visualProject({ kind: 'pixi', maxPixels }), visualProject({ kind: 'html', maxPixels })],
        // On GitHub, each failure is also an annotation on the run, with its message
        reporters: ['default', ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions' as const] : []), createVisualReporter()],
    },
});
