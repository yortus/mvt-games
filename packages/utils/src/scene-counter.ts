import { utilsState } from './shared-state';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Counts what the scene passes do, for every renderer: the methods they call,
 * and the memoised walks they rebuild, which is a scene's churn. The scene
 * passes count into it themselves, so unlike `readCounter` it needs nothing
 * from the code being measured.
 *
 * - `methodCalls`: update and refresh methods called.
 * - `walkRebuilds`: walks rebuilt, once per scene pass that found its walk
 *   cleared because a node was attached or detached below it, or given or
 *   cleared a method. Zero in a steady scene.
 * - `rebuildVisits`: nodes visited while rebuilding those walks, which is
 *   what the churn costs.
 *
 * Counting is off unless something is measuring. To measure one call, use
 * {@link countScene}. To measure across ticker callbacks, as
 * `createFrameStats` does for one frame in each window, switch `isCounting`
 * on, and take the differences in the counts when switching it off.
 *
 * While off, it costs a flag check per scene pass, and one per walk rebuilt
 * and per node visited rebuilding it, which a steady scene never does. Only
 * the scene passes add to the counts. Every copy of @mvtjs/utils in a program
 * counts into the same object.
 */
export const sceneCounter = utilsState.sceneCounter;

/** What the scene passes did while `run` ran, as {@link countScene} returns it. */
export interface SceneCounts {
    readonly methodCalls: number;
    readonly walkRebuilds: number;
    readonly rebuildVisits: number;
}

/**
 * Count what the scene passes do while `run` runs, typically one
 * `tickScene`. Restores the counter's previous on/off state afterwards.
 */
export function countScene(run: () => void): SceneCounts {
    const wasCounting = sceneCounter.isCounting;
    const { methodCalls, walkRebuilds, rebuildVisits } = sceneCounter;
    sceneCounter.isCounting = true;
    try {
        run();
    }
    finally {
        sceneCounter.isCounting = wasCounting;
    }
    return {
        methodCalls: sceneCounter.methodCalls - methodCalls,
        walkRebuilds: sceneCounter.walkRebuilds - walkRebuilds,
        rebuildVisits: sceneCounter.rebuildVisits - rebuildVisits,
    };
}
