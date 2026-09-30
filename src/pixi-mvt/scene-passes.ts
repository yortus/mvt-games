import type { Container } from 'pixi.js';
// Also installs `onUpdate` / `onRefresh` on `Container` at module load, which
// keeps an early method assignment from shadowing the accessors.
import { containerScenePasses } from './mvt-container-mixin';

// ---------------------------------------------------------------------------
// Scene passes
// ---------------------------------------------------------------------------

// The walk itself is the generic one in `../mvt-utils`; these are its
// scene passes over Pixi containers.

/**
 * Runs every `onUpdate` in `node`'s subtree, each exactly once, calling a
 * container before any of its descendants. Sibling order is unspecified.
 *
 * `node` can be any container, at any time: an `Application` stage, a single
 * view under test, or one branch of a scene whose root is also updated.
 * Nothing here touches a renderer or a ticker, which is what lets a scene be
 * stepped in a test, fast-forwarded, or stepped to produce a thumbnail.
 *
 * The answer for `node` is memoised on `node` itself and invalidated by tree
 * mutation, so a static scene pays a list walk and nothing else. A method may
 * return `SKIP_DESCENDANTS` to skip its descendants this frame; the
 * container itself has already run, so it can stop skipping next frame. In the
 * update scene pass that freezes a subtree's state advance, so it is an
 * opt-in for deliberately frozen subtrees rather than a routine tool.
 */
export function updateScene(node: Container, deltaMs: number): void {
    containerScenePasses.updateScene(node, deltaMs);
}

/**
 * Runs every `onRefresh` in `node`'s subtree, each exactly once, calling a
 * container before any of its descendants. Sibling order is unspecified.
 *
 * The refresh half of {@link updateScene}, with the same memo and ordering.
 * Nothing gates on visibility, so a view is free to set its own `visible`; to
 * skip refreshing its descendants (a hidden or absent subtree) it says so
 * explicitly by returning `SKIP_DESCENDANTS`.
 */
export function refreshScene(node: Container): void {
    containerScenePasses.refreshScene(node);
}
