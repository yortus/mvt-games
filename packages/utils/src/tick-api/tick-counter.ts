import { utilsState } from './shared-state';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a tick did while it was counted, as {@link countTick} returns it. */
export interface TickCounts {
    /**
     * Reads the views made while refreshing: a measure of how much polling
     * they do. Counted only where the code doing the reads counts them: the
     * JSX runtime has it built in, and hand-written refresh code calls
     * {@link addReads}.
     */
    readonly reads: number;
    /** Update and refresh methods called. */
    readonly methodCalls: number;
    /**
     * Method lists rebuilt: once per `updateView` or `refreshView` call that
     * found its method list cleared because a node was attached or detached
     * below it, or given or cleared a method. Zero in a steady scene.
     */
    readonly methodListRebuilds: number;
    /** Node visits made while rebuilding those method lists, which is what the churn costs. */
    readonly rebuildNodeVisits: number;
}

/**
 * Counts what ticks do, for every renderer: the reads views make while
 * refreshing, the methods called, and the method lists rebuilt.
 *
 * - The JSX runtime (`@mvtjs/utils/jsx`, and each renderer's built on it, such
 *   as `@mvtjs/pixi/jsx`) counts its reads itself. It counts each call of a
 *   function attribute, each read of a `<List>`'s `items` (once per frame,
 *   plus once per slot for its presence check), and each `<Match>` `when` a
 *   `<Switch>` tests. A hidden container counts only its `visible` read,
 *   since its other attributes and its subtree are skipped.
 * - Hand-written refresh code calls {@link addReads}, counting its reads as
 *   the JSX equivalent would count them, so that the two compare.
 * - `updateView` and `refreshView` count the methods they call, the method
 *   lists they rebuild, and the node visits rebuilding them takes, so those
 *   need nothing from the code being measured.
 *
 * Counting is off unless something is measuring. To measure one call, use
 * {@link countTick}. To measure across ticker callbacks, as
 * `createPerformanceMetrics` does for one frame in each window, switch
 * `isCounting` on, and take the differences in the counts when switching it
 * off.
 *
 * While off, counting costs each counting site a flag check and nothing
 * else: within measurement noise on a scene of 10,000 sprites. While on, it
 * costs a few nanoseconds per site, so sample it rather than leave it on.
 *
 * The counting sites write it directly, so it must stay one object for the
 * life of the program; every copy of @mvtjs/utils in a program counts into
 * the same one.
 */
export const tickCounter: TickCounter = utilsState.tickCounter;

/** {@link tickCounter}'s shape: its counts so far, and whether it is counting. */
export interface TickCounter {
    isCounting: boolean;
    reads: number;
    methodCalls: number;
    methodListRebuilds: number;
    rebuildNodeVisits: number;
}

/**
 * Counts what ticks do while `run` runs: typically one `updateView` and
 * `refreshView`, or one of them, or a run of several ticks. Restores the
 * counter's previous on/off state afterwards.
 *
 * ```ts
 * const { reads } = countTick(() => refreshView(view));
 * ```
 */
export function countTick(run: () => void): TickCounts {
    const wasCounting = tickCounter.isCounting;
    const { reads, methodCalls, methodListRebuilds, rebuildNodeVisits } = tickCounter;
    tickCounter.isCounting = true;
    try {
        run();
    }
    finally {
        tickCounter.isCounting = wasCounting;
    }
    return {
        reads: tickCounter.reads - reads,
        methodCalls: tickCounter.methodCalls - methodCalls,
        methodListRebuilds: tickCounter.methodListRebuilds - methodListRebuilds,
        rebuildNodeVisits: tickCounter.rebuildNodeVisits - rebuildNodeVisits,
    };
}

/** Adds `n` reads to {@link tickCounter} if it is counting; otherwise does nothing. */
export function addReads(n: number): void {
    if (tickCounter.isCounting) tickCounter.reads += n;
}
