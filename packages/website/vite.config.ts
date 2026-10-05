import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';
import { defaultClientConditions, defineConfig, type Plugin } from 'vite';
import { entryFactsPlugin } from './scripts/vite-plugin-entry-facts';
import { spritesheetPlugin } from './scripts/vite-plugin-spritesheet';

const VITEPRESS_DEV_PORT = 5200;
const SITE_ROOT = __dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so the site needs no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

/** Redirect `/playground`, `/games`, `/demos` and `/arcade` to their trailing-slash equivalents so Vite serves the index.html. */
function trailingSlashPlugin(): Plugin {
    return {
        name: 'trailing-slash-rewrite',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/playground' || req.url === '/games' || req.url === '/demos' || req.url === '/arcade') {
                    res.writeHead(302, { 'Location': req.url + '/' });
                    res.end();
                    return;
                }
                next();
            });
        },
    };
}

// The HTML pages sit at the site's root, beside src/, which they load as /src/...
export default defineConfig({
    appType: 'mpa',
    root: SITE_ROOT,
    base: process.env.BASE_URL ?? '/',
    publicDir: false,
    plugins: [
        spritesheetPlugin(),
        entryFactsPlugin(),
        trailingSlashPlugin(),
    ],
    resolve: {
        conditions: [SOURCE_CONDITION, ...defaultClientConditions],
    },
    // Dev-only: proxy /docs requests to VitePress's dev server.
    // In production, both Vite and VitePress output static files to the
    // top-level dist/, the Pages output: the site at its root, the docs in docs/.
    server: {
        proxy: {
            '/docs': {
                target: `http://localhost:${VITEPRESS_DEV_PORT}`,
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', (_err, _req, res) => {
                        const r = res as ServerResponse;
                        r.writeHead(200, { 'Content-Type': 'text/html' });
                        r.end([
                            '<!doctype html><html><head><meta charset="UTF-8">',
                            '<title>Docs</title></head>',
                            '<body style="background:#0d1117;color:#c9d1d9;font-family:system-ui;padding:80px;text-align:center">',
                            '<h2>VitePress dev server is not running</h2>',
                            `<p style="margin-top:16px">Start it with: <code style="color:#58a6ff">npm run docs:dev</code></p>`,
                            '</body></html>',
                        ].join(''));
                    });
                },
            },
        },
    },
    build: {
        outDir: resolve(SITE_ROOT, '../../dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                'main': resolve(SITE_ROOT, 'index.html'),
                'arcade': resolve(SITE_ROOT, 'arcade/index.html'),
                'games': resolve(SITE_ROOT, 'games/index.html'),
                'playground': resolve(SITE_ROOT, 'playground/index.html'),
                'playground-sandbox': resolve(SITE_ROOT, 'playground/sandbox.html'),
                'demos': resolve(SITE_ROOT, 'demos/index.html'),
                'demos-boids-3d': resolve(SITE_ROOT, 'demos/boids-3d/index.html'),
                'demos-fruit-machine': resolve(SITE_ROOT, 'demos/fruit-machine/index.html'),
            },
        },
    },
});
