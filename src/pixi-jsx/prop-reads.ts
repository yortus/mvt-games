// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Counts the prop reads the JSX runtime makes while refreshing: each call of a
 * getter prop, each read of a `<List>`'s `items` (once per frame, plus once per
 * slot for its presence check), and each `<Match>` `when` a `<Switch>` tests.
 * It is a measure of how much polling a scene does per frame.
 *
 * - A hidden container counts only its `visible` read, since its other props
 *   and its subtree are skipped.
 * - Hand-written `onRefresh` methods are not counted; they are not props.
 *
 * Counting is turned off by default. To measure, switch `isCounting` on for a
 * frame and take the difference in `count`, or call {@link countPropReads}.
 * `createFrameStats` samples it this way, one frame in each window.
 *
 * While off, the counter costs each container's refresh a flag check and
 * nothing else: within measurement noise on a scene of 10,000 sprites. While
 * on, it costs a few nanoseconds per container, so sample it rather than
 * leave it on.
 *
 * The runtime's modules increment `count` in place, and generated refresh
 * functions are handed this object, so it must stay one object for the life
 * of the program. Only the runtime should write `count`.
 */
export const propReadCounter = { isCounting: false, count: 0 };

/**
 * Count the prop reads made while `run` runs, typically one `refreshScene`.
 * Restores the counter's previous on/off state afterwards.
 */
export function countPropReads(run: () => void): number {
    const wasCounting = propReadCounter.isCounting;
    const before = propReadCounter.count;
    propReadCounter.isCounting = true;
    try {
        run();
    }
    finally {
        propReadCounter.isCounting = wasCounting;
    }
    return propReadCounter.count - before;
}
