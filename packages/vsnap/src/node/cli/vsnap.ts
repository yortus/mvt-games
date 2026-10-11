/**
 * The `vsnap` command. It runs the visual tests of the project in the
 * current folder, which holds the project's `vsnap.config.ts`. It installs
 * Playwright's headless shell (a small build of Chromium for headless use)
 * if it is missing. Then it runs Vitest with this package's Vitest config
 * (`src/node/vitest-config.ts`), which reads the project's config, in the
 * mode asked for. Any other arguments go to Vitest, such as a file filter or
 * `--watch`.
 *
 *   vsnap                    compares every actual image with its reference image
 *   vsnap --update           also writes the reference images that changed or are new
 *   vsnap --image <name>     runs only the test with that image name
 *   vsnap --environment      also rewrites this package's environment fingerprint
 *
 * A run with no arguments, or with only `--sequence.shuffle` and its seed,
 * is a full run. In a full run every test runs, so a reference that no test
 * compared with belongs to a test that was renamed or deleted. The summary
 * lists those references and fails the run. An update run deletes them.
 *
 * On Windows, the script also reads the account's count of failed logons
 * before and after the run. Playwright's headless shell makes no logon
 * attempt. The full Chrome does, once for each new profile, and too many
 * failed logons lock the account. If a Playwright upgrade ever changed
 * that, this check is where it would show.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The project whose tests run. npm runs a package's scripts in its folder. */
const ROOT = process.cwd();
/** This package's Vitest config, which reads the project's `vsnap.config.ts`. */
const VITEST_CONFIG = join(import.meta.dirname, '..', 'vitest-config.ts');
// Node runs Vitest and Playwright directly, with no shell between them. A
// shell would split or reinterpret the arguments passed on, such as `-t`
// patterns and file filters.
const require = createRequire(import.meta.url);
const VITEST = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const PLAYWRIGHT = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
// Vitest loads this package's Vitest config and the project's vsnap.config.ts.
// Both are TypeScript, so Node runs Vitest with tsx's loader.
const TSX_LOADER = `--import=${pathToFileURL(require.resolve('tsx/esm')).href}`;
/** Arguments that change only the order the tests run in. A full run may have these. */
const ORDER_ONLY = /^(--sequence\.shuffle|--sequence\.seed(=\d+)?|\d+)$/;
/** By default, Windows locks an account after 10 failed logons. The run stops well short of that. */
const MAX_FAILED_LOGONS = 4;

const args = process.argv.slice(2);
const mode = args.includes('--environment') ? 'environment' : args.includes('--update') ? 'update' : 'compare';
const vitestArgs: string[] = [];
const imageNames: string[] = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--update' || args[i] === '--environment') continue;
    if (args[i] === '--image') imageNames.push(args[++i]);
    else vitestArgs.push(args[i]);
}
// `--image SpinButtonView-stop` runs the tests that produce an image of that
// name, and a failure message suggests it. An image name has no spaces or
// shell characters. A `-t` pattern for the test's full name
// ('SpinButtonView > stop') would have them, and would lose them on the way
// through npm and a shell.
if (imageNames.length > 0) vitestArgs.push('-t', `(${imageNames.map(toImageNamePattern).join('|')})$`);
const isWatch = vitestArgs.includes('--watch');
const isFullRun = !isWatch && vitestArgs.every((arg) => ORDER_ONLY.test(arg));

const install = spawnSync(process.execPath, [PLAYWRIGHT, 'install', 'chromium-headless-shell'], { cwd: ROOT, stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status ?? 1);

const before = countFailedLogons();
if (before !== undefined && before >= MAX_FAILED_LOGONS) {
    console.error(`This account has ${before} failed logons, so no browser was launched. Wait for the lockout window to pass, then run again.`);
    process.exit(1);
}

const run = spawnSync(
    process.execPath,
    [TSX_LOADER, VITEST, ...(isWatch ? [] : ['run']), '--config', VITEST_CONFIG, ...vitestArgs.filter((a) => a !== '--watch')],
    {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, VSNAP_MODE: mode, VSNAP_FULL_RUN: isFullRun ? '1' : '', VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
    },
);

const after = countFailedLogons();
if (before !== undefined && after !== undefined && after > before) {
    console.warn(`\nWarning: this account's failed logons rose from ${before} to ${after} during the run. The browser may be testing a new profile's password. Do not repeat the run until this is understood.\n`);
}
process.exit(run.status ?? 1);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Returns a pattern that matches the full names of the tests that produce an
 * image of this name. Where the image name has a hyphen, the test's name may
 * have any run of characters that are not letters, digits or dots. This is
 * the inverse of `toImageName` in `src/browser/image-name.ts`.
 */
function toImageNamePattern(imageName: string): string {
    return imageName.split('-').map((part) => part.replaceAll('.', '\\.')).join('[^A-Za-z0-9.]+');
}

/**
 * Returns the Windows account's count of failed logons, which can be read
 * without admin rights. On other systems, it returns undefined.
 */
function countFailedLogons(): number | undefined {
    if (process.platform !== 'win32') return undefined;
    const result = spawnSync('powershell', [
        '-NoProfile', '-Command',
        '([ADSI]"WinNT://$env:COMPUTERNAME/$env:USERNAME,user").BadPasswordAttempts',
    ], { encoding: 'utf8' });
    const count = Number(result.stdout.trim());
    return Number.isFinite(count) && result.status === 0 ? count : undefined;
}
