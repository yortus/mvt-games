/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';
import { defineConfig, normalizePath, type Plugin } from 'vite';
import { jsxPrecompilePlugin } from './scripts/vite-plugin-jsx-precompile';
import { spritesheetPlugin } from './scripts/vite-plugin-spritesheet';

const VITEPRESS_DEV_PORT = 5200;
const PROJECT_ROOT = __dirname;
const SITE_ROOT = resolve(PROJECT_ROOT, 'site');

/**
 * Whether to precompile JSX refresh factories at build time: opt in by
 * setting `MVT_JSX_PRECOMPILE=1` (or `true`). Only pages served with a
 * Content Security Policy that forbids `new Function` need it; everywhere
 * else the runtime generates the same code itself. It applies to `vite`,
 * `vite build` and the test runner alike.
 */
const IS_JSX_PRECOMPILED = ['1', 'true'].includes(process.env.MVT_JSX_PRECOMPILE ?? '');

/**
 * Refresh factories for JSX bindings, compiled at build time, so a page that
 * forbids `new Function` still gets generated code. None unless opted in. The
 * plugin finds each target's manifest itself, from a module's
 * `@jsxImportSource`, so nothing here names a target.
 */
function jsxPrecompilePlugins(): Plugin[] {
    return IS_JSX_PRECOMPILED ? [jsxPrecompilePlugin()] : [];
}

/** Redirect `/playground` and `/games` to their trailing-slash equivalents so Vite serves the index.html. */
function trailingSlashPlugin(): Plugin {
    return {
        name: 'trailing-slash-rewrite',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/playground' || req.url === '/games' || req.url === '/demos') {
                    res.writeHead(302, { 'Location': req.url + '/' });
                    res.end();
                    return;
                }
                next();
            });
        },
    };
}

// The HTML pages live in site/, which is Vite's root, so their URLs have no
// site/ prefix. The TypeScript stays in src/, which the pages load as /src/...
export default defineConfig({
    appType: 'mpa',
    root: SITE_ROOT,
    base: process.env.BASE_URL ?? '/',
    publicDir: false,
    plugins: [
        ...jsxPrecompilePlugins(),
        spritesheetPlugin({ projectRoot: PROJECT_ROOT }),
        trailingSlashPlugin(),
    ],
    resolve: {
        alias: [{ find: /^\/src\//, replacement: `${normalizePath(resolve(PROJECT_ROOT, 'src'))}/` }],
    },
    // Dev-only: proxy /docs requests to VitePress's dev server.
    // In production, both Vite and VitePress output static files to dist/.
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
        outDir: resolve(PROJECT_ROOT, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                'main': resolve(SITE_ROOT, 'index.html'),
                'games': resolve(SITE_ROOT, 'games/index.html'),
                'playground': resolve(SITE_ROOT, 'playground/index.html'),
                'playground-sandbox': resolve(SITE_ROOT, 'playground/sandbox.html'),
                'demos': resolve(SITE_ROOT, 'demos/index.html'),
                'demos-boids-3d': resolve(SITE_ROOT, 'demos/boids-3d/index.html'),
            },
        },
    },
    test: {
        root: PROJECT_ROOT,
        // Node resolves solid-js to its server build, where effects never
        // run. Tests get the browser build, as a page does, and Vite loads
        // solid-js and pixi-solid itself so that they share that one copy.
        alias: [
            { find: /^solid-js$/, replacement: resolve(PROJECT_ROOT, 'node_modules/solid-js/dist/solid.js') },
            { find: /^solid-js\/store$/, replacement: resolve(PROJECT_ROOT, 'node_modules/solid-js/store/dist/store.js') },
            { find: /^solid-js\/web$/, replacement: resolve(PROJECT_ROOT, 'node_modules/solid-js/web/dist/web.js') },
        ],
        server: { deps: { inline: ['solid-js', 'pixi-solid'] } },
    },
});
