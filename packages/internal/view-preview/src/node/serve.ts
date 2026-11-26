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
// does. The server keeps its own dependency cache, so it can't disturb a dev
// server that's already running on the package. With `--port 0`, it
// listens on any free port. Once it's listening, it prints a line ending in the page's
// address, which the VS Code extension waits for. With `--exit-with-input`,
// it stops once its input closes.

import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
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

const server = await createServer({
    configFile: existsSync(viteConfig) ? viteConfig : false,
    root: packageRoot,
    cacheDir: resolve(import.meta.dirname, '../../node_modules/.vite-view-preview', name),
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

/** Returns `path` with its drive letter in upper case, so Vite sees one file as one module. */
function toUpperCaseDrive(path: string): string {
    return path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
}
