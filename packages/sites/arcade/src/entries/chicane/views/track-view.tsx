/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, Material3D, PlaneGeometry } from '@pixi/3d';
import type { Track } from '../models';
import { createStripGeometry } from './strip-geometry';
import { createWallGeometry } from './wall-geometry';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TrackViewBindings {
    readonly track: Track;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ground the race runs on. That's the grass, the asphalt with its kerbs
 * and centre dashes, a low wall round the run-off, and the start line. It's
 * all built once from the track, and never changes.
 */
export function TrackView({ track }: TrackViewBindings): Container3D {
    const { samples, width } = track;
    const half = width / 2;
    // Kerbs and dashes come in blocks of a few samples each
    const isEvenBlock = (i: number): boolean => Math.floor(i / KERB_BLOCK_SAMPLES) % 2 === 0;
    const isDash = (i: number): boolean => i % DASH_EVERY_SAMPLES === 0;

    const strip = (from: number, to: number, height: number, includes?: (i: number) => boolean) => createStripGeometry({ samples, fromOffset: from, toOffset: to, height, includes });
    const asphalt = strip(half, -half, 0.02);
    const redKerbs = [strip(half + KERB_WIDTH, half, 0.03, isEvenBlock), strip(-half, -half - KERB_WIDTH, 0.03, isEvenBlock)];
    const whiteKerbs = [strip(half + KERB_WIDTH, half, 0.03, (i) => !isEvenBlock(i)), strip(-half, -half - KERB_WIDTH, 0.03, (i) => !isEvenBlock(i))];
    const dashes = strip(DASH_WIDTH / 2, -DASH_WIDTH / 2, 0.03, isDash);
    // The start line spans the asphalt over the first stretch
    const startLine = strip(half, -half, 0.035, (i) => i === 0);
    const walls = [createWallGeometry({ track, side: 1, height: WALL_HEIGHT }), createWallGeometry({ track, side: -1, height: WALL_HEIGHT })];
    const ground = new PlaneGeometry({ width: GROUND_SIZE, height: GROUND_SIZE });

    const centre = findCentre(track);
    const materials = createMaterials();
    const owned = [ground, asphalt, ...redKerbs, ...whiteKerbs, dashes, startLine, ...walls, ...Object.values(materials)];
    return (
        <group owns={owned}>
            {/* The plane stands in XY, and the ground lies flat in XZ, a little below the asphalt so the two never flicker through each other */}
            <mesh geometry={ground} material={materials.grass} x={centre.x} y={GROUND_HEIGHT} z={centre.z} rotationX={-Math.PI / 2} receiveShadow={true} />
            <mesh geometry={asphalt} material={materials.asphalt} receiveShadow={true} />
            <mesh geometry={redKerbs[0]} material={materials.red} />
            <mesh geometry={redKerbs[1]} material={materials.red} />
            <mesh geometry={whiteKerbs[0]} material={materials.white} />
            <mesh geometry={whiteKerbs[1]} material={materials.white} />
            <mesh geometry={dashes} material={materials.white} />
            <mesh geometry={startLine} material={materials.white} />
            <mesh geometry={walls[0]} material={materials.wall} />
            <mesh geometry={walls[1]} material={materials.wall} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many samples each kerb block runs, red then white. */
const KERB_BLOCK_SAMPLES = 2;
/** How far apart the centre dashes are, in samples. */
const DASH_EVERY_SAMPLES = 3;
const KERB_WIDTH = 1;
const DASH_WIDTH = 0.3;
/** The height of the low wall round the run-off. */
const WALL_HEIGHT = 0.8;
/**
 * How far the grass sits below the asphalt. The camera looks down on the
 * track from high up, and two surfaces only a centimetre or two apart
 * flicker through each other in bands at that angle. From that high, a
 * step of a few centimetres doesn't show.
 */
const GROUND_HEIGHT = -0.1;
/** How far the grass reaches, comfortably past the walls. */
const GROUND_SIZE = 900;

/** The track's materials. Each race makes its own, so none outlives the renderer it was drawn with. */
function createMaterials() {
    return {
        grass: new Material3D({ baseColor: 0x4c8a3c, roughness: 1 }),
        asphalt: new Material3D({ baseColor: 0x3b3d42, roughness: 0.9 }),
        red: new Material3D({ baseColor: 0xc9302c, roughness: 0.8 }),
        white: new Material3D({ baseColor: 0xe8e8e2, roughness: 0.8 }),
        wall: new Material3D({ baseColor: 0x9a9a92, roughness: 0.9 }),
    };
}

/** The middle of the track's bounding box, where the ground is centred. */
function findCentre(track: Track): { x: number; z: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < track.samples.length; i++) {
        const { x, z } = track.samples[i];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    }
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}
