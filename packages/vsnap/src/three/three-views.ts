import { type Material, Object3D } from 'three';
import type { CanvasViewKind } from '../browser';
import { drawThreeImage, type ThreeImageOptions } from './three-image';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a project does to its three.js views around each image. */
export interface ThreeViewsOptions {
    /** Prepares a view after its pose returns it, and before its image is taken. */
    readonly prepare?: (view: Object3D) => void;
    /**
     * Disposes of a view after its image is taken. By default, it removes
     * the view from its parent, and disposes of every geometry and material
     * under it.
     */
    readonly dispose?: (view: Object3D) => void;
    /** The colour behind each view whose test's options don't set one, where the scene sets no background, as a number such as `0x202024` or a CSS colour. */
    readonly background?: number | string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the kind of view for three.js objects, which a project lists in
 * its `vsnap.config.ts`. Its tests give `kind: 'three'`, unless it is the
 * project's default view, and their poses return three.js objects. A
 * three.js view has no bounds to frame it by, so its test's options always
 * give the image's size and the camera.
 */
export function threeViews(options: ThreeViewsOptions = {}): CanvasViewKind<Object3D, ThreeImageOptions, 'three'> {
    return {
        name: 'three',
        kind: 'canvas',
        isView: (value) => value instanceof Object3D,
        defaults: { background: options.background },
        prepare: options.prepare,
        draw: drawThreeImage,
        dispose: options.dispose ?? disposeObject,
        blankHint: 'Is the camera looking at it, and is it lit?',
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Removes a three.js object from its parent, and disposes of every geometry
 * and material under it: of meshes, lines, points and sprites. It leaves
 * textures alone, since tests often share them.
 */
function disposeObject(root: Object3D): void {
    root.removeFromParent();
    root.traverse((object) => {
        const drawn = object as { geometry?: { dispose?: () => void }; material?: Material | Material[] };
        drawn.geometry?.dispose?.();
        const materials = drawn.material === undefined ? [] : Array.isArray(drawn.material) ? drawn.material : [drawn.material];
        for (let i = 0; i < materials.length; i++) materials[i].dispose();
    });
}
