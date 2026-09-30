// Also installs `onUpdate` / `onRefresh` on `Element` at module load, which
// keeps an early method assignment from shadowing the accessors.
import { elementDestroyRegistry, elementScenePasses, watchElementTree } from './element-mixin';

// ---------------------------------------------------------------------------
// Scene passes
// ---------------------------------------------------------------------------

/**
 * Runs every `onUpdate` in `node`'s subtree, each exactly once, calling an
 * element before any of its descendants. Sibling order is unspecified. The
 * DOM counterpart of pixi-mvt's `updateScene`, with the same memoised walk,
 * kept correct by a `MutationObserver` rather than by wrapping DOM methods.
 */
export function updateScene(node: Element, deltaMs: number): void {
    watchElementTree(node);
    elementScenePasses.updateScene(node, deltaMs);
}

/**
 * Runs every `onRefresh` in `node`'s subtree, each exactly once, calling an
 * element before any of its descendants. Sibling order is unspecified. It
 * runs for hidden elements too, so a binding that shows an element again
 * still runs.
 */
export function refreshScene(node: Element): void {
    watchElementTree(node);
    elementScenePasses.refreshScene(node);
}

// ---------------------------------------------------------------------------
// Destroying
// ---------------------------------------------------------------------------

/**
 * Destroys `node` and its subtree: runs every `onDestroyed` callback in it, a
 * node's before its descendants', stops the scene passes calling any of them,
 * and removes `node` from the page.
 */
export function destroyElement(node: Element): void {
    elementDestroyRegistry.destroy(node);
}

/** Runs `callback` when `node` is destroyed, by `destroyElement` on it or on an ancestor. */
export function onDestroyed(node: Element, callback: (node: Element) => void): void {
    elementDestroyRegistry.onDestroyed(node, callback);
}

/** Whether `node` has been destroyed. */
export function isDestroyed(node: Element): boolean {
    return elementDestroyRegistry.isDestroyed(node);
}
