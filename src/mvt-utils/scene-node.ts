import type { SKIP_DESCENDANTS } from './skip-descendants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A node of a renderer's scene graph with MVT's two per-frame methods as
 * properties: `onUpdate`, which advances its cosmetic presentation state, and
 * `onRefresh`, which writes model state to its presentation output. Either may
 * be `undefined`. A renderer's scene passes make every node of that renderer
 * one, by adding both properties to its node prototype.
 *
 * `updateScene` and `refreshScene` call them, a node's before its
 * descendants'.
 */
export interface SceneNode {
    onUpdate: UpdateMethod | undefined;
    onRefresh: RefreshMethod | undefined;
}

/**
 * Advances a node's cosmetic presentation state by `deltaMs`. Called by
 * `updateScene`, whether or not the node is shown; the ticker runs
 * `updateScene` once per tick.
 *
 * May return {@link SKIP_DESCENDANTS} to skip advancing this node's
 * descendants this frame - an opt-in for a deliberately frozen subtree (a
 * time-stopped entity, an inactive pool slot). Their state does not advance
 * while skipped, so it may be stale when they resume.
 */
export type UpdateMethod = (deltaMs: number) => typeof SKIP_DESCENDANTS | void;

/**
 * Writes model state to a node's presentation output. Called by
 * `refreshScene`, whether or not the node is shown; the ticker runs
 * `refreshScene` once per frame, before the frame is drawn. Must be
 * idempotent.
 *
 * May return {@link SKIP_DESCENDANTS} to skip refreshing this node's
 * descendants this frame - how a hidden or absent subtree opts out cheaply
 * without the node removing itself from the walk.
 */
export type RefreshMethod = () => typeof SKIP_DESCENDANTS | void;
