/**
 * A global setup step for vsnap's projects. Vitest runs it in Node before
 * the browser starts. It installs Playwright's headless shell if it is
 * missing, which happens once, on a machine's first run. Every vsnap
 * project runs it, so it checks only once in each run.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export default function installBrowser(): void {
    if (process.env.VSNAP_BROWSER_CHECKED === '1') return;
    const require = createRequire(import.meta.url);
    const cli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
    const result = spawnSync(process.execPath, [cli, 'install', 'chromium-headless-shell'], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Playwright could not install its headless shell (exit code ${result.status}).`);
    process.env.VSNAP_BROWSER_CHECKED = '1';
}
