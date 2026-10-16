import { type Renderer, RendererType, type Ticker, UPDATE_PRIORITY, type WebGLRenderer } from 'pixi.js';
import { tickCounter, type TickCounts } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A metric `PerformanceMetrics` tracks, named as its property. */
export type MetricKind = 'fps' | 'cpuMs' | 'gpuMs' | 'reads' | 'methodCalls' | 'methodListRebuilds' | 'rebuildNodeVisits';

/**
 * Performance metrics for a running Pixi application: frames per second,
 * main-thread and GPU time per frame where the browser can measure it, and
 * the work of each tick, from `tickCounter`: the reads the views make while
 * refreshing, the update and refresh methods called, and the method lists
 * rebuilt as the scene changes.
 *
 * Times are averages over a short window (a quarter of a second by default);
 * the tick counts come from one frame sampled in each window. Values are
 * published at the end of each window, so they are steady enough to read and
 * a view that shows them only changes when a window closes.
 *
 * This is instrumentation, not a model: it measures real elapsed time with
 * `performance.now()`, which is exactly what a model must never do. Keep it
 * out of anything that decides game state.
 */
export interface PerformanceMetrics {
    /** Counts published windows. Changes exactly when the values below change. */
    readonly sampleCount: number;
    /** Frames per second. */
    readonly fps: number;
    /**
     * Main-thread milliseconds per frame, from the start of the tick to the end
     * of Pixi's render: models, `updateView` and `refreshView`, and Pixi's own
     * work to submit the frame.
     */
    readonly cpuMs: number;
    /**
     * GPU milliseconds per frame: the median, over the window, of each
     * render's span on the GPU's clock. `undefined` when the renderer cannot
     * time the GPU: it needs WebGL 2 with `EXT_disjoint_timer_query_webgl2`,
     * which some browsers withhold, and which is absent without hardware
     * acceleration.
     *
     * A span is an upper bound on the GPU's work, not a measure of it. When
     * the browser sends the frame's commands to the GPU in parts, the span
     * includes the GPU waiting for the rest, which can be CPU time. Some
     * drivers (NVIDIA's, measured) report 2 ms of mid-frame CPU work as 2 ms
     * of GPU time. That makes individual frames' spans erratic, so the median
     * is reported rather than the mean, which a few such frames dominate.
     */
    readonly gpuMs: number | undefined;
    /**
     * Reads the views made in one frame, sampled once per window: what the JSX
     * runtime counts, and what hand-written views report with `addReads`. A
     * view that reports nothing counts as zero, so a host whose views do not
     * count their reads should not show this.
     */
    readonly reads: number;
    /** Update and refresh methods called in one frame, sampled with `reads`. */
    readonly methodCalls: number;
    /**
     * Method lists rebuilt in one frame, which is the scene's churn, sampled
     * with `reads`. Zero in a steady scene.
     */
    readonly methodListRebuilds: number;
    /** Node visits made rebuilding those method lists, sampled with `reads`. */
    readonly rebuildNodeVisits: number;
    /** How many recent windows `historyAt` holds. */
    readonly historyLength: number;
    /**
     * A recent window's value of a metric, oldest first, for `index` in
     * `[0, historyLength)`. `NaN` where there is no value yet, and for the GPU
     * when it cannot be timed.
     */
    historyAt: (kind: MetricKind, index: number) => number;
    /** Stop measuring and release GPU queries. */
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PerformanceMetricsOptions {
    readonly renderer: Renderer;
    /** The ticker that drives the application's frames. */
    readonly ticker: Ticker;
    /** Milliseconds per averaging window. Defaults to 250. */
    readonly windowMs?: number;
    /** How many windows to keep for `historyAt`. Defaults to 60. */
    readonly historyLength?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPerformanceMetrics(options: PerformanceMetricsOptions): PerformanceMetrics {
    const { renderer, ticker } = options;
    const windowMs = options.windowMs ?? 250;
    const historyLength = options.historyLength ?? 60;
    const gpuTimer = createGpuTimer(renderer);

    let sampleCount = 0;
    let fps = 0;
    let cpuMs = 0;
    let gpuMs: number | undefined;
    // The tick counts as published, as last sampled, and as the counter stood
    // when the sample began. The latest sample waits in `sampled` for the
    // next publish, so every value changes together.
    const published: TickCountsRecord = { reads: 0, methodCalls: 0, methodListRebuilds: 0, rebuildNodeVisits: 0 };
    const sampled: TickCountsRecord = { ...published };
    const atSampleStart: TickCountsRecord = { ...published };

    // Ring buffers of published values; `historyStart` is the oldest.
    const histories: Readonly<Record<MetricKind, Float64Array>> = {
        fps: new Float64Array(historyLength).fill(NaN),
        cpuMs: new Float64Array(historyLength).fill(NaN),
        gpuMs: new Float64Array(historyLength).fill(NaN),
        reads: new Float64Array(historyLength).fill(NaN),
        methodCalls: new Float64Array(historyLength).fill(NaN),
        methodListRebuilds: new Float64Array(historyLength).fill(NaN),
        rebuildNodeVisits: new Float64Array(historyLength).fill(NaN),
    };
    let historyStart = 0;

    // The window being accumulated.
    let windowStartMs = performance.now();
    let windowFrames = 0;
    let windowCpuMs = 0;
    let windowCpuFrames = 0;
    // Start of the frame in progress, or -1 between a render and the next tick.
    let frameStartMs = -1;
    // The first frame is sampled too, so the first window has counts.
    let isFirstTick = true;
    // Whether the tick counter is switched on for this sample frame.
    let isSampling = false;

    // Runs before every other tick listener, so the frame's clock starts
    // before any model or view work.
    ticker.add(onTickStart, undefined, UPDATE_PRIORITY.INTERACTION + 1);
    const renderHooks = { prerender: onPrerender, postrender: onPostrender };
    renderer.runners.prerender.add(renderHooks);
    renderer.runners.postrender.add(renderHooks);

    const metrics: PerformanceMetrics = {
        get sampleCount() { return sampleCount; },
        get fps() { return fps; },
        get cpuMs() { return cpuMs; },
        get gpuMs() { return gpuMs; },
        get reads() { return published.reads; },
        get methodCalls() { return published.methodCalls; },
        get methodListRebuilds() { return published.methodListRebuilds; },
        get rebuildNodeVisits() { return published.rebuildNodeVisits; },
        historyLength,
        historyAt(kind, index) {
            return histories[kind][(historyStart + index) % historyLength];
        },
        destroy() {
            ticker.remove(onTickStart);
            renderer.runners.prerender.remove(renderHooks);
            renderer.runners.postrender.remove(renderHooks);
            gpuTimer?.destroy();
            if (isSampling) tickCounter.isCounting = false;
        },
    };
    return metrics;

    // --- Frame hooks --------------------------------------------------------

    function onTickStart(): void {
        const nowMs = performance.now();
        frameStartMs = nowMs;
        windowFrames++;
        if (isSampling) finishSample();
        const isWindowClosed = nowMs - windowStartMs >= windowMs;
        if (isWindowClosed) publish(nowMs);
        if (isWindowClosed || isFirstTick) startSample();
        isFirstTick = false;
    }

    /** Count the frame that starts now: switched off again at the next tick. */
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

    function onPrerender(): void {
        gpuTimer?.begin();
    }

    function onPostrender(): void {
        gpuTimer?.end();
        if (frameStartMs < 0) return;
        windowCpuMs += performance.now() - frameStartMs;
        windowCpuFrames++;
        frameStartMs = -1;
    }

    // --- Publishing ---------------------------------------------------------

    function publish(nowMs: number): void {
        // The tick that closes a window was counted in it but not yet timed,
        // so the frame count covers one more frame interval than was measured.
        fps = ((windowFrames - 1) * 1000) / (nowMs - windowStartMs);
        if (windowCpuFrames > 0) cpuMs = windowCpuMs / windowCpuFrames;
        if (gpuTimer !== undefined) gpuMs = gpuTimer.takeMedianMs() ?? gpuMs;
        copyCounts(sampled, published);

        histories.fps[historyStart] = fps;
        histories.cpuMs[historyStart] = cpuMs;
        histories.gpuMs[historyStart] = gpuMs ?? NaN;
        histories.reads[historyStart] = published.reads;
        histories.methodCalls[historyStart] = published.methodCalls;
        histories.methodListRebuilds[historyStart] = published.methodListRebuilds;
        histories.rebuildNodeVisits[historyStart] = published.rebuildNodeVisits;
        historyStart = (historyStart + 1) % historyLength;
        sampleCount++;

        windowStartMs = nowMs;
        windowFrames = 1;
        windowCpuMs = 0;
        windowCpuFrames = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The tick counts, as a record this file can update in place. */
type TickCountsRecord = { -readonly [K in keyof TickCounts]: number };

function copyCounts(from: TickCounts, to: TickCountsRecord): void {
    to.reads = from.reads;
    to.methodCalls = from.methodCalls;
    to.methodListRebuilds = from.methodListRebuilds;
    to.rebuildNodeVisits = from.rebuildNodeVisits;
}

interface GpuTimer {
    begin: () => void;
    end: () => void;
    /** Median of the results that arrived since the last call, or undefined if none did. */
    takeMedianMs: () => number | undefined;
    destroy: () => void;
}

/** The parts of `EXT_disjoint_timer_query_webgl2` used here. */
interface TimerQueryExtension {
    readonly TIME_ELAPSED_EXT: number;
    readonly GPU_DISJOINT_EXT: number;
}

/** Most queries left in flight at once; frames past this go untimed until results arrive. */
const MAX_PENDING_QUERIES = 8;

/** Most results kept per window for the median; later ones in the window are dropped. */
const MAX_RESULTS_PER_WINDOW = 256;

/**
 * Times each render on the GPU with WebGL 2 timer queries, from the start of
 * the render to its end. A query's result arrives a few frames after the
 * render it timed, so results are collected from a queue each frame. Returns
 * undefined when the renderer cannot time the GPU.
 */
function createGpuTimer(renderer: Renderer): GpuTimer | undefined {
    if (renderer.type !== RendererType.WEBGL) return undefined;
    const gl = (renderer as WebGLRenderer).gl;
    if (!(gl instanceof WebGL2RenderingContext)) return undefined;
    const found: unknown = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!found) return undefined;
    const ext = found as TimerQueryExtension;

    const spare: WebGLQuery[] = [];
    const pending: WebGLQuery[] = [];
    let active: WebGLQuery | undefined;
    // This window's results, for the median. Sorted in place when taken.
    const results = new Float64Array(MAX_RESULTS_PER_WINDOW);
    let resultCount = 0;

    return {
        begin() {
            collectResults();
            if (active !== undefined || pending.length >= MAX_PENDING_QUERIES) return;
            active = spare.pop() ?? gl.createQuery() ?? undefined;
            if (active !== undefined) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
        },
        end() {
            if (active === undefined) return;
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            pending.push(active);
            active = undefined;
        },
        takeMedianMs() {
            if (resultCount === 0) return undefined;
            const window = results.subarray(0, resultCount).sort();
            const middle = resultCount >> 1;
            const medianMs = resultCount & 1 ? window[middle] : (window[middle - 1] + window[middle]) / 2;
            resultCount = 0;
            return medianMs;
        },
        destroy() {
            if (active !== undefined) gl.endQuery(ext.TIME_ELAPSED_EXT);
            for (let i = 0; i < pending.length; i++) gl.deleteQuery(pending[i]);
            for (let i = 0; i < spare.length; i++) gl.deleteQuery(spare[i]);
            if (active !== undefined) gl.deleteQuery(active);
        },
    };

    function collectResults(): void {
        // A disjoint event (such as a GPU clock change) makes every query in
        // flight since the last check unreliable, finished or not. The flag
        // clears when read, so it is read once, and on a disjoint every
        // pending query is dropped unread.
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
            while (pending.length > 0) spare.push(pending.shift()!);
            return;
        }
        while (pending.length > 0) {
            const query = pending[0];
            if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
            pending.shift();
            if (resultCount < MAX_RESULTS_PER_WINDOW) {
                results[resultCount++] = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
            }
            spare.push(query);
        }
    }
}
