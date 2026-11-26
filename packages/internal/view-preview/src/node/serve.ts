// Serves the view preview for one package's visual tests:
//
//     npm run serve -w @mvtjs/view-preview -- --site puzzles --port 5190
//     npm run serve -w @mvtjs/view-preview -- --root packages/sites/site-kit --port 5192
//
// `--site` names one of the sites, and `--root` is any package's folder,
// absolute or from the repo's root. It
// starts a Vite server from the package's own `vite.config.ts`, if it has
// one, so the tests resolve and transform as they do in the package, with
// the preview's plugin added. A package without one gets a plain config that
// resolves the @mvtjs packages to their source, as the repo's Vitest config
// does. Each server keeps a dependency cache of its own, so it can't disturb
// a dev server or another preview server already running on the package.
// With `--port 0`, it
// listens on any free port. Once it's listening, it prints a line ending in the page's
// address, which the VS Code extension waits for. With `--exit-with-input`,
// it stops once its input closes.

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { createServer, defaultClientConditions } from 'vite';
import { PAGE, viewPreviewPlugin } from './view-preview-plugin.ts';

/** The `exports` condition under which each @mvtjs package resolves to its source. */
const SOURCE_CONDITION = '@mvtjs/source';

const { values } = parseArgs({ options: {
    'site': { type: 'string' },
    'root': { type: 'string' },
    'port': { type: 'string', default: '5190' },
    'exit-with-input': { type: 'boolean', default: false },
} });
const repoRoot = toUpperCaseDrive(resolve(import.meta.dirname, '../../../../..'));
const packageRoot = toUpperCaseDrive(values.root !== undefined ? resolve(repoRoot, values.root) : resolve(repoRoot, 'packages/sites', values.site ?? 'puzzles'));
const name = basename(packageRoot);
const viteConfig = resolve(packageRoot, 'vite.config.ts');
const cacheRoot = resolve(import.meta.dirname, '../../node_modules/.vite-view-preview');
removeStoppedCaches(cacheRoot);

const server = await createServer({
    configFile: existsSync(viteConfig) ? viteConfig : false,
    root: packageRoot,
    // Its own, so that a second server on the package, such as one VS Code started, can't change the cache under it
    cacheDir: resolve(cacheRoot, `${name}-${process.pid}`),
    resolve: { conditions: [SOURCE_CONDITION, ...defaultClientConditions] },
    server: { port: Number(values.port), strictPort: values.port !== '0', open: false },
    plugins: [viewPreviewPlugin({ packageRoot })],
});
await server.listen();
const address = server.resolvedUrls?.local[0] ?? `http://localhost:${values.port}${server.config.base}`;
process.stdout.write(`View preview for ${name}: ${address}${PAGE}/\n`);

// The extension starts the server with its input open, and the input closes
// when the extension stops, however it stops
if (values['exit-with-input']) {
    process.stdin.on('end', () => process.exit(0));
    process.stdin.resume();
}

/**
 * Deletes the dependency caches of servers that have stopped. Each server
 * names its cache for its package and its process, as `puzzles-1234`. A
 * server that VS Code stops can't clean up after itself, since Windows ends
 * it without running its exit handlers.
 */
function removeStoppedCaches(root: string): void {
    if (!existsSync(root)) return;
    for (const entry of readdirSync(root)) {
        const pid = Number(/-(\d+)$/.exec(entry)?.[1]);
        if (Number.isInteger(pid) && pid > 0 && !isRunning(pid)) rmSync(join(root, entry), { recursive: true, force: true });
    }
}

/** Returns whether a process is running. Signal 0 checks a process without sending it anything. */
function isRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        // EPERM means it's running, as another user's process
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}

/** Returns `path` with its drive letter in upper case, so Vite sees one file as one module. */
function toUpperCaseDrive(path: string): string {
    return path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
}
