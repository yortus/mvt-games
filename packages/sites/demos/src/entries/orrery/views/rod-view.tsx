/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D, CylinderGeometry, Material3D } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RodViewBindings {
    /** The unit cylinder it's scaled from, one high and one in radius, centred on the origin. */
    readonly cylinder: CylinderGeometry;
    /** What it's made of. */
    readonly material: Material3D;
    /** Its radius. */
    readonly radius: number;
    /** The heights of its two ends. */
    readonly bottom: number;
    readonly top: number;
    /** Where it stands, across the floor. Absent, it stands on its parent's axis. */
    readonly x?: number;
    readonly z?: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A vertical rod, tube or disc, standing from one height to another. It never changes, so it's laid out once. */
export function RodView(bindings: RodViewBindings): Container3D {
    const { cylinder, material, radius, bottom, top, x = 0, z = 0 } = bindings;
    return (
        <mesh
            geometry={cylinder}
            material={material}
            x={x}
            y={(bottom + top) / 2}
            z={z}
            scaleX={radius}
            scaleY={top - bottom}
            scaleZ={radius}
        />
    );
}
