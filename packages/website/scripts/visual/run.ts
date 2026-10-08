/**
 * Runs the visual tests: installs Playwright's headless shell if it is
 * missing, then runs Vitest on `vitest.visual.config.ts`, in the mode asked
 * for. Any other arguments go to Vitest (`-t SpinButton`, a file filter,
 * `--watch`).
 *
 *   npm run test:visual                 compare every picture
 *   npm run test:visual:update          also write the references that changed or are new
 *   npm run test:visual:environment     also rewrite the environment's fingerprint
 *
 * On Windows it also reads the account's failed-logon count before and
 * after: Playwright's headless shell makes no logon attempt, but the full
 * Chrome does (once per new profile), and too many lock the account. If
 * a Playwright upgrade ever changed that, this is where it would show.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const WEBSITE = resolve(import.meta.dirname, '..', '..');
/** Windows locks an account after 10 failed logons by default; stop well short. */
const MAX_FAILED_LOGONS = 4;

const args = process.argv.slice(2);
const mode = args.includes('--environment') ? 'environment' : args.includes('--update') ? 'update' : 'compare';
const vitestArgs = args.filter((a) => a !== '--update' && a !== '--environment');
const isWatch = vitestArgs.includes('--watch');

const install = spawnSync('npx', ['playwright', 'install', 'chromium-headless-shell'], { cwd: WEBSITE, stdio: 'inherit', shell: true });
if (install.status !== 0) process.exit(install.status ?? 1);

const before = failedLogons();
if (before !== undefined && before >= MAX_FAILED_LOGONS) {
    console.error(`This account has ${before} failed logons; waiting for the lockout window before launching a browser.`);
    process.exit(1);
}

const run = spawnSync(
    'npx',
    ['vitest', ...(isWatch ? [] : ['run']), '--config', 'vitest.visual.config.ts', ...vitestArgs.filter((a) => a !== '--watch')],
    { cwd: WEBSITE, stdio: 'inherit', shell: true, env: { ...process.env, VISUAL_MODE: mode, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' } },
);

const after = failedLogons();
if (before !== undefined && after !== undefined && after > before) {
    console.warn(`\nWarning: this account's failed logons rose from ${before} to ${after} during the run. The browser may be testing a new profile's password: do not repeat the run until this is understood.\n`);
}
process.exit(run.status ?? 1);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The Windows account's failed-logon count, readable without admin; undefined elsewhere. */
function failedLogons(): number | undefined {
    if (process.platform !== 'win32') return undefined;
    const result = spawnSync('powershell', [
        '-NoProfile', '-Command',
        '([ADSI]"WinNT://$env:COMPUTERNAME/$env:USERNAME,user").BadPasswordAttempts',
    ], { encoding: 'utf8' });
    const count = Number(result.stdout.trim());
    return Number.isFinite(count) && result.status === 0 ? count : undefined;
}
