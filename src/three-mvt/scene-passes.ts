import type { Object3D } from 'three';
// Also installs `onUpdate` / `onRefresh` on `Object3D` at module load, which
// keeps an early method assignment from shadowing the accessors.
import { objectDestroyRegistry, objectScenePasses } from './object3d-mixin';

// ---------------------------------------------------------------------------
// Scene passes
// ---------------------------------------------------------------------------

/**
 * Runs every `onUpdate` in `node`'s subtree, each exactly once, calling an
 * object before any of its descendants. Sibling order is unspecified. The
 * three.js counterpart of pixi-mvt's `updateScene`, with the same memoised
 * walk.
 */
export function updateScene(node: Object3D, deltaMs: number): void {
    objectScenePasses.updateScene(node, deltaMs);
}

/**
 * Runs every `onRefresh` in `node`'s subtree, each exactly once, calling an
 * object before any of its descendants. Sibling order is unspecified. Unlike
 * three's `onBeforeRender`, it runs for objects that are hidden or out of
 * view, so a binding that brings an object back into view still runs.
 */
export function refreshScene(node: Object3D): void {
    objectScenePasses.refreshScene(node);
}

// ---------------------------------------------------------------------------
// Destroying
// ---------------------------------------------------------------------------

/**
 * Destroys `node` and its subtree: runs every `onDestroyed` callback in it, a
 * node's before its descendants', stops the scene passes calling any of them,
 * and detaches `node`. Does not dispose geometry, materials or textures.
 */
export function destroyObject(node: Object3D): void {
    objectDestroyRegistry.destroy(node);
}

/** Runs `callback` when `node` is destroyed, by `destroyObject` on it or on an ancestor. */
export function onDestroyed(node: Object3D, callback: (node: Object3D) => void): void {
    objectDestroyRegistry.onDestroyed(node, callback);
}

/** Whether `node` has been destroyed. */
export function isDestroyed(node: Object3D): boolean {
    return objectDestroyRegistry.isDestroyed(node);
}
