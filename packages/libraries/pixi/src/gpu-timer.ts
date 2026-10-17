import { type Renderer, RendererType, type WebGLRenderer } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Times each of a Pixi renderer's renders on the GPU. Give its `takeMedianMs`
 * to `createPerformanceMeter` (from `@mvtjs/utils`) as `takeGpuMs`.
 *
 * A render's time is an upper bound on the GPU's work, not a measure of it.
 * When the browser sends a frame's commands to the GPU in parts, the time
 * includes the GPU waiting for the rest, which can be CPU time. Some drivers
 * (NVIDIA's, measured) report 2 ms of mid-frame CPU work as 2 ms of GPU
 * time. That makes single frames' times erratic, so the median is taken
 * rather than the mean, which a few such frames would dominate.
 */
export interface GpuTimer {
    /** Returns the median of the times that came in since the last call, or `undefined` if none did. */
    readonly takeMedianMs: () => number | undefined;
    /** Stops timing, and releases the GPU's queries. */
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GpuTimerOptions {
    readonly renderer: Renderer;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a GPU timer for a Pixi renderer, which times each render from its
 * start to its end. Returns `undefined` where the GPU can't be timed. That
 * needs WebGL 2 with `EXT_disjoint_timer_query_webgl2`, which some browsers
 * withhold, and which is missing without hardware acceleration.
 */
export function createGpuTimer(options: GpuTimerOptions): GpuTimer | undefined {
    const { renderer } = options;
    if (renderer.type !== RendererType.WEBGL) return undefined;
    const gl = (renderer as WebGLRenderer).gl;
    if (!(gl instanceof WebGL2RenderingContext)) return undefined;
    const found: unknown = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!found) return undefined;
    const ext = found as TimerQueryExtension;

    const spare: WebGLQuery[] = [];
    const pending: WebGLQuery[] = [];
    let active: WebGLQuery | undefined;
    // This window's results, for the median. Sorted in place when taken
    const results = new Float64Array(MAX_RESULTS_PER_WINDOW);
    let resultCount = 0;

    const renderHooks = { prerender: begin, postrender: end };
    renderer.runners.prerender.add(renderHooks);
    renderer.runners.postrender.add(renderHooks);

    return {
        takeMedianMs() {
            if (resultCount === 0) return undefined;
            const window = results.subarray(0, resultCount).sort();
            const middle = resultCount >> 1;
            const medianMs = resultCount & 1 ? window[middle] : (window[middle - 1] + window[middle]) / 2;
            resultCount = 0;
            return medianMs;
        },
        destroy() {
            renderer.runners.prerender.remove(renderHooks);
            renderer.runners.postrender.remove(renderHooks);
            if (active !== undefined) gl.endQuery(ext.TIME_ELAPSED_EXT);
            for (let i = 0; i < pending.length; i++) gl.deleteQuery(pending[i]);
            for (let i = 0; i < spare.length; i++) gl.deleteQuery(spare[i]);
            if (active !== undefined) gl.deleteQuery(active);
        },
    };

    function begin(): void {
        collectResults();
        if (active !== undefined || pending.length >= MAX_PENDING_QUERIES) return;
        active = spare.pop() ?? gl.createQuery() ?? undefined;
        if (active !== undefined) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    }

    function end(): void {
        if (active === undefined) return;
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push(active);
        active = undefined;
    }

    /** A query's result arrives a few frames after the render it timed, so they're collected from a queue each frame. */
    function collectResults(): void {
        // A disjoint event (such as a GPU clock change) makes every query in
        // flight since the last check unreliable, finished or not. The flag
        // clears when read, so it is read once, and on a disjoint every
        // pending query is dropped unread
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The parts of `EXT_disjoint_timer_query_webgl2` used here. */
interface TimerQueryExtension {
    readonly TIME_ELAPSED_EXT: number;
    readonly GPU_DISJOINT_EXT: number;
}

/** Most queries left in flight at once. Frames past this go untimed until results arrive. */
const MAX_PENDING_QUERIES = 8;

/** Most results kept in a window for the median. Later ones in the window are dropped. */
const MAX_RESULTS_PER_WINDOW = 256;
