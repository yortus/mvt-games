// Serves the view preview for one site's visual tests:
//
//     npm run serve -w @mvtjs/view-preview -- --site puzzles --port 5190
//
// It starts a Vite server from the site's own config, so the tests resolve
// and transform as they do in the site, with the preview's plugin added. It
// keeps its own dependency cache, so it can't disturb a dev server that's
// already running on the site.

import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { PAGE, viewPreviewPlugin } from './view-preview-plugin.ts';

const { values } = parseArgs({ options: { site: { type: 'string', default: 'puzzles' }, port: { type: 'string', default: '5190' } } });
const site = values.site;
const port = Number(values.port);
const repoRoot = resolve(import.meta.dirname, '../../../../..').replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const packageRoot = resolve(repoRoot, 'packages/sites', site);

const server = await createServer({
    configFile: resolve(packageRoot, 'vite.config.ts'),
    cacheDir: resolve(import.meta.dirname, '../../node_modules/.vite-view-preview', site),
    server: { port, strictPort: true, open: false },
    plugins: [viewPreviewPlugin({ packageRoot })],
});
await server.listen();
const base = server.config.base;
process.stdout.write(`View preview for ${site}: http://localhost:${port}${base}${PAGE}/\n`);
