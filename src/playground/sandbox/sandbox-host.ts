// ---------------------------------------------------------------------------
// Sandbox host - manages the sandboxed iframe from the editor page
// ---------------------------------------------------------------------------

import type { HostMessage, SandboxMessage } from './messages';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SandboxHost {
    /** Mount the sandbox iframe into a container element. */
    mount(container: HTMLElement): void;

    /** Send model + view code to the sandbox for execution. */
    run(modelCode: string, viewCode: string, canvasWidth: number, canvasHeight: number): void;

    /** Stop the currently running session. */
    stop(): void;

    /** Pause the ticker. */
    pause(): void;

    /** Resume the ticker. */
    resume(): void;

    /** Set the ticker speed multiplier. */
    setSpeed(speed: number): void;

    /** Advance a single frame (only meaningful when paused). */
    step(deltaMs: number): void;

    /** Destroy and re-run with current code. */
    reset(modelCode: string, viewCode: string, canvasWidth: number, canvasHeight: number): void;

    /** Move keyboard focus to the sandbox iframe. */
    focus(): void;

    /** Register a listener for messages from the sandbox. */
    onMessage(handler: (msg: SandboxMessage) => void): void;

    /** Remove a previously registered listener. */
    offMessage(handler: (msg: SandboxMessage) => void): void;

    /** Destroy the sandbox iframe and clean up. */
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSandboxHost(): SandboxHost {
    let iframe: HTMLIFrameElement | undefined;
    let container: HTMLElement | undefined;
    const listeners: Set<(msg: SandboxMessage) => void> = new Set();
    let ready = false;
    let pendingMessages: HostMessage[] = [];

    // Watchdog state
    let watchdogInterval: ReturnType<typeof setInterval> | undefined;
    let awaitingPong = false;

    function onWindowMessage(event: MessageEvent<SandboxMessage>): void {
        // Only accept messages from our iframe
        if (!iframe || event.source !== iframe.contentWindow) return;
        const msg = event.data;
        if (!msg || typeof msg.kind !== 'string') return;

        if (msg.kind === 'ready') {
            ready = true;
            // Flush any pending messages
            for (let i = 0; i < pendingMessages.length; i++) {
                send(pendingMessages[i]);
            }
            pendingMessages = [];
        }

        if (msg.kind === 'pong') {
            awaitingPong = false;
        }

        // Notify listeners
        for (const listener of listeners) {
            listener(msg);
        }
    }

    function send(msg: HostMessage): void {
        if (!iframe?.contentWindow) return;
        if (!ready) {
            pendingMessages.push(msg);
            return;
        }
        iframe.contentWindow.postMessage(msg, '*');
    }

    function startWatchdog(): void {
        if (watchdogInterval) return;
        watchdogInterval = setInterval(() => {
            // Only ping when the sandbox is ready - otherwise there is
            // nothing to respond and we would falsely detect a timeout.
            if (!ready) return;

            if (awaitingPong) {
                // Sandbox is unresponsive - replace iframe
                awaitingPong = false;
                for (const listener of listeners) {
                    listener({
                        kind: 'error',
                        message: 'Sandbox timed out (possible infinite loop) - restarting...',
                        source: 'runtime',
                    });
                }
                replaceIframe();
                return;
            }
            awaitingPong = true;
            send({ kind: 'ping' });
        }, 3000);
    }

    function stopWatchdog(): void {
        if (watchdogInterval) {
            clearInterval(watchdogInterval);
            watchdogInterval = undefined;
        }
        awaitingPong = false;
    }

    function createIframe(): HTMLIFrameElement {
        const el = document.createElement('iframe');
        // allow-scripts: user code runs inside new Function()
        // allow-same-origin: needed so the iframe can load module scripts
        //   from the same Vite dev server / production host
        el.sandbox.add('allow-scripts');
        el.sandbox.add('allow-same-origin');
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.border = 'none';
        el.style.display = 'block';
        el.style.background = '#1a1a2e';
        el.tabIndex = 0;
        // Resolve sandbox.html relative to the playground page
        el.src = new URL('./sandbox.html', window.location.href).href;

        // Bridge Pixi DevTools: forward __PIXI_APP__ from iframe to parent
        // so browser extensions can discover the Pixi application.
        el.addEventListener('load', () => {
            try {
                const iframeWin = el.contentWindow as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                if (iframeWin) {
                    Object.defineProperty(window, '__PIXI_APP__', {
                        get() { return iframeWin.__PIXI_APP__; },
                        configurable: true,
                    });
                }
            }
            catch {
                // Cross-origin or security restriction - ignore
            }
        });

        return el;
    }

    function replaceIframe(): void {
        ready = false;
        pendingMessages = [];
        if (iframe && container) {
            container.removeChild(iframe);
        }
        iframe = createIframe();
        if (container) {
            container.appendChild(iframe);
        }
    }

    window.addEventListener('message', onWindowMessage);

    const host: SandboxHost = {
        mount(el: HTMLElement) {
            container = el;
            if (!iframe) {
                iframe = createIframe();
            }
            container.appendChild(iframe);
            startWatchdog();
        },

        run(modelCode, viewCode, canvasWidth, canvasHeight) {
            send({ kind: 'run', modelCode, viewCode, canvasWidth, canvasHeight });
        },

        focus() {
            iframe?.focus();
        },

        stop() {
            send({ kind: 'stop' });
        },

        pause() {
            send({ kind: 'pause' });
        },

        resume() {
            send({ kind: 'resume' });
        },

        setSpeed(speed) {
            send({ kind: 'set-speed', speed });
        },

        step(deltaMs) {
            send({ kind: 'step', deltaMs });
        },

        reset(modelCode, viewCode, canvasWidth, canvasHeight) {
            send({ kind: 'reset', modelCode, viewCode, canvasWidth, canvasHeight });
        },

        onMessage(handler) {
            listeners.add(handler);
        },

        offMessage(handler) {
            listeners.delete(handler);
        },

        destroy() {
            stopWatchdog();
            window.removeEventListener('message', onWindowMessage);
            if (iframe && container) {
                container.removeChild(iframe);
            }
            iframe = undefined;
            container = undefined;
            listeners.clear();
        },
    };

    return host;
}
