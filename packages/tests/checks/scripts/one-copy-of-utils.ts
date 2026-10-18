// Checks that the built site holds one copy of @mvtjs/utils: one in the
// Arcade's JavaScript, and one in the playground's. A second copy throws as
// it loads, so a build with two would ship a page that fails for every
// visitor. Vite's dev server and its build resolve packages differently, so
// a duplicate can appear in the build alone, with nothing seen in
// development. This repo's site is the nearest thing to a real project that
// uses the packages, so it is checked as it is deployed.
//
// It counts the key every copy records itself under, `mvtjs:copies`, which
// copies before 0.5 use too, across the emitted JavaScript in `dist/`.
// `npm run build` runs it after building the Arcade and the playground;
// `npm run check:one-copy-of-utils` runs it alone, once they are built.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/** What each copy's guard writes once, and no other module does. */
const MARKER = 'mvtjs:copies';

const dist = fileURLToPath(new URL('../../../../dist/', import.meta.url));
const sites: readonly { readonly name: string; readonly dir: string; readonly skip: readonly string[] }[] = [
    // The playground and the docs are built into folders of the Arcade's `dist/`
    { name: 'the Arcade', dir: dist, skip: ['playground', 'docs'] },
    { name: 'the playground', dir: join(dist, 'playground'), skip: [] },
];

const problems: string[] = [];
for (const site of sites) {
    const holders: string[] = [];
    let count = 0;
    for (const file of listScripts(site.dir, site.skip)) {
        const found = readFileSync(file, 'utf8').split(MARKER).length - 1;
        if (found === 0) continue;
        count += found;
        holders.push(`${file.slice(dist.length)} (${found})`);
    }
    if (count !== 1) problems.push(`${site.name} holds ${count} copies of @mvtjs/utils, not 1: ${holders.join(', ') || 'none found'}`);
    else console.log(`${site.name}: one copy of @mvtjs/utils, in ${holders[0]}`);
}

if (problems.length > 0) {
    for (const problem of problems) console.error(`One copy of @mvtjs/utils: ${problem}`);
    console.error('Build the site first (`npm run build`). Two copies throw as the page loads: see "Keep one copy" in @mvtjs/utils\'s README.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every `.js` file under `dir`, leaving out the folders at its top named in `skip`. */
function listScripts(dir: string, skip: readonly string[]): string[] {
    const files: string[] = [];
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    }
    catch {
        return files;
    }
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
        const path = join(entry.parentPath, entry.name);
        const top = path.slice(dir.length).split(/[\\/]/).find((step) => step !== '');
        if (top !== undefined && skip.includes(top)) continue;
        files.push(path);
    }
    return files;
}
