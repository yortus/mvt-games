import { defineConfig } from 'vitest/config';
import { createVisualProject, createVisualReporters, DEFAULT_MAX_PIXELS } from '@mvtjs/visual-testing/node';

/**
 * The size budget, which is the most pixels a picture may have. A smooth
 * view over the budget is drawn at a lower resolution to fit. Pixel art and
 * HTML over the budget fail.
 */
const maxPixels = DEFAULT_MAX_PIXELS;

/**
 * The site's dependencies that Vite must bundle before the run. Every test
 * file runs in one page, so a dependency found during the run would load a
 * second copy of a library. A new dependency of an entry belongs here.
 */
const optimizeDeps = ['gsap', 'pixi-solid', 'solid-js', 'solid-js/store'];

// This config runs the site's visual tests, separately from the unit tests.
// Run them with `npm run test:visual`, which installs the browser on first
// use. The projects extend the site's Vite config, for its plugins.
export default defineConfig({
    test: {
        projects: [
            createVisualProject({ kind: 'pixi', maxPixels, viteConfig: './vite.config.ts', optimizeDeps }),
            createVisualProject({ kind: 'html', maxPixels, viteConfig: './vite.config.ts', optimizeDeps }),
        ],
        reporters: createVisualReporters(),
    },
});
