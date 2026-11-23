import { FlatMaterial, Geometry3D, Mesh3D } from '@pixi/3d';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import { EYE_HEIGHT } from '../data';
import { createMountainsTexture } from './mountains-texture';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeadowBackdropViewBindings {
    /** Where the player stands, in metres. */
    readonly playerX: () => number;
    readonly playerZ: () => number;
    /** The height of the ground under the player, in metres. */
    readonly groundHeight: () => number;
}

/** The sky's colour overhead, which is drawn behind everything. */
export const MEADOW_SKY = 0x4fb2f5;
/** The pale haze at the horizon, which faraway things fade into. */
export const MEADOW_HORIZON = 0xc6e9ff;
/** How far the backdrop is from the player, in metres. The camera must see this far, and a little further. */
export const MEADOW_BACKDROP_DISTANCE = 300;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The far distance, with snow-capped mountains along the horizon, and the
 * sky above them, paling to haze. It's a picture on the inside of a tall
 * ring round the player, much further off than the ground reaches. The ring
 * moves with the player, so however far they walk, the mountains never
 * get any closer. It doesn't turn, so the grandest mountains always stand
 * down the valley the way the player first faces. The haze doesn't reach
 * it, since the picture is painted with its own.
 */
export function MeadowBackdropView({ playerX, playerZ, groundHeight }: MeadowBackdropViewBindings): Mesh3D {
    const texture = createMountainsTexture({
        skyColour: MEADOW_SKY,
        horizonColour: MEADOW_HORIZON,
        around: 2 * Math.PI * MEADOW_BACKDROP_DISTANCE,
        above: RING_TOP,
        below: -RING_BOTTOM,
        peakHeight: PEAK_HEIGHT,
    });
    const geometry = createRingGeometry();
    const material = new FlatMaterial({ baseColorTexture: texture, fog: false, doubleSided: true });
    const ring = ownResources(new Mesh3D({ geometry, material }), [texture, geometry, material]);

    setRefresh(ring, () => {
        ring.position.set(playerX(), groundHeight() + EYE_HEIGHT, playerZ());
    });
    return ring;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * How far the ring reaches below and above the player's eyes, in metres.
 * The top is high enough that the sky above it is the plain colour behind
 * everything. The bottom is low enough that the haze fills the view below
 * the horizon, past the ground's end.
 */
const RING_BOTTOM = -150;
const RING_TOP = 140;
/** How high the tallest peaks reach above the horizon, in metres. */
const PEAK_HEIGHT = 70;
/** How many flat sides the ring has. */
const RING_SIDES = 72;

/**
 * Builds the ring, its sides facing in. The picture goes once round it.
 * A quarter of the way across, where the mountains are grandest, faces
 * +x, the way the player first faces.
 */
function createRingGeometry(): Geometry3D {
    const positions = new Float32Array((RING_SIDES + 1) * 2 * 3);
    const uvs = new Float32Array((RING_SIDES + 1) * 2 * 2);
    const indices = new Uint32Array(RING_SIDES * 6);
    for (let i = 0; i <= RING_SIDES; i++) {
        const across = i / RING_SIDES;
        // Headings are measured from +x toward +z, which is to the right as you face +x, as the picture runs
        const angle = (across - 0.25) * Math.PI * 2;
        const x = Math.cos(angle) * MEADOW_BACKDROP_DISTANCE;
        const z = Math.sin(angle) * MEADOW_BACKDROP_DISTANCE;
        positions.set([x, RING_BOTTOM, z, x, RING_TOP, z], i * 6);
        uvs.set([across, 1, across, 0], i * 4);
    }
    for (let i = 0; i < RING_SIDES; i++) {
        const bottom = i * 2;
        indices.set([bottom, bottom + 2, bottom + 1, bottom + 1, bottom + 2, bottom + 3], i * 6);
    }
    return new Geometry3D({ positions, uvs, indices });
}
