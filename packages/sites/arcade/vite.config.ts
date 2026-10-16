import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defaultClientConditions, defaultServerConditions, defineConfig, type HttpProxy, type Plugin } from 'vite';
import { entryFactsPlugin, spritesheetPlugin } from './scripts/index.ts';

const VITEPRESS_DEV_PORT = 5200;
/** The playground's own dev server (packages/sites/playground). */
const PLAYGROUND_DEV_PORT = 5300;
const SITE_ROOT = import.meta.dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so the site needs no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

/** The mode (`--mode https`) in which the dev server serves over HTTPS. */
const HTTPS_MODE = 'https';

/** Creates a plugin that redirects `/playground` to `/playground/`, so Vite serves its index.html. */
function trailingSlashPlugin(): Plugin {
    return {
        name: 'trailing-slash-rewrite',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/playground') {
                    res.writeHead(302, { 'Location': req.url + '/' });
                    res.end();
                    return;
                }
                next();
            });
        },
    };
}

/**
 * Answers a request the proxy cannot pass on, because the dev server behind
 * it is not running, with a page that says how to start it.
 */
function showNotRunning(proxy: HttpProxy.ProxyServer, title: string, server: string, command: string): void {
    proxy.on('error', (_err, _req, res) => {
        // A failed WebSocket upgrade gives a socket, not a response, and needs no page
        if (!('writeHead' in res)) return;
        const r = res as ServerResponse;
        r.writeHead(200, { 'Content-Type': 'text/html' });
        r.end([
            '<!doctype html><html><head><meta charset="UTF-8">',
            `<title>${title}</title></head>`,
            '<body style="background:#0d1117;color:#c9d1d9;font-family:system-ui;padding:80px;text-align:center">',
            `<h2>The ${server} is not running</h2>`,
            `<p style="margin-top:16px">Start it with: <code style="color:#58a6ff">${command}</code></p>`,
            '</body></html>',
        ].join(''));
    });
}

// The HTML pages sit at the site's root, beside src/, which they load as /src/...
export default defineConfig(({ mode }) => ({
    appType: 'mpa',
    root: SITE_ROOT,
    base: process.env.BASE_URL ?? '/',
    publicDir: false,
    plugins: [
        spritesheetPlugin(),
        entryFactsPlugin(),
        trailingSlashPlugin(),
        // `npm run dev:https` serves the site over HTTPS with a self-signed
        // certificate, so a phone on the network can play sound. Sound needs a
        // secure page, because only a secure page has `AudioWorklet`. Over
        // plain HTTP, only `localhost` is secure.
        mode === HTTPS_MODE ? basicSsl() : undefined,
    ],
    resolve: {
        conditions: [SOURCE_CONDITION, ...defaultClientConditions],
    },
    // Vitest lists the visual tests in Node, as `vitest list` and editors'
    // test explorers do, which resolves as a server does.
    ssr: {
        resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] },
    },
    // In development, requests for /docs go to VitePress's dev server, and
    // requests for the new playground to its own dev server. In production,
    // each writes static files to the top-level dist/, which Pages serves. The
    // site is at its root, the docs are in docs/, and the new playground is
    // in playground/next/.
    server: {
        proxy: {
            '/docs': {
                target: `http://localhost:${VITEPRESS_DEV_PORT}`,
                changeOrigin: true,
                configure: (proxy) => showNotRunning(proxy, 'Docs', 'VitePress dev server', 'npm run docs:dev'),
            },
            '/playground/next': {
                target: `http://localhost:${PLAYGROUND_DEV_PORT}`,
                changeOrigin: true,
                // Vite's own updates to the page, as files change
                ws: true,
                configure: (proxy) => showNotRunning(proxy, 'Playground', 'playground\'s dev server', 'npm run playground:dev'),
            },
        },
    },
    build: {
        outDir: resolve(SITE_ROOT, '../../../dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                'main': resolve(SITE_ROOT, 'index.html'),
                'playground': resolve(SITE_ROOT, 'playground/index.html'),
                'playground-sandbox': resolve(SITE_ROOT, 'playground/sandbox.html'),
            },
        },
    },
}));
