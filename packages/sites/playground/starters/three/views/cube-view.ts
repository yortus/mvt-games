import { BoxGeometry, Mesh, MeshNormalMaterial } from 'three';
import { setRefresh } from '@mvtjs/three';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CubeViewBindings {
    /** How far through its turn it is, from 0 up to 1. */
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A cube at the origin, which turns once each cycle, and tips as it turns, so its faces show in turn. */
export function CubeView(bindings: CubeViewBindings): Mesh {
    // Each face is coloured by the way it faces, so the cube needs no light
    const cube = new Mesh(new BoxGeometry(SIZE, SIZE, SIZE), new MeshNormalMaterial());
    setRefresh(cube, refresh);
    return cube;

    function refresh(): void {
        const radians = bindings.progress() * Math.PI * 2;
        cube.rotation.set(radians / 2, radians, 0);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The cube's size, in the scene's units. The camera is 5 units back. */
const SIZE = 1.5;
