// ---------------------------------------------------------------------------
// Sandbox runner - executes inside the sandboxed iframe
// ---------------------------------------------------------------------------
// Receives model + view source code from the host page, transpiles via
// Sucrase, wires up the MVT ticker loop, and renders to a Pixi canvas.
// All errors and console output are forwarded to the host via postMessage.
// ---------------------------------------------------------------------------

import { Application, Container, Graphics, Text, Sprite, Texture, Rectangle, TextStyle } from 'pixi.js';
import { transform } from 'sucrase';
import type { HostMessage, SandboxMessage } from './messages';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendToHost(msg: SandboxMessage): void {
    window.parent.postMessage(msg, '*');
}

/** Strip import statements from user code and return cleaned source. */
function stripImports(code: string): string {
    // Remove `import ... from '...'` and `import '...'` lines
    return code.replace(/^\s*import\s+.*?['"].*?['"];?\s*$/gm, '// [import stripped]');
}

/** Transpile TypeScript to JavaScript using Sucrase (type-stripping only). */
function transpile(code: string, label: string): string | undefined {
    try {
        const cleaned = stripImports(code);
        const result = transform(cleaned, {
            transforms: ['typescript'],
            disableESTransforms: true,
        });
        return result.code;
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Try to extract line number from Sucrase error
        const lineMatch = msg.match(/\((\d+):\d+\)/);
        sendToHost({
            kind: 'error',
            message: `${label} transpilation error: ${msg}`,
            line: lineMatch ? Number(lineMatch[1]) : undefined,
            source: label === 'Model' ? 'model' : 'view',
        });
        return undefined;
    }
}

/**
 * Evaluate transpiled JS in a controlled scope.
 * Provides Pixi.js and utility globals. Returns an object containing
 * all top-level declarations that were explicitly assigned to `exports`.
 *
 * The user's code should define factory functions. We wrap it so that
 * top-level `function` and `const`/`let`/`var` declarations that match
 * expected names are captured.
 */
function evaluate(
    js: string,
    label: string,
    globals: Record<string, unknown>,
): Record<string, unknown> | undefined {
    try {
        // We wrap the user code so that declared functions are captured.
        // The wrapper provides a local `exports` object the user may use
        // (like `exports.createModel = ...`), but we also try to capture
        // well-known function names directly.
        const globalNames = Object.keys(globals);
        const globalValues = Object.values(globals);

        // Wrap in an IIFE that returns an exports object
        const wrapped = `
"use strict";
return (function(${globalNames.join(', ')}) {
    const __exports = {};
    ${js}
    // Capture conventionally named factories
    if (typeof createModel === 'function') __exports.createModel = createModel;
    if (typeof createView === 'function') __exports.createView = createView;
    return __exports;
})(${globalNames.map((_, i) => `arguments[${i}]`).join(', ')});
`;
        const fn = new Function(wrapped);
        const result = fn(...globalValues) as Record<string, unknown>;
        return result;
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sendToHost({
            kind: 'error',
            message: `${label} evaluation error: ${msg}`,
            source: label === 'Model' ? 'model' : 'view',
        });
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Console interception
// ---------------------------------------------------------------------------

const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

function interceptConsole(): void {
    const levels = ['log', 'warn', 'error'] as const;
    for (const level of levels) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (console as any)[level] = (...args: unknown[]) => {
            // Log to iframe's own console (visible in DevTools)
            originalConsole[level](...args);
            // Also forward to parent console so logs appear in the main
            // page context (easier to find in DevTools)
            try {
                (window.parent as any).console[level]('[sandbox]', ...args); // eslint-disable-line @typescript-eslint/no-explicit-any
            }
            catch {
                // Cross-origin restriction - ignore
            }
            sendToHost({
                kind: 'console',
                level,
                args: args.map((a) => {
                    try {
                        return typeof a === 'string' ? a : JSON.stringify(a);
                    }
                    catch {
                        return String(a);
                    }
                }),
            });
        };
    }
}

// ---------------------------------------------------------------------------
// Pixi application and session management
// ---------------------------------------------------------------------------

let app: Application | undefined;
let tickerCallback: ((delta: { deltaMS: number }) => void) | undefined;
let speedMultiplier = 1;
let paused = false;

/** Globals injected into user code scope. */
function createUserGlobals(): Record<string, unknown> {
    return {
        Container,
        Graphics,
        Text,
        Sprite,
        Texture,
        Rectangle,
        TextStyle,
        // We include a minimal watch implementation so users can use it
        watch: createWatch,
        // Allow view code to set the canvas background colour
        setBackground: (color: number) => {
            if (app) app.renderer.background.color = color;
        },
    };
}

/** Minimal watch implementation matching the project's watch utility. */
function createWatch<T extends Record<string, () => unknown>>(
    getters: T,
): { poll(): Record<string, { changed: boolean; value: unknown; previous: unknown }> } {
    const keys = Object.keys(getters);
    const reads = keys.map((k) => getters[k]);
    const state = reads.map(() => ({
        changed: false,
        value: undefined as unknown,
        previous: undefined as unknown,
    }));
    const watched = Object.fromEntries(keys.map((k, i) => [k, state[i]]));

    return {
        poll() {
            for (let i = 0; i < keys.length; ++i) {
                const next = reads[i]();
                const s = state[i];
                s.previous = s.value;
                s.changed = next !== s.value;
                if (s.changed) s.value = next;
            }
            return watched;
        },
    };
}

let canvasLogicalW = 400;
let canvasLogicalH = 300;

async function ensureApp(width: number, height: number): Promise<Application> {
    canvasLogicalW = width;
    canvasLogicalH = height;
    if (app) {
        app.renderer.resize(width, height);
        fitCanvas(app.canvas as HTMLCanvasElement);
        return app;
    }
    app = new Application();
    await app.init({
        width,
        height,
        backgroundColor: 0x1a1a2e,
        antialias: false,
        roundPixels: true,
    });
    // Reset background to default for each new app (presets may override via setBackground)
    app.renderer.background.color = 0x1a1a2e;
    document.body.appendChild(app.canvas);
    fitCanvas(app.canvas);
    // Expose for Pixi DevTools (accessible from parent via iframe.contentWindow)
    (window as any).__PIXI_APP__ = app; // eslint-disable-line @typescript-eslint/no-explicit-any
    window.addEventListener('resize', () => {
        if (app) fitCanvas(app.canvas as HTMLCanvasElement);
    });
    return app;
}

/** Size the canvas CSS to fill the body while preserving aspect ratio. */
function fitCanvas(canvas: HTMLCanvasElement): void {
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const scale = Math.min(availW / canvasLogicalW, availH / canvasLogicalH);
    const cssW = Math.floor(canvasLogicalW * scale);
    const cssH = Math.floor(canvasLogicalH * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.outline = '1px solid rgba(255, 255, 255, 0.15)';
}

function destroySession(): void {
    if (!app) return;
    if (tickerCallback) {
        app.ticker.remove(tickerCallback);
        tickerCallback = undefined;
    }
    // Remove all children from stage
    while (app.stage.children.length > 0) {
        const child = app.stage.children[0];
        app.stage.removeChild(child);
        child.destroy({ children: true });
    }
    app.ticker.stop();
}

async function runCode(
    modelCode: string,
    viewCode: string,
    canvasWidth: number,
    canvasHeight: number,
): Promise<void> {
    destroySession();

    // Transpile
    const modelJs = transpile(modelCode, 'Model');
    if (!modelJs) return;

    const viewJs = transpile(viewCode, 'View');
    if (!viewJs) return;

    const globals = createUserGlobals();

    // Evaluate model
    const modelExports = evaluate(modelJs, 'Model', globals);
    if (!modelExports) return;

    const createModelFn = modelExports.createModel;
    if (typeof createModelFn !== 'function') {
        sendToHost({
            kind: 'error',
            message: 'Model code must define a createModel() function',
            source: 'model',
        });
        return;
    }

    // Evaluate view
    const viewExports = evaluate(viewJs, 'View', globals);
    if (!viewExports) return;

    const createViewFn = viewExports.createView;
    if (typeof createViewFn !== 'function') {
        sendToHost({
            kind: 'error',
            message: 'View code must define a createView() function',
            source: 'view',
        });
        return;
    }

    // Wire up MVT
    const pixiApp = await ensureApp(canvasWidth, canvasHeight);

    let model: { update?: (deltaMs: number) => void };
    try {
        model = createModelFn() as { update?: (deltaMs: number) => void };
    }
    catch (err: unknown) {
        sendToHost({
            kind: 'error',
            message: `createModel() threw: ${err instanceof Error ? err.message : String(err)}`,
            source: 'model',
        });
        return;
    }

    let view: Container;
    try {
        view = createViewFn(model) as Container;
    }
    catch (err: unknown) {
        sendToHost({
            kind: 'error',
            message: `createView() threw: ${err instanceof Error ? err.message : String(err)}`,
            source: 'view',
        });
        return;
    }

    if (!(view instanceof Container)) {
        sendToHost({
            kind: 'error',
            message: 'createView() must return a Pixi Container',
            source: 'view',
        });
        return;
    }

    pixiApp.stage.addChild(view);

    // Ticker loop
    tickerCallback = (ticker) => {
        if (paused) return;
        try {
            if (typeof model.update === 'function') {
                model.update(ticker.deltaMS * speedMultiplier);
            }
        }
        catch (err: unknown) {
            sendToHost({
                kind: 'error',
                message: `Runtime error in model.update(): ${err instanceof Error ? err.message : String(err)}`,
                source: 'runtime',
            });
            // Stop the ticker to prevent error spam
            if (tickerCallback && pixiApp) {
                pixiApp.ticker.remove(tickerCallback);
                tickerCallback = undefined;
            }
        }
    };

    pixiApp.ticker.add(tickerCallback);
    paused = false;
    pixiApp.ticker.start();
    sendToHost({ kind: 'running' });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

function handleMessage(event: MessageEvent<HostMessage>): void {
    const msg = event.data;
    if (!msg || typeof msg.kind !== 'string') return;

    switch (msg.kind) {
        case 'run':
            runCode(msg.modelCode, msg.viewCode, msg.canvasWidth, msg.canvasHeight).catch(
                (err) => {
                    sendToHost({
                        kind: 'error',
                        message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
                        source: 'runtime',
                    });
                },
            );
            break;

        case 'stop':
            destroySession();
            sendToHost({ kind: 'stopped' });
            break;

        case 'pause':
            paused = true;
            break;

        case 'resume':
            paused = false;
            break;

        case 'set-speed':
            speedMultiplier = msg.speed;
            break;

        case 'step':
            if (app && tickerCallback) {
                paused = false;
                tickerCallback({ deltaMS: msg.deltaMs });
                paused = true;
                app.render();
            }
            break;

        case 'reset':
            runCode(msg.modelCode, msg.viewCode, msg.canvasWidth, msg.canvasHeight).catch(
                (err) => {
                    sendToHost({
                        kind: 'error',
                        message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
                        source: 'runtime',
                    });
                },
            );
            break;

        case 'ping':
            sendToHost({ kind: 'pong' });
            break;
    }
}

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

window.addEventListener('error', (event) => {
    sendToHost({
        kind: 'error',
        message: event.message || 'Unknown error',
        source: 'runtime',
    });
});

window.addEventListener('unhandledrejection', (event) => {
    sendToHost({
        kind: 'error',
        message: `Unhandled promise rejection: ${event.reason instanceof Error ? event.reason.message : String(event.reason)}`,
        source: 'runtime',
    });
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

interceptConsole();
window.addEventListener('message', handleMessage);
sendToHost({ kind: 'ready' });
