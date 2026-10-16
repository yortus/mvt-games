/**
 * A global setup step for v-snap's projects. Vitest runs it in Node before
 * the browser starts. It installs Playwright's headless shell if it is
 * missing, which happens once, on a machine's first run. Every v-snap
 * project runs it, so it checks only once in each run.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export default function installBrowser(): void {
    if (process.env.VSNAP_BROWSER_CHECKED === '1') return;
    const require = createRequire(import.meta.url);
    const playwright = dirname(require.resolve('playwright/package.json'));
    if (!isHeadlessShellInstalled(playwright)) {
        // Playwright's installer reports its download. It goes to standard
        // error, so that it can't corrupt a reporter's output on standard
        // output.
        const cli = join(playwright, 'cli.js');
        const result = spawnSync(process.execPath, [cli, 'install', 'chromium-headless-shell'], { stdio: ['ignore', 2, 2] });
        if (result.status !== 0) throw new Error(`Playwright could not install its headless shell (exit code ${result.status}).`);
    }
    process.env.VSNAP_BROWSER_CHECKED = '1';
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Returns whether the headless shell that this Playwright launches is
 * installed, without starting Playwright's installer, which takes about
 * 0.4 s even when there is nothing to do. Playwright installs each browser
 * in a folder named for its revision, in its cache, and marks it complete
 * when the install finishes. When the answer is unsure, it says no, and the
 * installer runs.
 */
function isHeadlessShellInstalled(playwright: string): boolean {
    try {
        const core = dirname(createRequire(join(playwright, 'package.json')).resolve('playwright-core/package.json'));
        const browsers = JSON.parse(readFileSync(join(core, 'browsers.json'), 'utf8')) as { browsers: { name: string; revision: string }[] };
        const shell = browsers.browsers.find((b) => b.name === 'chromium-headless-shell');
        if (shell === undefined) return false;
        return existsSync(join(findBrowsersFolder(core), `chromium_headless_shell-${shell.revision}`, 'INSTALLATION_COMPLETE'));
    }
    catch {
        return false;
    }
}

/** Returns the folder where Playwright keeps its browsers, as its documentation says it chooses it. */
function findBrowsersFolder(core: string): string {
    const set = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (set === '0') return join(core, '.local-browsers');
    if (set !== undefined && set !== '') return set;
    if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'ms-playwright');
    if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'ms-playwright');
    return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ms-playwright');
}
