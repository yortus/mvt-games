/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { spritesheetPlugin } from './scripts/vite-plugin-spritesheet';

const VITEPRESS_DEV_PORT = 5200;

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

export default defineConfig({
    appType: 'mpa',
    base: process.env.BASE_URL ?? '/',
    plugins: [spritesheetPlugin(), trailingSlashPlugin()],
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
        rollupOptions: {
            input: {
                'main': resolve(__dirname, 'index.html'),
                'games': resolve(__dirname, 'games/index.html'),
                'playground': resolve(__dirname, 'playground/index.html'),
                'playground-sandbox': resolve(__dirname, 'playground/sandbox.html'),
                'demos': resolve(__dirname, 'demos/index.html'),
            },
        },
    },
    // Vitest resolves solid-js to the SSR build (Node export condition) where
    // effects and memos are inert. Alias to the client runtime so benchmarks
    // measure real reactive propagation.
    test: {
        alias: {
            'solid-js': resolve(__dirname, 'node_modules/solid-js/dist/solid.js'),
        },
    },
});
