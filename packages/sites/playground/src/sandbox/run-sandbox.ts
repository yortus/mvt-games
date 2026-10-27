import { createAudio80 } from 'audio90';
import { createPerformanceMeter, type PerformanceMeter, type PerformanceSample } from '@mvtjs/utils';
import type { Project, StartOptions, StartResult } from '../project-api';
import type { ErrorPhase, HostMessage, SandboxMessage } from './messages';
import type { RendererHost } from './renderer-host';
import { createLazySound } from './run-project';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How the sandbox reports to the playground's page. */
export interface SandboxReport {
    readonly post: (message: SandboxMessage) => void;
    /** An error's message, and its stack with each project file named by its path. */
    readonly describe: (error: unknown) => { readonly message: string; readonly stack: string };
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
 * a draw. It measures each frame, and sends the page its performance a few
 * times a second. The page pauses, steps and speeds it up with messages. An error
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

    // The chip makes its own audio context, and starts it at the first click or key press in the preview
    const sound = createLazySound(() => createAudio80());
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

    const meter = createPerformanceMeter({ takeGpuMs: host.takeGpuMs });
    let isPaused = false;
    let speed = 1;
    let stepMs = 0;
    let lastTime: number | undefined;
    let frames = 0;
    let sentSamples = 0;
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
        meter.startFrame();
        (globalThis as { __pgFrameStart?: number }).__pgFrameStart = performance.now();
        try {
            // The chip keeps the sound card's time, so it is paused while the project is
            if (isAdvancing) sound.controls()?.resume();
            else sound.controls()?.pause();
            if (isAdvancing) {
                // Type errors don't stop a project running, so its model may have no `update`
                if (typeof ticked?.update === 'function') ticked.update(deltaMs);
                host.update(deltaMs);
            }
            host.refresh();
            host.render();
            meter.endFrame();
        }
        catch (error) {
            fail('frame', error);
            return;
        }
        frames += 1;
        if (frames === 1) report.post({ kind: 'first-frame' });
        if (meter.sampleCount !== sentSamples) {
            sentSamples = meter.sampleCount;
            report.post({ kind: 'metrics', sample: toSample(meter) });
        }
        requestAnimationFrame(frame);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEARTBEAT_MS = 500;
/** The longest frame the loop advances by, so a tab left in the background does not jump ahead. */
const MAX_FRAME_MS = 100;

/** The meter's latest values, as a plain object a message can carry. */
function toSample(meter: PerformanceMeter): PerformanceSample {
    const { fps, cpuMs, gpuMs, reads, methodCalls, methodListRebuilds, rebuildNodeVisits } = meter;
    return { fps, cpuMs, gpuMs, reads, methodCalls, methodListRebuilds, rebuildNodeVisits };
}

/** Makes the renderer the project asks for. Each is loaded only when a project uses it. */
async function createRendererHost(project: Project): Promise<RendererHost<object>> {
    switch (project.renderer) {
        case 'pixi': return (await import('./pixi-host')).createPixiHost(project);
        case 'html': return (await import('./html-host')).createHtmlHost(project);
        case 'three': return (await import('./three-host')).createThreeHost(project);
    }
}
