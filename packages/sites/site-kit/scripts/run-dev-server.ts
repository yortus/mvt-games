/**
 * Serves every site in development from one server, on one port, so the links
 * between them work, and so they share one origin, as they do live: what the
 * visitor's browser keeps (the favourites, the saved games, the sound and the
 * theme) is shared by them all.
 *
 * Usage:  npm run dev                  (from the repo's root)
 *         npm run dev:https            over HTTPS, so a phone on the network gets sound
 *         npm run dev -- --port 5174   on another port
 *
 * Each site has its own Vite dev server, made from its own config, the one
 * its build uses, and mounted on this server under its own path, its Vite
 * base: `/arcade/`, `/demos/`, `/puzzles/`, `/playground/`, and `/docs/`,
 * which is VitePress's, which is Vite underneath. Their updates to the page,
 * as files change, share this server's WebSockets: each Vite takes only the
 * ones at its own base. The site's root, `/`, sends the visitor on to the
 * arcade, as the root's page does live.
 *
 * It starts nothing if the port is in use: a dev server is likely running
 * already. Even a second start that fails on its port would first rebuild the
 * dependencies the running one serves, which breaks it. To run one site
 * alone, use its own script, such as `npm run dev -w @mvtjs/demos`.
 */

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { getCertificate } from '@vitejs/plugin-basic-ssl';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { createServer as createVitePressServer } from 'vitepress';

// ---------------------------------------------------------------------------
// The sites
// ---------------------------------------------------------------------------

/** The sites' packages, beside the kit's. */
const SITES_DIR = resolve(import.meta.dirname, '..', '..');
/** 5173, Vite's own, unless `--port <port>` says otherwise. */
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 5173;
const isHttps = process.argv.includes('--https');

interface Site {
    /** Its name, for the output. */
    readonly name: string;
    /** Makes its Vite dev server, as middleware whose page updates go through `hmrServer`. */
    readonly create: (hmrServer: Server) => Promise<ViteDevServer>;
}

const SITES: readonly Site[] = [
    ...['arcade', 'demos', 'puzzles', 'playground'].map((name) => ({
        name,
        create: (hmrServer: Server) => createViteServer({
            configFile: join(SITES_DIR, name, 'vite.config.ts'),
            server: { middlewareMode: true, ws: { server: hmrServer } },
            configLoader: 'bundle',
        }),
    })),
    {
        name: 'docs',
        // VitePress makes its server again when its config changes, which the
        // mount below follows. It brings its own, older Vite, which reads this
        // option as `hmr`, not `ws`. Given `ws`, it would use port 24678 instead,
        // and a page would reload for ever if another server already held that port.
        create: (hmrServer: Server) => createVitePressServer(
            join(SITES_DIR, 'docs'),
            { middlewareMode: true, hmr: { server: hmrServer } },
            () => remount('docs'),
        ),
    },
];

/** The first site's page, where the root sends visitors. */
const HOME_PATH = '/arcade/';

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** Each site's Vite, by name, mounted under its base, and the base. */
const mounted = new Map<string, { readonly vite: ViteDevServer; readonly base: string }>();

if (await isPortInUse(PORT)) {
    console.error(`Port ${PORT} is in use, so a dev server is probably running already. Nothing was started.`);
    process.exit(1);
}

const server = isHttps
    ? createHttpsServer(await httpsOptions(), handle)
    : createHttpServer(handle);
for (const site of SITES) await mount(site);
server.listen(PORT, () => {
    const scheme = isHttps ? 'https' : 'http';
    console.log(`\nEvery site on one server, at ${scheme}://localhost:${PORT}${HOME_PATH}`);
    for (const [name, { base }] of mounted) console.log(`  ${name.padEnd(10)} ${scheme}://localhost:${PORT}${base}`);
    for (const address of networkAddresses()) console.log(`  on the network: ${scheme}://${address}:${PORT}${HOME_PATH}`);
    console.log('Ctrl+C stops it.\n');
});
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Sends each request to the site whose base it is under. */
function handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
        redirect(res, HOME_PATH + url.search);
        return;
    }
    for (const { vite, base } of mounted.values()) {
        // A site's own path without its slash gains it, as on Pages
        if (url.pathname === base.slice(0, -1)) {
            redirect(res, base + url.search);
            return;
        }
        if (url.pathname.startsWith(base)) {
            vite.middlewares(req, res, () => notFound(res));
            return;
        }
    }
    notFound(res);
}

async function mount(site: Site): Promise<void> {
    const vite = await site.create(server);
    mounted.set(site.name, { vite, base: vite.config.base });
}

/** Mounts a site's server again, once VitePress has made it anew. */
async function remount(name: string): Promise<void> {
    const site = SITES.find((s) => s.name === name);
    const old = mounted.get(name);
    if (site === undefined) return;
    await old?.vite.close();
    await mount(site);
}

async function stop(): Promise<void> {
    await Promise.all([...mounted.values()].map(({ vite }) => vite.close()));
    server.close();
    process.exit(0);
}

function redirect(res: ServerResponse, location: string): void {
    res.writeHead(302, { Location: location });
    res.end();
}

function notFound(res: ServerResponse): void {
    if (res.headersSent) return;
    res.writeHead(404, { 'Content-Type': 'text/html' });
    const links = [...mounted.values()].map(({ base }) => `<a style="color:#58a6ff" href="${base}">${base}</a>`).join(' · ');
    res.end(`<!doctype html><title>Not found</title><body style="background:#0d1117;color:#c9d1d9;font-family:system-ui;padding:80px;text-align:center">`
        + `<h2>Nothing here</h2><p>The sites are at ${links}</p></body>`);
}

/** A self-signed certificate for this machine, kept in the repo's Vite cache, as the sites' own `dev:https` makes. */
async function httpsOptions(): Promise<{ key: string; cert: string }> {
    const pem = await getCertificate(join(SITES_DIR, '..', '..', 'node_modules', '.vite', 'basic-ssl'));
    return { key: pem, cert: pem };
}

/** This machine's addresses on the local network, for a phone to reach it. */
function networkAddresses(): string[] {
    const addresses: string[] = [];
    for (const list of Object.values(networkInterfaces())) {
        for (const info of list ?? []) {
            if (info.family === 'IPv4' && !info.internal) addresses.push(info.address);
        }
    }
    return addresses;
}

/**
 * Whether something is listening on `port`, on this machine, over IPv4 or
 * IPv6: a server started for `localhost` may listen on either.
 */
async function isPortInUse(port: number): Promise<boolean> {
    return (await isListening(port, '127.0.0.1')) || (await isListening(port, '::1'));
}

function isListening(port: number, host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = connect({ port, host });
        socket.setTimeout(1000);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => resolve(false));
    });
}
