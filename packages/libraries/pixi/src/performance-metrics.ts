import { type Renderer, type Ticker, UPDATE_PRIORITY } from 'pixi.js';
import { createPerformanceMeter, type PerformanceMetrics } from '@mvtjs/utils';
import { createGpuTimer } from './gpu-timer';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Performance metrics for a running Pixi application, measured from its
 * ticker and renderer: frames per second, main-thread and GPU time per
 * frame where the browser can measure it, and the work of each tick, from
 * `tickCounter`. See `PerformanceMetrics` and `createPerformanceMeter`, from
 * `@mvtjs/utils`, for what each value means and how it's measured.
 *
 * The CPU time runs from the start of the tick to the end of Pixi's render:
 * the models, `updateView` and `refreshView`, and Pixi's own work to submit
 * the frame. The GPU time is the median of each render's time on the GPU's
 * clock. See `GpuTimer` for why it's an upper bound.
 */
export interface PixiPerformanceMetrics extends PerformanceMetrics {
    /** Stops measuring, and releases the GPU's queries. */
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PerformanceMetricsOptions {
    readonly renderer: Renderer;
    /** The ticker that drives the application's frames. */
    readonly ticker: Ticker;
    /** Milliseconds in each window. Defaults to 250. */
    readonly windowMs?: number;
    /** How many windows to keep for `historyAt`. Defaults to 60. */
    readonly historyLength?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates performance metrics for a Pixi application, which measure each frame its ticker runs. */
export function createPerformanceMetrics(options: PerformanceMetricsOptions): PixiPerformanceMetrics {
    const { renderer, ticker, windowMs, historyLength } = options;
    const gpuTimer = createGpuTimer({ renderer });
    const meter = createPerformanceMeter({ windowMs, historyLength, takeGpuMs: gpuTimer?.takeMedianMs });

    // Before every other tick listener, so the frame's clock starts before any model or view work
    ticker.add(meter.startFrame, undefined, UPDATE_PRIORITY.INTERACTION + 1);
    const renderHooks = { postrender: meter.endFrame };
    renderer.runners.postrender.add(renderHooks);

    return {
        get sampleCount() { return meter.sampleCount; },
        get fps() { return meter.fps; },
        get cpuMs() { return meter.cpuMs; },
        get gpuMs() { return meter.gpuMs; },
        get reads() { return meter.reads; },
        get methodCalls() { return meter.methodCalls; },
        get methodListRebuilds() { return meter.methodListRebuilds; },
        get rebuildNodeVisits() { return meter.rebuildNodeVisits; },
        historyLength: meter.historyLength,
        historyAt: meter.historyAt,
        destroy() {
            ticker.remove(meter.startFrame);
            renderer.runners.postrender.remove(renderHooks);
            gpuTimer?.destroy();
            meter.destroy();
        },
    };
}
