// The benchmark's vsnap tests, which `run.ts` writes into
// .vitest/bench/vsnap/. Each draws a panel with canvasTest.
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { vsnap } from 'vsnap/vitest';

/** vsnap's package folder, which the paths are relative to. */
const PACKAGE_DIR = join(import.meta.dirname, '..');

export default defineConfig({
    root: PACKAGE_DIR,
    test: {
        projects: [
            // vsnap looks for test files below its root, and skips folders
            // whose names start with a dot, so the root is the tests' folder.
            ...vsnap({
                name: 'bench',
                root: join(PACKAGE_DIR, '.vitest/bench/vsnap'),
                include: ['*.test.ts'],
                vsnapConfig: join(PACKAGE_DIR, 'bench/vsnap.config.ts'),
            }),
        ],
    },
});
