import { estimateFrameBudgetMs } from './estimate-frame-budget-ms';
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
 * `missedShare` compares the frames in each window with the frames the
 * display could have shown. Time lost after a frame whose own work took half
 * its budget or more is put down to that work, so what's left was lost
 * somewhere else. It doesn't judge frames one by one, because a browser that's
 * falling behind doesn't always miss a whole frame at a time. Nothing is
 * counted in the first window, because the display's frame rate isn't known
 * yet. If frames have been slow since the meter started, it only knows the
 * display's rate as closely as `estimateFrameBudgetMs` can guess it.
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
    // Frames in the window, not counting a gap from a hidden page, and how much time such gaps took
    let windowShownFrames = 0;
    let windowPausedMs = 0;
    // Frames lost to frames' own work
    let windowExplainedFrames = 0;
    // The start of the frame in progress, or -1 between a frame's end and the next one's start
    let frameStartMs = -1;
    // The last frame's start, and how long its work took, or -1 if it never finished
    let lastFrameStartMs = -1;
    let lastFrameBusyMs = -1;
    // The time a frame has. Nothing can be missed until the first window says what that is.
    let budgetMs = Number.POSITIVE_INFINITY;
    // The first frame is sampled too, so the first window has counts
    let isFirstFrame = true;
    // Whether the tick counter is switched on for this sample frame
    let isSampling = false;

    return {
        get sampleCount() { return history.sampleCount; },
        get fps() { return history.fps; },
        get missedShare() { return history.missedShare; },
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
        if (lastFrameStartMs >= 0) noteGap(nowMs - lastFrameStartMs);
        frameStartMs = nowMs;
        lastFrameStartMs = nowMs;
        lastFrameBusyMs = -1;
        windowFrames++;
        if (isSampling) finishSample();
        const isWindowClosed = nowMs - windowStartMs >= windowMs;
        if (isWindowClosed) publish(nowMs);
        if (isWindowClosed || isFirstFrame) startSample();
        isFirstFrame = false;
    }

    function endFrame(): void {
        if (frameStartMs < 0) return;
        lastFrameBusyMs = performance.now() - frameStartMs;
        windowCpuMs += lastFrameBusyMs;
        windowCpuFrames++;
        frameStartMs = -1;
    }

    /** Notes the gap between the last frame and this one. A frame that never finished can't say how busy it was, so it takes the blame. */
    function noteGap(gapMs: number): void {
        if (gapMs >= LONGEST_GAP_MS) {
            windowPausedMs += gapMs;
            return;
        }
        windowShownFrames++;
        const wasBusy = lastFrameBusyMs < 0 || lastFrameBusyMs >= budgetMs * BUSY_SHARE_OF_BUDGET;
        if (wasBusy) windowExplainedFrames += Math.max(0, gapMs / budgetMs - 1);
    }

    /** The share of the frames the display could have shown in this window that went missing, with no busy frame to explain them. */
    function measureMissedShare(nowMs: number): number {
        const possibleFrames = (nowMs - windowStartMs - windowPausedMs) / budgetMs;
        const missedFrames = possibleFrames - windowShownFrames - windowExplainedFrames;
        return missedFrames < 1 ? 0 : missedFrames / possibleFrames;
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
        const missedShare = measureMissedShare(nowMs);
        if (windowCpuFrames > 0) cpuMs = windowCpuMs / windowCpuFrames;
        if (takeGpuMs !== undefined) gpuMs = takeGpuMs() ?? gpuMs;
        history.add({ fps, missedShare, cpuMs, gpuMs, ...sampled });
        budgetMs = estimateFrameBudgetMs(history);

        windowStartMs = nowMs;
        windowFrames = 1;
        windowCpuMs = 0;
        windowCpuFrames = 0;
        windowShownFrames = 0;
        windowPausedMs = 0;
        windowExplainedFrames = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 250;

/** How much of the budget a frame's work may take and still have left the main thread time to spare. */
const BUSY_SHARE_OF_BUDGET = 0.5;
/** A gap this long means the page was hidden, which stops frames, rather than that frames were missed. */
const LONGEST_GAP_MS = 1000;

/** The tick counts, as a record this file can update in place. */
type TickCountsRecord = { -readonly [K in keyof TickCounts]: number };

function copyCounts(from: TickCounts, to: TickCountsRecord): void {
    to.reads = from.reads;
    to.methodCalls = from.methodCalls;
    to.methodListRebuilds = from.methodListRebuilds;
    to.rebuildNodeVisits = from.rebuildNodeVisits;
}
