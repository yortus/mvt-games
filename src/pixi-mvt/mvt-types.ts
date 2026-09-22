import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Skip sentinel
// ---------------------------------------------------------------------------

/**
 * Returned by an update or refresh method to tell the pass to skip that
 * container's descendants this frame. The container itself has already run, so
 * next frame it runs again and can stop skipping - nothing gets permanently
 * stuck, unlike hiding a container from a pass that gates on visibility.
 *
 * A dedicated symbol rather than `true` so an accidental truthy return can
 * never be mistaken for it, and so the type rejects any other non-void return.
 */
export const SKIP_DESCENDANTS: unique symbol = Symbol('mvt.skipDescendants');

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

/**
 * Advances a view's cosmetic presentation state. Always fires, every tick.
 *
 * May return {@link SKIP_DESCENDANTS} to skip advancing this container's
 * descendants this frame - an opt-in for a deliberately frozen subtree (a
 * time-stopped entity, an inactive pool slot). Their state does not advance
 * while skipped, so it may be stale when they resume.
 */
export type UpdateMethod = (deltaMs: number) => typeof SKIP_DESCENDANTS | void;

/**
 * Syncs a view's presentation output from model state. Must be idempotent.
 *
 * May return {@link SKIP_DESCENDANTS} to skip refreshing this container's
 * descendants this frame - how a hidden or absent subtree opts out cheaply
 * without the container removing itself from the walk.
 */
export type RefreshMethod = () => typeof SKIP_DESCENDANTS | void;

// ---------------------------------------------------------------------------
// Subtree info
// ---------------------------------------------------------------------------

/**
 * The memoised walk for a container's subtree, shared by both passes: a
 * preorder list of the containers that carry the pass's method, paired with a
 * skip table so a returned {@link SKIP_DESCENDANTS} prunes a subtree in one
 * step. `skip[i]` is the list index just past entry `i`'s subtree, which is
 * contiguous because the list is preorder.
 *
 * The two travel together on purpose. A skip table that outlived the list it
 * indexes would be a second source of truth about the tree; bundled, it is
 * derived from the list and invalidated with it.
 */
export interface SubtreeInfo {
    readonly list: Container[];
    readonly skip: Int32Array;
}
