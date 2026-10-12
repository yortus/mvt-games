import { type Material, Mesh, Object3D } from 'three';
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
        prepare: options.prepare,
        draw: drawThreeImage,
        dispose: options.dispose ?? disposeObject,
        blankHint: 'Is the camera looking at it, and is it lit?',
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Removes a three.js object from its parent, and disposes of every geometry and material under it. */
function disposeObject(root: Object3D): void {
    root.removeFromParent();
    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
        for (let i = 0; i < materials.length; i++) materials[i].dispose();
    });
}
