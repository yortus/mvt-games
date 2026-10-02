// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A manual counter of the reads a scene makes while refreshing: a measure of
 * how much polling it does per frame. Nothing is counted unless the code
 * doing the reads adds them.
 *
 * - The JSX runtime (`mvt-utils/jsx`, and each renderer's built on it, such
 *   as `pixi-mvt/jsx`) has this built in. It counts each call of a function
 *   attribute, each read of a `<List>`'s `items` (once per frame,
 *   plus once per slot for its presence check), and each `<Match>` `when` a
 *   `<Switch>` tests. A hidden container counts only its `visible` read, since
 *   its other attributes and its subtree are skipped.
 * - Hand-written refresh code calls {@link addReads}, counting its reads as
 *   the JSX equivalent would count them, so that the two compare.
 *
 * Counting is off unless something is measuring. To measure one call, use
 * {@link countReads}. To measure across ticker callbacks, as
 * `createFrameStats` does for one frame in each window, switch `isCounting`
 * on, and take the difference in `count` when switching it off.
 *
 * While off, counting costs each counting site a flag check and nothing
 * else: within measurement noise on a scene of 10,000 sprites. While on, it
 * costs a few nanoseconds per site, so sample it rather than leave it on.
 *
 * Only `addReads` and the JSX runtime add to `count`. The runtime
 * writes it directly, without a call, from the refresh functions it
 * generates, which are handed this object, so it must stay one object for
 * the life of the program.
 */
export const readCounter = { isCounting: false, count: 0 };

/** Add `n` reads to {@link readCounter} if it is counting; otherwise do nothing. */
export function addReads(n: number): void {
    if (readCounter.isCounting) readCounter.count += n;
}

/**
 * Count the reads made while `run` runs, typically one refresh scene pass.
 * Restores the counter's previous on/off state afterwards.
 */
export function countReads(run: () => void): number {
    const wasCounting = readCounter.isCounting;
    const before = readCounter.count;
    readCounter.isCounting = true;
    try {
        run();
    }
    finally {
        readCounter.isCounting = wasCounting;
    }
    return readCounter.count - before;
}
