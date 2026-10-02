import { type Renderer, RendererType, type Ticker, UPDATE_PRIORITY, type WebGLRenderer } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A statistic tracked by `FrameStats`. */
export type FrameStatKind = 'fps' | 'cpu' | 'gpu' | 'reads' | 'methods' | 'rebuilds' | 'visits';

/**
 * Something that counts events while switched on, such as `@mvtjs/pixi`'s
 * `readCounter`. `FrameStats` switches it on for one frame in each
 * window and reports the count for that frame.
 */
export interface SampledCounter {
    isCounting: boolean;
    readonly count: number;
}

/**
 * Something that counts the scene passes' work while switched on, such as
 * `@mvtjs/pixi`'s `sceneCounter`. `FrameStats` samples it in the same frame as
 * the `SampledCounter`.
 */
export interface SampledSceneCounter {
    isCounting: boolean;
    readonly methodCalls: number;
    readonly walkRebuilds: number;
    readonly rebuildVisits: number;
}

/**
 * Frame timing for a running Pixi application: frames per second, main-thread
 * time per frame, and GPU time per frame where the browser can measure it.
 *
 * Values are averages over a short window (a quarter of a second by default),
 * published at the end of each window, so they are steady enough to read and
 * a view that shows them only changes when a window closes.
 *
 * This is instrumentation, not a model: it measures real elapsed time with
 * `performance.now()`, which is exactly what a model must never do. Keep it
 * out of anything that decides game state.
 */
