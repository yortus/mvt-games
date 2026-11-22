import type { View3D } from '@pixi/3d';
import { refreshView, setRefresh, setUpdate, updateView } from '@mvtjs/utils';
// Registers PixiJS 3D's scene nodes, so `updateView` and `refreshView` walk the scene
import './container3d-mixin';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Makes `updateView` and `refreshView` reach a `View3D`'s scene. Pixi's walk
 * stops at the `View3D`, because its scene isn't among its children. So this
 * sets update and refresh methods on the `View3D` that walk `view.root`.
 * The scene updates when the stage does, and refreshes in the stage's order,
 * parents first. When `updateView` skips a container that holds the
 * `View3D`, such as a paused game's, it skips the scene too.
 *
 * The methods are set in the `View3D`'s own update and refresh slots. If
 * your view needs methods of its own, set them on a container around the
 * `View3D`, or on a node in its scene. `connectScene` returns the view, so
 * you can wrap a `new View3D(...)` in the call. `Scene3DView` calls it for
 * you.
 */
export function connectScene<V extends View3D>(view: V): V {
    // A View3D keeps the root it was made with, so reading it once is safe.
    const root = view.root;
    setUpdate(view, (deltaMs) => {
        updateView(root, deltaMs);
    });
    setRefresh(view, () => {
        refreshView(root);
    });
    return view;
}
