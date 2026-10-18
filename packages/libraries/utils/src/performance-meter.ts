import { createPerformanceHistory, type PerformanceMetrics } from './performance-history';
import { tickCounter, type TickCounts } from './view-tick-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Performance metrics that a frame loop measures, by calling `startFrame` and
 * `endFrame` around each frame. Works with any renderer.
 *
 * Times are averages over a short window (a quarter of a second by default),
 * and the tick counts come from one frame sampled in each window. The values
 * are published when a window closes, so they're steady enough to read.
 *
 * This is instrumentation, not a model. It measures real elapsed time with
 * `performance.now()`, which a model must never do, so keep it out of
 * anything that decides game state.
 */
export interface PerformanceMeter extends PerformanceMetrics {
    /** Call at the start of each frame, before any model or view work. */
    readonly startFrame: () => void;
    /** Call once the frame has been drawn. */
    readonly endFrame: () => void;
    /** Stops measuring. Switches the tick counter off, if a sample left it on. */
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PerformanceMeterOptions {
    /** Milliseconds in each window. Defaults to 250. */
    readonly windowMs?: number;
    /** How many windows to keep for `historyAt`. Defaults to 60. */
    readonly historyLength?: number;
    /**
     * Returns the GPU's milliseconds per frame over the window just closed,
     * or `undefined` if no results came in, in which case the last value
     * stays. Called as each window closes. Without it, `gpuMs` is
     * `undefined`. `@mvtjs/pixi`'s `createGpuTimer` gives one for Pixi.
     */
    readonly takeGpuMs?: () => number | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a performance meter, which measures the frames of a loop that calls
 * its `startFrame` and `endFrame`.
 */
export function createPerformanceMeter(options: PerformanceMeterOptions = {}): PerformanceMeter {
    const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    const { takeGpuMs } = options;
    const history = createPerformanceHistory({ historyLength: options.historyLength });

    let gpuMs: number | undefined;
    let cpuMs = 0;
    // The tick counts as last sampled, and as the counter stood when the
    // sample began. The latest sample waits in `sampled` for the next
    // publish, so every value changes together.
    const sampled: TickCountsRecord = { reads: 0, methodCalls: 0, methodListRebuilds: 0, rebuildNodeVisits: 0 };
    const atSampleStart: TickCountsRecord = { ...sampled };

    // The window being measured
    let windowStartMs = performance.now();
    let windowFrames = 0;
    let windowCpuMs = 0;
    let windowCpuFrames = 0;
    // The start of the frame in progress, or -1 between a frame's end and the next one's start
    let frameStartMs = -1;
    // The first frame is sampled too, so the first window has counts
    let isFirstFrame = true;
    // Whether the tick counter is switched on for this sample frame
    let isSampling = false;

    return {
        get sampleCount() { return history.sampleCount; },
        get fps() { return history.fps; },
        get cpuMs() { return history.cpuMs; },
        get gpuMs() { return history.gpuMs; },
        get reads() { return history.reads; },
        get methodCalls() { return history.methodCalls; },
        get methodListRebuilds() { return history.methodListRebuilds; },
        get rebuildNodeVisits() { return history.rebuildNodeVisits; },
        historyLength: history.historyLength,
        historyAt: history.historyAt,
        startFrame,
        endFrame,
        destroy() {
            if (isSampling) tickCounter.isCounting = false;
            isSampling = false;
        },
    };

    function startFrame(): void {
        const nowMs = performance.now();
        frameStartMs = nowMs;
        windowFrames++;
        if (isSampling) finishSample();
        const isWindowClosed = nowMs - windowStartMs >= windowMs;
        if (isWindowClosed) publish(nowMs);
        if (isWindowClosed || isFirstFrame) startSample();
        isFirstFrame = false;
    }

    function endFrame(): void {
        if (frameStartMs < 0) return;
        windowCpuMs += performance.now() - frameStartMs;
        windowCpuFrames++;
        frameStartMs = -1;
    }

    /** Counts the frame that starts now. The counter is switched off again as the next frame starts. */
    function startSample(): void {
        isSampling = true;
        copyCounts(tickCounter, atSampleStart);
        tickCounter.isCounting = true;
    }

    function finishSample(): void {
        isSampling = false;
        tickCounter.isCounting = false;
        sampled.reads = tickCounter.reads - atSampleStart.reads;
        sampled.methodCalls = tickCounter.methodCalls - atSampleStart.methodCalls;
        sampled.methodListRebuilds = tickCounter.methodListRebuilds - atSampleStart.methodListRebuilds;
        sampled.rebuildNodeVisits = tickCounter.rebuildNodeVisits - atSampleStart.rebuildNodeVisits;
    }

    function publish(nowMs: number): void {
        // The frame that closes a window was counted in it, but not yet
        // timed, so the frame count covers one more interval than was measured
        const fps = ((windowFrames - 1) * 1000) / (nowMs - windowStartMs);
        if (windowCpuFrames > 0) cpuMs = windowCpuMs / windowCpuFrames;
        if (takeGpuMs !== undefined) gpuMs = takeGpuMs() ?? gpuMs;
        history.add({ fps, cpuMs, gpuMs, ...sampled });

        windowStartMs = nowMs;
        windowFrames = 1;
        windowCpuMs = 0;
        windowCpuFrames = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 250;

/** The tick counts, as a record this file can update in place. */
type TickCountsRecord = { -readonly [K in keyof TickCounts]: number };

function copyCounts(from: TickCounts, to: TickCountsRecord): void {
    to.reads = from.reads;
    to.methodCalls = from.methodCalls;
    to.methodListRebuilds = from.methodListRebuilds;
    to.rebuildNodeVisits = from.rebuildNodeVisits;
}
