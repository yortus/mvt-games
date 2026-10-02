import type { SKIP_DESCENDANTS } from './skip-descendants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// A node of a renderer's scene graph does two things on each tick, through
// two methods set with `setTickMethods`: its update method, then its refresh
// method. `tickScene` calls them, a node's before its descendants'.

/**
 * Advances a node's cosmetic presentation state by `deltaMs`. Called by the
 * update scene pass, the first half of each tick (`tickScene`), whether or
 * not the node is shown.
 *
 * May return {@link SKIP_DESCENDANTS} to skip advancing this node's
 * descendants this frame - an opt-in for a deliberately frozen subtree (a
 * paused game, a time-stopped entity, an inactive pool slot). Their state
 * does not advance while skipped, so it may be stale when they resume.
 */
export type UpdateMethod = (deltaMs: number) => typeof SKIP_DESCENDANTS | void;

/**
 * Writes model state to a node's presentation output. Called by the refresh
 * scene pass, the second half of each tick (`tickScene`), before the frame is
 * drawn, whether or not the node is shown. Must be idempotent.
 *
 * May return {@link SKIP_DESCENDANTS} to skip refreshing this node's
 * descendants this frame - how a hidden or absent subtree opts out cheaply
 * without the node removing itself from the walk.
 */
export type RefreshMethod = () => typeof SKIP_DESCENDANTS | void;
