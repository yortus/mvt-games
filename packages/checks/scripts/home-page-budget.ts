// Checks that the website's home page, the Arcade, stays light to load: the
// JavaScript it needs before its first paint must not include a renderer
// (Pixi or three.js), and must stay under a budget, gzipped. The Arcade shows
// cards, not entries: an entry's code, and the renderer it draws with, load
// only once it is launched, as dynamic imports. A static import of one, from
// anywhere the home page reaches, would bring it into the first load
// unnoticed, and the page would take seconds longer to appear.
//
// It builds the website in memory, as it is deployed, with its own Vite
// config, and walks the home page's chunks from its entry through their
// static imports, which the browser loads before the page runs. Dynamic imports are
// left out: they load later, on demand. `npm run build:website` runs it after
// building; `npm run check:home-page-budget` runs it alone.

import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import process from 'node:process';
import { build } from 'vite';

// ---------------------------------------------------------------------------
// The budget
// ---------------------------------------------------------------------------

/** The most JavaScript the home page may load before its first paint, gzipped, in bytes. */
const BUDGET_BYTES = 40 * 1024;

/** Packages the home page's first load must not include, and how their modules' paths show them. */
const FORBIDDEN: readonly { readonly name: string; readonly path: string }[] = [
    { name: 'pixi.js', path: '/node_modules/pixi.js/' },
    { name: 'three', path: '/node_modules/three/' },
    { name: '@mvtjs/pixi', path: '/packages/pixi/' },
    { name: '@mvtjs/three', path: '/packages/three/' },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const websiteRoot = fileURLToPath(new URL('../../website/', import.meta.url));
const homePage = websiteRoot + 'index.html';

const output = await build({
    configFile: websiteRoot + 'vite.config.ts',
    // How `vite build` loads it too, without the warning about the native loader
    configLoader: 'bundle',
    logLevel: 'error',
    build: { write: false },
});
const chunks = (Array.isArray(output) ? output : [output]).flatMap((o) => ('output' in o ? o.output : []));
const byName = new Map(chunks.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));

const entry = [...byName.values()].find((c) => c.isEntry && c.facadeModuleId !== null && normalise(c.facadeModuleId) === normalise(homePage));
if (entry === undefined) fail('found no chunk for the home page\'s entry');

// The home page's first load: its entry chunk and everything it imports statically
const loaded = new Set<string>();
const queue = [entry.fileName];
while (queue.length > 0) {
    const name = queue.pop()!;
    if (loaded.has(name)) continue;
    loaded.add(name);
    const chunk = byName.get(name);
    if (chunk === undefined) fail(`the home page imports ${name}, which the build did not make`);
    queue.push(...chunk.imports);
}

const problems: string[] = [];
let total = 0;
console.log('The home page\'s first load, gzipped:');
for (const name of [...loaded].sort()) {
    const chunk = byName.get(name)!;
    const size = gzipSync(chunk.code).length;
    total += size;
    console.log(`  ${(size / 1024).toFixed(1).padStart(6)} KB  ${name}`);
    for (const forbidden of FORBIDDEN) {
        const count = chunk.moduleIds.filter((id) => normalise(id).includes(forbidden.path)).length;
        if (count > 0) problems.push(`${name} includes ${forbidden.name} (${count} modules)`);
    }
}
console.log(`  ${(total / 1024).toFixed(1).padStart(6)} KB  in all, of a budget of ${(BUDGET_BYTES / 1024).toFixed(0)} KB`);
if (total > BUDGET_BYTES) problems.push(`its JavaScript is ${(total / 1024).toFixed(1)} KB gzipped, over the budget of ${(BUDGET_BYTES / 1024).toFixed(0)} KB`);

if (problems.length > 0) {
    console.error(`\nThe home page's first load is too heavy:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    console.error('\nLoad renderers and entry code with a dynamic import(), when an entry is launched.');
    process.exit(1);
}
console.log('\nThe home page\'s first load is within its budget, with no renderer in it.');

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A path with forward slashes, its drive letter in lower case, for comparing paths on any system. */
function normalise(path: string): string {
    return path.replaceAll('\\', '/').replace(/^[A-Z]:/, (drive) => drive.toLowerCase());
}

function fail(message: string): never {
    console.error(`home page budget: ${message}`);
    process.exit(1);
}
