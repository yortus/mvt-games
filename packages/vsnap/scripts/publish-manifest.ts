/**
 * Swaps the package's `package.json` for the published one while npm packs
 * it, and back afterwards.
 *
 * In this repository, each entry point in `exports` names its TypeScript
 * source, so nothing needs building to run the tests, and a Vitest config
 * can import `vsnap/vitest` by name. Node runs TypeScript itself, but never
 * inside `node_modules`, so the published package names the built files in
 * `lib/` instead, with their declarations.
 *
 * Usage, from the package's scripts:
 *   node scripts/publish-manifest.ts apply      (prepack, after the build)
 *   node scripts/publish-manifest.ts restore    (postpack)
 *
 * `apply` keeps the repository's file beside it, writes the published one,
 * and checks the package with publint and attw, packed as npm will pack it.
 * `restore` puts the repository's file back.
 *
 * npm publish reads `package.json` again after packing, and sends that copy
 * to the registry as the version's metadata. So the registry's copy names
 * the source, while the tarball's, which installs use, names `lib/`.
 * Waiting for postpublish would fix that, but npm skips postpublish when a
 * publish fails or is refused, and the published file would be left in the
 * repository, where it would break the tests.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage, createPackageFromTarballData } from '@arethetypeswrong/core';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';

const PACKAGE_DIR = join(import.meta.dirname, '..');
const MANIFEST = join(PACKAGE_DIR, 'package.json');
/** Where the repository's `package.json` waits while the published one is in place. Not packed, since `files` doesn't list it. */
const KEPT = join(PACKAGE_DIR, 'package.repo.json');

const command = process.argv[2];
if (command === 'apply') await apply();
else if (command === 'restore') restore();
else throw new Error(`Unknown command ${JSON.stringify(command)}: use apply or restore.`);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function apply(): Promise<void> {
    if (existsSync(KEPT)) throw new Error(`${KEPT} exists, from a pack that didn't finish. Rename it to package.json, then pack again.`);
    const text = readFileSync(MANIFEST, 'utf8');
    const manifest = JSON.parse(text) as { exports: Record<string, { default: string }> };
    const exports: Record<string, { types: string; default: string }> = {};
    for (const [path, entry] of Object.entries(manifest.exports)) {
        const built = entry.default.replace(/^\.\/src\//, './lib/').replace(/\.ts$/, '');
        exports[path] = { types: `${built}.d.ts`, default: `${built}.js` };
    }
    renameSync(MANIFEST, KEPT);
    writeFileSync(MANIFEST, `${JSON.stringify({ ...manifest, exports }, undefined, 4)}\n`);
    try {
        await check();
    }
    catch (error) {
        restore();
        throw error;
    }
}

function restore(): void {
    if (existsSync(KEPT)) renameSync(KEPT, MANIFEST);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Checks the published package with publint and attw, as the `@mvtjs` libraries' builds do. */
async function check(): Promise<void> {
    const destination = mkdtempSync(join(tmpdir(), 'vsnap-pack-'));
    try {
        execFileSync('npm', ['pack', '--ignore-scripts', '--dry-run=false', '--pack-destination', destination], { cwd: PACKAGE_DIR, stdio: 'ignore', shell: true });
        const tarball = new Uint8Array(readFileSync(join(destination, readTarballName(destination))));
        const problems: string[] = [];
        const linted = await publint({ pack: { tarball: tarball.buffer }, strict: true });
        for (const message of linted.messages) {
            if (message.type !== 'suggestion') problems.push(`publint: ${formatMessage(message, linted.pkg) ?? message.code}`);
        }
        const typed = await checkPackage(createPackageFromTarballData(tarball));
        if (typed.types !== false) {
            // ESM only: the resolutions of Node 10 and CommonJS don't apply.
            for (const problem of typed.problems) {
                if ('resolutionKind' in problem && (problem.resolutionKind === 'node10' || problem.resolutionKind === 'node16-cjs')) continue;
                problems.push(`attw: ${problem.kind}${'entrypoint' in problem ? ` at ${problem.entrypoint}` : ''}`);
            }
        }
        else problems.push('attw: the package has no types');
        if (problems.length > 0) throw new Error(`The published package has problems:\n  ${problems.join('\n  ')}`);
        console.log('▸ The published package.json is in place, and publint and attw find no problems.');
    }
    finally {
        rmSync(destination, { recursive: true, force: true });
    }
}

function readTarballName(dir: string): string {
    const name = readdirSync(dir).find((file) => file.endsWith('.tgz'));
    if (name === undefined) throw new Error(`npm pack wrote no tarball to ${dir}.`);
    return name;
}
