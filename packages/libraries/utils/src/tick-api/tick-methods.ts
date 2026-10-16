import type { SKIP_DESCENDANTS } from './skip-descendants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// A view does two things on each tick, through two methods set with
// `setUpdate` and `setRefresh`: its update method, then its refresh method.
// `updateView` and `refreshView` call them, a view's before its descendants'.

/**
 * Advances a view's cosmetic presentation state by `deltaMs`. Called by
 * `updateView`, the first half of each tick, whether or not the view is shown.
 *
 * May return {@link SKIP_DESCENDANTS} to skip advancing this view's
 * descendants this frame - an opt-in for a deliberately frozen subtree (a
 * paused game, a time-stopped game object, an inactive pool slot). Their state
 * does not advance while skipped, so it may be stale when they resume.
 */
export type UpdateMethod = (deltaMs: number) => typeof SKIP_DESCENDANTS | void;

/**
 * Writes model state to a view's presentation output. Called by
 * `refreshView`, the second half of each tick, before the frame is drawn,
 * whether or not the view is shown. Must be idempotent.
 *
 * May return {@link SKIP_DESCENDANTS} to skip refreshing this view's
 * descendants this frame - how a hidden or absent subtree opts out cheaply
 * without the view removing itself from the method list.
 */
export type RefreshMethod = () => typeof SKIP_DESCENDANTS | void;
