// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A metric that `PerformanceMetrics` tracks, named as its property. */
export type MetricKind = 'fps' | 'cpuMs' | 'gpuMs' | 'reads' | 'methodCalls' | 'methodListRebuilds' | 'rebuildNodeVisits';

/** Every metric, in the order a Perfmon shows them. */
export const METRIC_KINDS: readonly MetricKind[] = ['fps', 'cpuMs', 'gpuMs', 'reads', 'methodCalls', 'methodListRebuilds', 'rebuildNodeVisits'];

/** One window's values: what `PerformanceMetrics` publishes each time a window closes. */
export interface PerformanceSample {
    /** Frames per second. */
    readonly fps: number;
    /** Main-thread milliseconds per frame, from the start of the tick to the end of the draw. */
    readonly cpuMs: number;
    /** GPU milliseconds per frame, or `undefined` where the GPU can't be timed. */
    readonly gpuMs: number | undefined;
    /** Values the views read in one frame. */
    readonly reads: number;
    /** Update and refresh methods called in one frame. */
    readonly methodCalls: number;
    /** Method lists rebuilt in one frame, which is the scene's churn. */
    readonly methodListRebuilds: number;
    /** Node visits made rebuilding those method lists. */
    readonly rebuildNodeVisits: number;
}

/**
 * Performance metrics for a running game or app: frames per second, CPU and
 * GPU time per frame, and the work of each tick, with a short history of
 * each. The values change together, a few times a second, each time a new
 * sample is published, so a view that shows them can redraw only when
 * `sampleCount` changes.
 *
 * `createPerformanceMeter` measures them from a frame loop.
 * `createPerformanceHistory` holds them where they were measured somewhere
 * else, such as in another frame or a worker.
 */
export interface PerformanceMetrics extends PerformanceSample {
    /** Counts the samples published. Changes exactly when the values change. */
    readonly sampleCount: number;
    /** How many recent samples `historyAt` holds. */
    readonly historyLength: number;
    /**
     * A recent sample's value of a metric, oldest first, for `index` in
     * `[0, historyLength)`. `NaN` where there is no value yet, and for the GPU
     * when it can't be timed.
     */
    readonly historyAt: (kind: MetricKind, index: number) => number;
}

/** Performance metrics that are given each sample, rather than measuring it. */
export interface PerformanceHistory extends PerformanceMetrics {
    /** Publishes a sample: its values become the current ones, and join the history. */
    readonly add: (sample: PerformanceSample) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PerformanceHistoryOptions {
    /** How many samples to keep for `historyAt`. Defaults to 60. */
    readonly historyLength?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates performance metrics that hold the samples they're given. Use it
 * where the measuring happens somewhere else, such as in an iframe, and the
 * samples arrive as messages. Until the first sample, every value is zero,
 * the GPU's is `undefined`, and the history is all `NaN`.
 */
export function createPerformanceHistory(options: PerformanceHistoryOptions = {}): PerformanceHistory {
    const historyLength = options.historyLength ?? DEFAULT_HISTORY_LENGTH;
    let sampleCount = 0;
    let latest: PerformanceSample = EMPTY_SAMPLE;
    // Ring buffers of published values; `historyStart` is the oldest
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

    return {
        get sampleCount() { return sampleCount; },
        get fps() { return latest.fps; },
        get cpuMs() { return latest.cpuMs; },
        get gpuMs() { return latest.gpuMs; },
        get reads() { return latest.reads; },
        get methodCalls() { return latest.methodCalls; },
        get methodListRebuilds() { return latest.methodListRebuilds; },
        get rebuildNodeVisits() { return latest.rebuildNodeVisits; },
        historyLength,
        historyAt(kind, index) {
            return histories[kind][(historyStart + index) % historyLength];
        },
        add(sample) {
            latest = sample;
            histories.fps[historyStart] = sample.fps;
            histories.cpuMs[historyStart] = sample.cpuMs;
            histories.gpuMs[historyStart] = sample.gpuMs ?? NaN;
            histories.reads[historyStart] = sample.reads;
            histories.methodCalls[historyStart] = sample.methodCalls;
            histories.methodListRebuilds[historyStart] = sample.methodListRebuilds;
            histories.rebuildNodeVisits[historyStart] = sample.rebuildNodeVisits;
            historyStart = (historyStart + 1) % historyLength;
            sampleCount++;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_HISTORY_LENGTH = 60;

const EMPTY_SAMPLE: PerformanceSample = {
    fps: 0,
    cpuMs: 0,
    gpuMs: undefined,
    reads: 0,
    methodCalls: 0,
    methodListRebuilds: 0,
    rebuildNodeVisits: 0,
};
