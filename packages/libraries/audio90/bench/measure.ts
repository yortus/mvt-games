import process from 'node:process';

// ---------------------------------------------------------------------------
// Measuring, for a case's file
// ---------------------------------------------------------------------------

// Each case runs in its own process. The runner passes its params as one
// JSON argument, and reads back the one JSON line of metrics it reports.

/** The params the runner passed to this process. */
export function readParams(): Record<string, string | number> {
    const arg = process.argv[2];
    if (arg === undefined) throw new Error('expected the case\'s params as a JSON argument');
    return JSON.parse(arg) as Record<string, string | number>;
}

/** Reports this case's metrics to the runner. Call it once. */
export function report(metrics: Record<string, number>): void {
    process.stdout.write(`${JSON.stringify(metrics)}\n`);
}

/**
 * Returns the median microseconds per frame. It warms up for at least 1000
 * frames and 300 ms, or for a slow frame 2 s and 100 frames, then times 15
 * batches, each sized from the warm-up to last about 30 ms.
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
    return findMedian(batches);
}

/**
 * Returns the median bytes allocated on the JavaScript heap per frame, net
 * of the measuring's own, over windows of 10,000 frames.
 *
 * It needs `--expose-gc`, and a young generation large enough that no
 * garbage collection runs inside a window (`--max-semi-space-size=128`).
 * Then the heap's growth over the window is what was allocated. A window in
 * which a collection ran is run again with fewer frames.
 */
export async function allocationPerFrame(frame: () => void): Promise<number> {
    if (typeof globalThis.gc !== 'function') throw new Error('this case needs node --expose-gc');
    warmUp(frame);
    const baseline = await measureAllocation(ignore, ALLOCATION_WINDOW_FRAMES);
    return Math.max(0, (await measureAllocation(frame, ALLOCATION_WINDOW_FRAMES)) - baseline);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WARMUP_MIN_MS = 300;
const WARMUP_MIN_FRAMES = 1000;
/** A warm-up stops here, once it has run `WARMUP_SLOW_MIN_FRAMES`, even short of `WARMUP_MIN_FRAMES`. */
const WARMUP_MAX_MS = 2000;
const WARMUP_SLOW_MIN_FRAMES = 100;
const BATCHES = 15;
const BATCH_TARGET_MS = 30;
const ALLOCATION_WINDOWS = 5;
/** Frames in each window of allocation, however long a frame takes. */
const ALLOCATION_WINDOW_FRAMES = 10000;

/** Warms `frame` up, and returns how many frames it ran each millisecond. */
function warmUp(frame: () => void): number {
    const start = performance.now();
    let frames = 0;
    let elapsed = 0;
    while (
        (frames < WARMUP_MIN_FRAMES || elapsed < WARMUP_MIN_MS)
        && !(elapsed >= WARMUP_MAX_MS && frames >= WARMUP_SLOW_MIN_FRAMES)
    ) {
        frame();
        frames++;
        elapsed = performance.now() - start;
    }
    return frames / elapsed;
}

/** Returns the median bytes `frame` allocates, over windows of `initialFrames`, or fewer where a collection ran. */
async function measureAllocation(frame: () => void, initialFrames: number): Promise<number> {
    const samples: number[] = [];
    let frames = initialFrames;
    while (samples.length < ALLOCATION_WINDOWS) {
        globalThis.gc?.();
        globalThis.gc?.();
        let bytes = 0;
        const collections = await countCollections(() => {
            const before = process.memoryUsage().heapUsed;
            for (let f = 0; f < frames; f++) frame();
            bytes = process.memoryUsage().heapUsed - before;
        });
        if (collections > 0) {
            if (frames === 1) throw new Error('a garbage collection runs inside every window: raise --max-semi-space-size');
            frames = Math.max(1, Math.floor(frames / 4));
            continue;
        }
        samples.push(bytes / frames);
    }
    return findMedian(samples);
}

/** Runs `work`, and returns how many garbage collections ran during it. */
async function countCollections(work: () => void): Promise<number> {
    // The observer hears of each collection later, so it waits before and after
    let isCounting = false;
    let count = 0;
    const observer = new PerformanceObserver((list) => {
        if (isCounting) count += list.getEntries().length;
    });
    observer.observe({ entryTypes: ['gc'] });
    await waitForEntries();
    isCounting = true;
    work();
    await waitForEntries();
    isCounting = false;
    observer.disconnect();
    return count;
}

function waitForEntries(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

function findMedian(values: number[]): number {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
}

function ignore(): void {
    // Measures the allocation the measuring itself makes
}
