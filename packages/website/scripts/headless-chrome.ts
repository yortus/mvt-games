/**
 * Headless Chrome, driven over the DevTools protocol, for the scripts that
 * photograph or time the site's pages.
 *
 * Every launch uses one profile, kept between runs in `node_modules/.cache/`.
 * Chrome 153 and later test a new profile's Windows password by logging in
 * with a blank one, which Windows counts as a failed logon; a fresh profile
 * per launch locks the account after a handful of runs. Launch sparingly
 * even so.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface HeadlessChrome {
    /** Sends a DevTools protocol command to the page, and returns its result. */
    send: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
    /** Evaluates an expression in the page, awaiting it if it is a promise, and returns its value. */
    evaluate: <T = unknown>(expression: string) => Promise<T>;
    /** Navigates the page, and waits for it to load. */
    navigate: (url: string) => Promise<void>;
    close: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function launchHeadlessChrome(): Promise<HeadlessChrome> {
    const profile = resolve(import.meta.dirname, '..', '..', '..', 'node_modules', '.cache', 'mvt-headless-chrome');
    mkdirSync(profile, { recursive: true });
    const portFile = join(profile, 'DevToolsActivePort');
    rmSync(portFile, { force: true });

    const chrome: ChildProcess = spawn(findChrome(), [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        // Draw WebGL on the GPU, as a visitor's browser would
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        'about:blank',
    ], { stdio: 'ignore' });

    const port = await waitFor('Chrome to start', () => (existsSync(portFile) ? readFileSync(portFile, 'utf8').split('\n')[0] : undefined));
    const targets = await waitFor('Chrome\'s page', async () => {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as { type: string; webSocketDebuggerUrl: string }[];
        return list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    });
    const socket = new WebSocket(targets);
    await new Promise((resolveOpen, rejectOpen) => {
        socket.addEventListener('open', resolveOpen);
        socket.addEventListener('error', rejectOpen);
    });

    let nextId = 1;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } };
        if (message.id === undefined) return;
        const call = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) call?.reject(new Error(message.error.message));
        else call?.resolve(message.result);
    });

    const browser: HeadlessChrome = {
        send(method, params = {}) {
            const id = nextId++;
            socket.send(JSON.stringify({ id, method, params }));
            return new Promise((resolveCall, rejectCall) => {
                pending.set(id, { resolve: resolveCall as (value: unknown) => void, reject: rejectCall });
            });
        },
        async evaluate(expression) {
            const { result, exceptionDetails } = await browser.send<{
                result: { value: unknown };
                exceptionDetails?: { exception?: { description?: string }; text: string };
            }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
            return result.value as never;
        },
        async navigate(url) {
            await browser.send('Page.navigate', { url });
            // A load event can belong to the page before, which may finish late, so wait
            // for the page now showing to be this one, and loaded
            const target = new URL(url).href;
            await waitFor(`${target} to load`, async () => {
                const page = await browser.evaluate<string>('document.readyState === "complete" ? location.href : ""');
                return page === target ? true : undefined;
            });
        },
        async close() {
            socket.close();
            chrome.kill();
        },
    };

    await browser.send('Page.enable');
    await browser.send('Runtime.enable');
    return browser;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Chrome, at `CHROME_PATH` or where Chrome or Edge installs. */
function findChrome(): string {
    const candidates = [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
    ];
    for (const candidate of candidates) {
        if (candidate !== undefined && existsSync(candidate)) return candidate;
    }
    throw new Error('No Chrome found: set CHROME_PATH');
}

/** Polls `read` until it returns a value, for up to ten seconds, waiting for `what`. */
async function waitFor<T>(what: string, read: () => T | undefined | Promise<T | undefined>): Promise<T> {
    for (let i = 0; i < 100; i++) {
        try {
            const value = await read();
            if (value !== undefined) return value;
        }
        catch {
            // Not up yet
        }
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error(`Timed out waiting for ${what}`);
}
