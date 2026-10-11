import { defineConfig, DEFAULT_MAX_PIXELS } from 'vsnap/config';

// The site's visual tests, which run separately from its unit tests. Run them
// with `npm run test:visual`, which installs the browser on first use. They
// use the site's Vite config, for its plugins and aliases. The setup file
// tells vsnap how to prepare and dispose of MVT views.
export default defineConfig({
    maxPixels: DEFAULT_MAX_PIXELS,
    viteConfig: './vite.config.ts',
    setup: './vsnap-setup.ts',
});
