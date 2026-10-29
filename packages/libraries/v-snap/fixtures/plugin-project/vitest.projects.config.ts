// The same project, with a config that lists its projects: the unit tests
// in a project of their own, named node, and the vsnap() plugin.
import { defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

export default defineConfig({
    plugins: [vsnap()],
    test: {
        projects: [
            {
                extends: true,
                test: { name: 'node', include: ['src/**/*.test.ts'], setupFiles: ['./unit-setup.ts'] },
            },
        ],
    },
});
