// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A function whose only job is to return a view that has been arranged
 * into the pose that the test describes. If the view has time to advance, the
 * pose advances it too.
 */
export type Pose<V> = () => V | Promise<V>;
