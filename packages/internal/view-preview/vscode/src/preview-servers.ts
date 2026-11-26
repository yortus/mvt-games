import { type ChildProcess, spawn } from 'node:child_process';
import process from 'node:process';
import type * as vscode from 'vscode';
import { findServerScript } from './preview-targets';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The preview's servers, one for each package that you've previewed a test of, started as they're first needed. */
export interface PreviewServers {
    /** Returns the address of the preview page for a package, once its server is listening. */
    readonly ensure: (packageRoot: string) => Promise<string>;
    readonly stopAll: () => void;
}

export interface PreviewServersOptions {
    /** Where the servers' output goes. */
    readonly output: vscode.OutputChannel;
    /** The Node.js to run the servers on, which must run TypeScript files. */
    readonly nodePath: () => string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPreviewServers(options: PreviewServersOptions): PreviewServers {
    const { output, nodePath } = options;
    const running = new Map<string, { readonly child: ChildProcess; readonly address: Promise<string> }>();

    const start = (packageRoot: string): Promise<string> => {
        const script = findServerScript(packageRoot);
        if (script === undefined) {
            return Promise.reject(new Error(`The view preview isn't installed where ${packageRoot} can reach it. Add @mvtjs/view-preview to its devDependencies.`));
        }
        output.appendLine(`Starting the view preview for ${packageRoot}`);
        // Any free port. The server stops when its input closes, so it can't
        // outlive the extension, even if VS Code closes without saying so.
        const child = spawn(nodePath(), [script, '--root', packageRoot, '--port', '0', '--exit-with-input'], { cwd: packageRoot, env: process.env, windowsHide: true });
        const address = new Promise<string>((resolve, reject) => {
            let printed = '';
            child.stdout.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                output.append(text);
                printed += text;
                const ready = READY_LINE.exec(printed);
                if (ready !== null) resolve(ready[1]);
            });
            child.stderr.on('data', (chunk: Buffer) => output.append(chunk.toString()));
            child.on('error', reject);
            child.on('exit', (code, signal) => {
                running.delete(packageRoot);
                output.appendLine(`The view preview for ${packageRoot} stopped, ${code === null ? `by ${signal ?? 'a signal'}` : `with exit code ${code}`}`);
                reject(new Error('The view preview\'s server stopped before it was ready. Its output is in the MVT View Preview panel.'));
            });
        });
        running.set(packageRoot, { child, address });
        return address;
    };

    return {
        ensure: (packageRoot) => running.get(packageRoot)?.address ?? start(packageRoot),
        stopAll: () => {
            running.forEach(({ child }) => child.kill());
            running.clear();
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The line the server prints once it's listening, which ends in the page's address. */
const READY_LINE = /View preview for [^:]*: (\S+)/;
