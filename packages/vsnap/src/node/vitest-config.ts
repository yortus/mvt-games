/**
 * The Vitest config that the `vsnap` command runs Vitest with. It reads the
 * project's `vsnap.config.ts` from the current folder, which is the
 * project's root, and makes the two projects and the reporters from it.
 */

import { defineConfig } from 'vitest/config';
import { createVisualConfig } from './config';
import { loadConfig } from './config-file';

export default defineConfig(async () => {
    const root = process.cwd();
    return { root, test: createVisualConfig({ ...await loadConfig(root), root }) };
});
