/**
 * Starts the three sites' dev servers together, so the links between them
 * work: the Arcade's, which sends /docs and /playground/ on to the other two
 * (`vite.config.ts`), VitePress's for the docs, and the playground's.
 *
 * Usage:  npm run dev            (from the repo's root)
 *         npm run dev:https      the Arcade over HTTPS, so a phone on the network gets sound
 *
 * Each line of output is labelled with the server it came from. Ctrl+C stops
 * all three, and so does any one of them stopping on its own, so they never
 * run in part.
 *
 * It starts nothing if any of the three ports is in use: a dev server is
 * likely running already. Even a second start that fails on its port would
 * first rebuild the dependencies the running one serves, which breaks it.
 * To run one site alone, use its own script, such as
 * `npm run dev -w @mvtjs/docs`.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { connect } from 'node:net';

// ---------------------------------------------------------------------------
// The servers
// ---------------------------------------------------------------------------

interface DevServer {
    /** Its label in the output. */
    readonly name: string;
    readonly workspace: string;
    readonly script: string;
    /** The port it listens on, as its own config sets it. */
    readonly port: number;
    /** Where to open it, once it is up. */
    readonly path: string;
}

const isHttps = process.argv.includes('--https');

const SERVERS: readonly DevServer[] = [
    // vite.config.ts in the Arcade: Vite's default port
    { name: 'arcade', workspace: '@mvtjs/arcade', script: isHttps ? 'dev:https' : 'dev', port: 5173, path: '/arcade/' },
    // The docs' package.json (`--port 5200`), which the Arcade's proxy sends /docs to
    { name: 'docs', workspace: '@mvtjs/docs', script: 'dev', port: 5200, path: '/docs/' },
    // The playground's vite.config.ts, which the Arcade's proxy sends /playground/ to
    { name: 'playground', workspace: '@mvtjs/playground', script: 'dev', port: 5300, path: '/playground/' },
];

/** A colour for each server's label: cyan, magenta and yellow. */
const COLOURS = ['\u001B[36m', '\u001B[35m', '\u001B[33m'];
const RESET = '\u001B[0m';
/** How long a server's exit waits to be told apart from Ctrl+C, which every process in a Windows console gets at once. */
const EXIT_GRACE_MS = 300;

const isWindows = process.platform === 'win32';
const children: ChildProcess[] = [];
let isStopping = false;

await main();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    const busy: DevServer[] = [];
    for (const server of SERVERS) {
        if (await isPortInUse(server.port)) busy.push(server);
    }
    if (busy.length > 0) {
        for (const server of busy) console.error(`Port ${server.port} is in use, so the ${server.name} dev server is probably running already.`);
        console.error('Nothing was started. Stop the running servers first, or use the ones that are up.');
        process.exitCode = 1;
        return;
    }

    const width = Math.max(...SERVERS.map((s) => s.name.length));
    for (let i = 0; i < SERVERS.length; i++) children.push(start(SERVERS[i], width, COLOURS[i % COLOURS.length]));

    const scheme = isHttps ? 'https' : 'http';
    console.log(`\nAll three through the Arcade's server: ${scheme}://localhost:${SERVERS[0].port}${SERVERS[0].path}`
        + ` (the docs at ${SERVERS[1].path}, the playground at ${SERVERS[2].path}). Ctrl+C stops all three.\n`);

    // On Windows, Ctrl+C reaches every process in the console, the servers
    // among them. Elsewhere each server is in a group of its own, so it is
    // passed on to them.
    process.on('SIGINT', () => stopAll(0));
    process.on('SIGTERM', () => stopAll(0));
}

/** Starts a server, with each line of its output labelled with its name. */
function start(server: DevServer, width: number, colour: string): ChildProcess {
    // One command for a shell, since npm is a script on Windows, which only a shell runs. Its parts are this file's own names
    const child = spawn(`npm run ${server.script} -w ${server.workspace}`, {
        shell: true,
        // Its own group, outside Windows, so the whole of it can be stopped
        detached: !isWindows,
        // No input: three servers reading one terminal's keys would fight over them
        stdio: ['ignore', 'pipe', 'pipe'],
        // Colours, though the output is piped
        env: { ...process.env, FORCE_COLOR: '1' },
    });
    const label = `${colour}${server.name.padEnd(width)}${RESET} | `;
    labelLines(child.stdout ?? undefined, label, process.stdout);
    labelLines(child.stderr ?? undefined, label, process.stderr);
    child.on('exit', (code) => {
        // Ctrl+C may reach the server before this script hears of it
        setTimeout(() => {
            if (isStopping) return;
            console.error(`\nThe ${server.name} dev server stopped (exit code ${code ?? 'none'}), so the others are stopping too.`);
            stopAll(code === 0 ? 1 : (code ?? 1));
        }, EXIT_GRACE_MS);
    });
    return child;
}

/** Writes each whole line from `input` to `output`, after `label`. */
function labelLines(input: NodeJS.ReadableStream | undefined, label: string, output: NodeJS.WritableStream): void {
    if (input === undefined) return;
    let partial = '';
    input.setEncoding('utf8');
    input.on('data', (chunk: string) => {
        const lines = (partial + chunk).split(/\r?\n/);
        partial = lines.pop() ?? '';
        for (const line of lines) output.write(`${label}${line}\n`);
    });
    input.on('end', () => {
        if (partial !== '') output.write(`${label}${partial}\n`);
    });
}

/** Stops every server still running, then exits. */
function stopAll(exitCode: number): void {
    if (isStopping) return;
    isStopping = true;
    for (const child of children) {
        if (child.pid === undefined || child.exitCode !== null) continue;
        try {
            // The whole tree: the shell, npm, and the server it started
            if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
            else process.kill(-child.pid, 'SIGTERM');
        }
        catch {
            // It has already gone
        }
    }
    process.exitCode = exitCode;
    // Leave once the output has drained, and the servers have had a moment to go
    setTimeout(() => process.exit(exitCode), 500);
}

/**
 * Whether something is listening on `port`, on this machine, over IPv4 or
 * IPv6: a server started for `localhost` may listen on either, as VitePress
 * does on `::1`.
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
