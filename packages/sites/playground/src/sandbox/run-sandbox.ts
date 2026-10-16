import type { Audio80, AudioControls } from '@mvtjs/audio';
import { createWebAudio80 } from '@mvtjs/audio/web';
import type { Project, StartOptions, StartResult } from '../project-api';
import type { ErrorPhase, HostMessage, SandboxMessage } from './messages';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How the sandbox reports to the playground's page. */
export interface SandboxReport {
    readonly post: (message: SandboxMessage) => void;
    /** An error's message, and its stack with each project file named by its path. */
    readonly describe: (error: unknown) => { readonly message: string; readonly stack: string };
}

/**
 * What a renderer gives the runner: what `start` is given besides the sound,
 * and the steps of a frame over the root the project's views go in.
 */
export interface RendererHost<O> {
    readonly startOptions: O;
    /** Calls `updateView` over the root. */
    readonly update: (deltaMs: number) => void;
    /** Calls `refreshView` over the root. */
    readonly refresh: () => void;
    /** Draws the frame, where the renderer draws to a canvas. */
    readonly render: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunSandboxOptions {
    readonly report: SandboxReport;
    /** The name of the project's `main.ts` in the import map. */
    readonly mainModule: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Runs a project in the sandbox. It loads `main.ts`, makes the renderer its
 * `project` asks for, calls `start`, and runs the MVT loop each frame: the
 * project's `update`, then `updateView` and `refreshView` over its root, then
 * a draw. The page pauses, steps and speeds it up with messages. An error
 * stops the loop, so the page does not fill with the same error sixty times
 * a second.
 */
export async function runSandbox(options: RunSandboxOptions): Promise<void> {
    const { report, mainModule } = options;
    const fail = (phase: ErrorPhase, error: unknown): void => report.post({ kind: 'error', phase, ...report.describe(error) });
    setInterval(() => report.post({ kind: 'heartbeat' }), HEARTBEAT_MS);

    let project: Project;
    try {
        const main = await import(/* @vite-ignore */ mainModule) as { project?: Project };
        if (main.project === undefined || typeof main.project.start !== 'function') {
            throw new Error('main.ts must export its `project`, made with definePixiProject, defineHtmlProject or defineThreeProject.');
        }
        project = main.project;
    }
    catch (error) {
        fail('load', error);
        return;
    }
    report.post({ kind: 'started' });

    const sound = createLazySound();
    let host: RendererHost<object>;
    let ticked: StartResult;
    try {
        host = await createRendererHost(project);
        const startOptions = Object.defineProperty({ ...host.startOptions }, 'sound', { get: sound.chip, enumerable: true });
        ticked = await (project.start as (o: StartOptions) => StartResult | Promise<StartResult>)(startOptions as StartOptions);
    }
    catch (error) {
        fail('start', error);
        return;
    }

    let isPaused = false;
    let speed = 1;
    let stepMs = 0;
    let lastTime: number | undefined;
    let frames = 0;
    window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (message.kind === 'pause') isPaused = true;
        else if (message.kind === 'resume') isPaused = false;
        else if (message.kind === 'step') stepMs += message.deltaMs;
        else if (message.kind === 'set-speed') speed = message.speed;
        else if (message.kind === 'set-background' && /^#[0-9a-f]{6}$/i.test(message.colour)) {
            document.documentElement.style.background = message.colour;
            document.body.style.background = message.colour;
        }
    });
    requestAnimationFrame(frame);

    function frame(time: number): void {
        const elapsed = lastTime === undefined ? 0 : Math.min(time - lastTime, MAX_FRAME_MS);
        lastTime = time;
        const deltaMs = isPaused ? stepMs : elapsed * speed;
        const isAdvancing = !isPaused || stepMs > 0;
        stepMs = 0;
        (globalThis as { __pgFrameStart?: number }).__pgFrameStart = performance.now();
        try {
            if (isAdvancing) {
                // A model from an old playground link may have no `update`
                if (typeof ticked?.update === 'function') ticked.update(deltaMs);
                sound.controls()?.update(deltaMs);
                host.update(deltaMs);
            }
            host.refresh();
            host.render();
            sound.controls()?.flush();
        }
        catch (error) {
            fail('frame', error);
            return;
        }
        frames += 1;
        if (frames === 1) report.post({ kind: 'first-frame' });
        requestAnimationFrame(frame);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEARTBEAT_MS = 500;
/** The longest frame the loop advances by, so a tab left in the background does not jump ahead. */
const MAX_FRAME_MS = 100;

/** Makes the renderer the project asks for. Each is loaded only when a project uses it. */
async function createRendererHost(project: Project): Promise<RendererHost<object>> {
    switch (project.renderer) {
        case 'pixi': return (await import('./pixi-host')).createPixiHost(project);
        case 'html': return (await import('./html-host')).createHtmlHost(project);
        case 'three': return (await import('./three-host')).createThreeHost(project);
    }
}

/** The project's Audio80, made the first time `sound` is read. */
function createLazySound(): { chip: () => Audio80; controls: () => AudioControls | undefined } {
    let controls: AudioControls | undefined;
    let audio80: Audio80 | undefined;
    return {
        chip() {
            if (audio80 === undefined) {
                const chip = createWebAudio80({ context: new AudioContext() });
                audio80 = chip.audio80;
                controls = chip.controls;
            }
            return audio80;
        },
        controls: () => controls,
    };
}
