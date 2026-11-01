// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Times the models and views each tick, by the real clock: from the start
 * of the tick, before the models update, to the end of the last refresh.
 * Drawing comes after that, so it isn't counted.
 *
 * It's a measuring tool, not a model. A model must never read the clock, so
 * keep this out of anything that decides what happens in the game.
 *
 * It starts timing only after a warm-up, so the engine has had time to
 * optimise the code first. Until then, every time it shows is 0.
 */
export interface FrameMeter {
    /** Call as each tick starts, before the models update. */
    readonly startTick: () => void;
    /** Call once the views have refreshed. */
    readonly endTick: () => void;
    /** Whether the warm-up is over, so the times mean something. */
    readonly isWarm: boolean;
    /** The models' and views' time per tick, in ms, averaged over the last sample of ticks. */
    readonly averageMs: number;
    /** The slowest tick in the last sample, in ms. */
    readonly worstMs: number;
    /** Counts the samples taken. Changes exactly when `averageMs` and `worstMs` do. */
    readonly sampleCount: number;
    /** How many recent ticks `msAt` holds. */
    readonly historyLength: number;
    /** A recent tick's time, in ms, for `index` from 0, the oldest, to `historyLength - 1`. */
    readonly msAt: (index: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FrameMeterOptions {
    /** How many ticks to wait before timing any. */
    readonly warmUpTicks: number;
    /** How many recent ticks to keep. */
    readonly historyLength: number;
    /** How many ticks each sample of the average and the worst covers. */
    readonly sampleTicks: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a meter that hasn't timed anything yet. */
export function createFrameMeter({ warmUpTicks, historyLength, sampleTicks }: FrameMeterOptions): FrameMeter {
    // The recent ticks' times, as a ring: `next` is where the next one goes, which is the oldest
    const history = new Float64Array(historyLength);
    let next = 0;
    let ticks = 0;
    let tickStartMs = 0;
    // The sample being taken
    let sampleSumMs = 0;
    let sampleWorstMs = 0;
    let sampledTicks = 0;
    // The last sample taken
    let averageMs = 0;
    let worstMs = 0;
    let sampleCount = 0;

    return {
        get isWarm() { return ticks > warmUpTicks; },
        get averageMs() { return averageMs; },
        get worstMs() { return worstMs; },
        get sampleCount() { return sampleCount; },
        historyLength,

        msAt(index) {
            return history[(next + index) % historyLength];
        },

        startTick() {
            ticks++;
            tickStartMs = performance.now();
        },

        endTick() {
            if (ticks <= warmUpTicks) return;
            const ms = performance.now() - tickStartMs;
            history[next] = ms;
            next = (next + 1) % historyLength;

            sampleSumMs += ms;
            sampleWorstMs = Math.max(sampleWorstMs, ms);
            sampledTicks++;
            if (sampledTicks < sampleTicks) return;
            averageMs = sampleSumMs / sampledTicks;
            worstMs = sampleWorstMs;
            sampleCount++;
            sampleSumMs = 0;
            sampleWorstMs = 0;
            sampledTicks = 0;
        },
    };
}
