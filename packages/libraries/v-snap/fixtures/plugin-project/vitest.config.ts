// A flat config, as a project has before it adds v-snap, with the vsnap()
// plugin added. Its settings would break v-snap's projects if they reached
// them: the include matches the visual test files too, the setup file
// imports a module that only Node has, and the browser instance would run
// each visual test a second time.
import { defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

export default defineConfig({
    plugins: [vsnap()],
    test: {
        include: ['src/**/*.test.ts'],
        setupFiles: ['./unit-setup.ts'],
        environment: 'node',
        browser: { instances: [{ browser: 'chromium' }] },
    },
});
