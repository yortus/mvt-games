import { defineConfig } from 'vitest/config';
import { DEFAULT_MAX_PIXELS, createVisualProject } from './scripts/visual/projects';
import { createVisualReporter } from './scripts/visual/reporter';

/**
 * The size budget, which is the most pixels a picture may have. A smooth
 * view over the budget is drawn at a lower resolution to fit. Pixel art and
 * HTML over the budget fail.
 */
const maxPixels = DEFAULT_MAX_PIXELS;

// This config runs the visual tests, separately from the unit tests. Run
// them with `npm run test:visual` (scripts/visual/run.ts), which installs
// the browser on first use.
export default defineConfig({
    test: {
        projects: [createVisualProject({ kind: 'pixi', maxPixels }), createVisualProject({ kind: 'html', maxPixels })],
        // On GitHub, each failure also becomes an annotation on the run, with
        // its message.
        reporters: ['default', ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions' as const] : []), createVisualReporter()],
    },
});
