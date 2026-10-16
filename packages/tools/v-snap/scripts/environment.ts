/**
 * Rewrites the environment's fingerprint (`visual-environment.json`) and the
 * calibration set's references, after a deliberate upgrade of Playwright. It
 * runs this package's own visual tests with `VSNAP_MODE=environment`.
 * Review the changes before committing them.
 *
 *   npm run test:visual:environment -w v-snap
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** This package's folder. */
const PACKAGE_DIR = join(import.meta.dirname, '..');

const require = createRequire(import.meta.url);
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const run = spawnSync(process.execPath, [vitest, 'run', '-p', 'visual-canvas', '-p', 'visual-html'], {
    cwd: PACKAGE_DIR,
    stdio: 'inherit',
    env: { ...process.env, VSNAP_MODE: 'environment' },
});
process.exit(run.status ?? 1);