export interface FrameStats {
    /** Counts published windows. Changes exactly when the values below change. */
    readonly sampleCount: number;
    /** Frames per second. */
    readonly fps: number;
    /**
     * Main-thread milliseconds per frame, from the start of the tick to the end
     * of Pixi's render: models, the update and refresh passes, and Pixi's own
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
     * Reads (or whatever `readCounter` counts) in one frame, sampled
     * once per window, or `undefined` without a `readCounter`.
     */
    readonly readsPerFrame: number | undefined;
    /**
     * Update and refresh methods the scene passes called in one frame,
     * sampled once per window, or `undefined` without a `sceneCounter`.
     */
    readonly methodsPerFrame: number | undefined;
    /**
     * Memoised walks the scene passes rebuilt in one frame, which is the
     * scene's churn, sampled with `methodsPerFrame`. Zero in a steady scene.
     */
    readonly rebuildsPerFrame: number | undefined;
    /** Nodes visited rebuilding those walks, sampled with `methodsPerFrame`. */
    readonly visitsPerFrame: number | undefined;
    /** How many recent windows `historyAt` holds. */
    readonly historyLength: number;
    /**
     * A recent window's value, oldest first, for `index` in
     * `[0, historyLength)`. `NaN` where there is no value yet, for the GPU
     * when it cannot be timed, for reads without a `readCounter`, and for
     * the scene passes' counts without a `sceneCounter`.
     */
    historyAt: (kind: FrameStatKind, index: number) => number;
    /** Stop measuring and release GPU queries. */
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FrameStatsOptions {
    readonly renderer: Renderer;
    /** The ticker that drives the application's frames. */
    readonly ticker: Ticker;
    /** Milliseconds per averaging window. Defaults to 250. */
    readonly windowMs?: number;
    /** How many windows to keep for `historyAt`. Defaults to 60. */
    readonly historyLength?: number;
    /** A counter to sample for `readsPerFrame`, e.g. `readCounter` from `@mvtjs/pixi`. */
    readonly readCounter?: SampledCounter;
    /**
     * A counter to sample for `methodsPerFrame`, `rebuildsPerFrame` and
     * `visitsPerFrame`, e.g. `sceneCounter` from `@mvtjs/pixi`.
     */
    readonly sceneCounter?: SampledSceneCounter;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFrameStats(options: FrameStatsOptions): FrameStats {
    const { renderer, ticker, readCounter, sceneCounter } = options;
    const windowMs = options.windowMs ?? 250;
    const historyLength = options.historyLength ?? 60;

    const gpuTimer = createGpuTimer(renderer);

    let sampleCount = 0;
    let fps = 0;
    let cpuMs = 0;
    let gpuMs: number | undefined;
    let readsPerFrame: number | undefined;
    let methodsPerFrame: number | undefined;
    let rebuildsPerFrame: number | undefined;
    let visitsPerFrame: number | undefined;

    // Ring buffers of published values; `historyStart` is the oldest.
    const histories: Readonly<Record<FrameStatKind, Float64Array>> = {
        fps: new Float64Array(historyLength).fill(NaN),
        cpu: new Float64Array(historyLength).fill(NaN),
        gpu: new Float64Array(historyLength).fill(NaN),
        reads: new Float64Array(historyLength).fill(NaN),
        methods: new Float64Array(historyLength).fill(NaN),
        rebuilds: new Float64Array(historyLength).fill(NaN),
        visits: new Float64Array(historyLength).fill(NaN),
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

    // Whether the counters are switched on for their sample frame, and their
    // counts when they were. The latest samples wait in `sampled*` for the
    // next publish, so every value changes together.
    let isSampling = false;
    let readsAtSampleStart = 0;
    let methodsAtSampleStart = 0;
    let rebuildsAtSampleStart = 0;
    let visitsAtSampleStart = 0;
    let sampledReads: number | undefined;
    let sampledMethods: number | undefined;
    let sampledRebuilds: number | undefined;
    let sampledVisits: number | undefined;

    // Runs before every other tick listener, so the frame's clock starts
    // before any model or view work.
    ticker.add(onTickStart, undefined, UPDATE_PRIORITY.INTERACTION + 1);
    const renderHooks = { prerender: onPrerender, postrender: onPostrender };
    renderer.runners.prerender.add(renderHooks);
    renderer.runners.postrender.add(renderHooks);

    const stats: FrameStats = {
        get sampleCount() { return sampleCount; },
        get fps() { return fps; },
        get cpuMs() { return cpuMs; },
        get gpuMs() { return gpuMs; },
        get readsPerFrame() { return readsPerFrame; },
        get methodsPerFrame() { return methodsPerFrame; },
        get rebuildsPerFrame() { return rebuildsPerFrame; },
        get visitsPerFrame() { return visitsPerFrame; },
        historyLength,
        historyAt(kind, index) {
            return histories[kind][(historyStart + index) % historyLength];
        },
        destroy() {
            ticker.remove(onTickStart);
            renderer.runners.prerender.remove(renderHooks);
            renderer.runners.postrender.remove(renderHooks);
            gpuTimer?.destroy();
            if (readCounter !== undefined) readCounter.isCounting = false;
            if (sceneCounter !== undefined) sceneCounter.isCounting = false;
        },
    };

    return stats;

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
        if (readCounter !== undefined) {
            readsAtSampleStart = readCounter.count;
            readCounter.isCounting = true;
        }
        if (sceneCounter !== undefined) {
            methodsAtSampleStart = sceneCounter.methodCalls;
            rebuildsAtSampleStart = sceneCounter.walkRebuilds;
            visitsAtSampleStart = sceneCounter.rebuildVisits;
            sceneCounter.isCounting = true;
        }
    }

    function finishSample(): void {
        isSampling = false;
        if (readCounter !== undefined) {
            readCounter.isCounting = false;
            sampledReads = readCounter.count - readsAtSampleStart;
        }
        if (sceneCounter !== undefined) {
            sceneCounter.isCounting = false;
            sampledMethods = sceneCounter.methodCalls - methodsAtSampleStart;
            sampledRebuilds = sceneCounter.walkRebuilds - rebuildsAtSampleStart;
            sampledVisits = sceneCounter.rebuildVisits - visitsAtSampleStart;
        }
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
        readsPerFrame = sampledReads;
        methodsPerFrame = sampledMethods;
        rebuildsPerFrame = sampledRebuilds;
        visitsPerFrame = sampledVisits;

        histories.fps[historyStart] = fps;
        histories.cpu[historyStart] = cpuMs;
        histories.gpu[historyStart] = gpuMs ?? NaN;
        histories.reads[historyStart] = readsPerFrame ?? NaN;
        histories.methods[historyStart] = methodsPerFrame ?? NaN;
        histories.rebuilds[historyStart] = rebuildsPerFrame ?? NaN;
        histories.visits[historyStart] = visitsPerFrame ?? NaN;
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
