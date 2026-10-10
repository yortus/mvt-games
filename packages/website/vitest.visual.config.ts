import { defineConfig } from 'vitest/config';
import { createVisualConfig, DEFAULT_MAX_PIXELS } from '@mvtjs/visual-testing/node';

// This config runs the site's visual tests, separately from the unit tests.
// Run them with `npm run test:visual`, which installs the browser on first
// use. The projects extend the site's Vite config, for its plugins. The size
// budget is the most pixels an image may have. A smooth view over the budget
// is drawn at a lower resolution to fit. Pixel art and HTML over the budget
// fail.
export default defineConfig({
    test: createVisualConfig({ maxPixels: DEFAULT_MAX_PIXELS, viteConfig: './vite.config.ts' }),
});
