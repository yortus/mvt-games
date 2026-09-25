import process from 'node:process';
import type { ParamValue } from './suite';

// ---------------------------------------------------------------------------
// Measurement helpers, for the measured file of a suite
// ---------------------------------------------------------------------------

// Each case runs in its own process: the driver passes its params as one JSON
// argument, and reads back one JSON line of metrics from stdout.

/** The params the driver passed to this process. */
export function readParams(): Record<string, ParamValue> {
    const arg = process.argv[2];
    if (arg === undefined) throw new Error('expected the case params as a JSON argument');
    return JSON.parse(arg) as Record<string, ParamValue>;
}

/** Report this case's metrics to the driver. Call exactly once. */
export function report(metrics: Record<string, number>): void {
    process.stdout.write(`${JSON.stringify(metrics)}\n`);
}

// --- Time -----------------------------------------------------------------

const WARMUP_MIN_MS = 300;
const WARMUP_MIN_FRAMES = 1000;
const BATCHES = 15;
const BATCH_TARGET_MS = 30;

/**
 * Median microseconds per frame. Warms up for at least 1000 frames and
 * 300 ms, then times 15 batches sized from the warm-up so that each lasts
 * about 30 ms, whether a frame costs 0.1 µs or 10 ms.
 */
export function timeFrames(frame: () => void): number {
    const framesPerMs = warmUp(frame);
    const batchFrames = Math.max(1, Math.round(framesPerMs * BATCH_TARGET_MS));
    const batches: number[] = [];
    for (let b = 0; b < BATCHES; b++) {
        const start = performance.now();
        for (let f = 0; f < batchFrames; f++) frame();
        batches.push(((performance.now() - start) * 1000) / batchFrames);
    }
    return median(batches);
}

// --- Allocation -----------------------------------------------------------

const ALLOCATION_WINDOWS = 5;

/**
 * Median bytes allocated on the JavaScript heap per frame, net of the
 * measurement's own overhead.
 *
 * Needs `--expose-gc`, and a young generation large enough that no garbage
 * collection runs inside a window (`--max-semi-space-size=128`): heap growth
 * over the window is then exactly what was allocated. A window in which a
 * collection did run is detected and retried with fewer frames.
 */
export async function allocationPerFrame(frame: () => void): Promise<number> {
    requireGc();
    warmUp(frame);
    const baseline = await allocationOf(noop, 10000);
    return Math.max(0, (await allocationOf(frame, 10000)) - baseline);
}

// --- Garbage collection ---------------------------------------------------

export interface GcActivity {
    /** Collections of the young generation (scavenges). */
    readonly minor: number;
    /** Full collections, including incremental marking steps. */
    readonly major: number;
    /** Total time spent in collections, in milliseconds. */
    readonly pauseMs: number;
}

/** Garbage collections during `frames` frames, after a warm-up. Needs `--expose-gc`. */
export async function gcDuring(frame: () => void, frames: number): Promise<GcActivity> {
    requireGc();
    warmUp(frame);
    return countGc(() => {
        for (let f = 0; f < frames; f++) frame();
    });
}

// --- Retained memory ------------------------------------------------------

/**
 * Bytes of heap each item keeps alive, from building `count` of them and
 * holding on to the result. Needs `--expose-gc`.
 */
export function retainedPerItem(build: (count: number) => unknown, count: number): number {
    requireGc();
    fullGc();
    const before = process.memoryUsage().heapUsed;
    const kept = build(count);
    fullGc();
    const after = process.memoryUsage().heapUsed;
    keepAlive(kept);
    return (after - before) / count;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let sink: unknown;

function keepAlive(value: unknown): void {
    sink = value;
    if (sink === Symbol.for('never')) process.stdout.write('');
}

function noop(): void {
    // Measures the allocation the measurement itself causes
}

/** Warms `frame` up and returns how many frames it ran per millisecond. */
function warmUp(frame: () => void): number {
    const start = performance.now();
    let frames = 0;
    let elapsed = 0;
    while (frames < WARMUP_MIN_FRAMES || elapsed < WARMUP_MIN_MS) {
        frame();
        frames++;
        elapsed = performance.now() - start;
    }
    return frames / elapsed;
}

async function allocationOf(frame: () => void, initialFrames: number): Promise<number> {
    const samples: number[] = [];
    let frames = initialFrames;
    while (samples.length < ALLOCATION_WINDOWS) {
        fullGc();
        let bytes = 0;
        const activity = await countGc(() => {
            const before = process.memoryUsage().heapUsed;
            for (let f = 0; f < frames; f++) frame();
            bytes = process.memoryUsage().heapUsed - before;
        });
        if (activity.minor + activity.major > 0) {
            if (frames === 1) throw new Error('a garbage collection runs inside every window: raise --max-semi-space-size');
            frames = Math.max(1, Math.floor(frames / 4));
            continue;
        }
        samples.push(bytes / frames);
    }
    return median(samples);
}

/** Runs `work` and counts the garbage collections that happened during it. */
async function countGc(work: () => void): Promise<GcActivity> {
    // Entries are delivered asynchronously, so drain before and after
    let collecting = false;
    let minor = 0;
    let major = 0;
    let pauseMs = 0;
    const observer = new PerformanceObserver((list) => {
        if (!collecting) return;
        const entries = list.getEntries();
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i] as PerformanceEntry & { detail?: { kind?: number } };
            // perf_hooks.constants.NODE_PERFORMANCE_GC_MINOR is 1
            if (entry.detail?.kind === 1) minor++;
            else major++;
            pauseMs += entry.duration;
        }
    });
    observer.observe({ entryTypes: ['gc'] });
    await drain();
    collecting = true;
    work();
    await drain();
    collecting = false;
    observer.disconnect();
    return { minor, major, pauseMs };
}

function drain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

function requireGc(): void {
    if (typeof globalThis.gc !== 'function') throw new Error('this case needs node --expose-gc');
}

function fullGc(): void {
    globalThis.gc?.();
    globalThis.gc?.();
}

function median(values: number[]): number {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
}
