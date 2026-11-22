/** @jsxImportSource @mvtjs/pixi-3d */

import { ConeGeometry, type Container3D, CylinderGeometry, Material3D } from '@pixi/3d';
import { RUNOFF_WIDTH } from '../data';
import type { Track, Tree } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SceneryViewBindings {
    readonly track: Track;
    /** The trees on the grass inside the walls, which the model places, because a car can hit them. */
    readonly trees: readonly Tree[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The trees. Those on the grass inside the walls are the model's, since a
 * car can hit them. Those beyond the walls are only scenery, out of reach,
 * so the view places them itself, by a fixed seed, the same every race.
 */
export function SceneryView({ track, trees: obstacles }: SceneryViewBindings): Container3D {
    const trunk = new CylinderGeometry({ radiusTop: 0.22, radiusBottom: 0.3, height: TRUNK_HEIGHT, radialSegments: 6 });
    const crown = new ConeGeometry({ radius: 1.7, height: CROWN_HEIGHT, radialSegments: 8 });
    const bark = new Material3D({ baseColor: 0x6b4a2f, roughness: 1 });
    const leaves = new Material3D({ baseColor: 0x2f6b34, roughness: 0.9 });

    const trees = placeTrees(track);
    for (let i = 0; i < obstacles.length; i++) {
        const { x, z, size } = obstacles[i];
        trees.push({ x, z, scale: size, turn: i * 2.4 });
    }
    return (
        <group owns={[trunk, crown, bark, leaves]}>
            {trees.map((tree) => (
                <group x={tree.x} z={tree.z} scale={tree.scale} rotationY={tree.turn}>
                    <mesh geometry={trunk} material={bark} y={TRUNK_HEIGHT / 2} castShadow={true} />
                    <mesh geometry={crown} material={leaves} y={TRUNK_HEIGHT + CROWN_HEIGHT / 2 - 0.3} castShadow={true} />
                </group>
            ))}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TREE_COUNT = 160;
const TRUNK_HEIGHT = 1.6;
const CROWN_HEIGHT = 4;
/** How far past the track's bounding box the trees reach. */
const SCATTER_MARGIN = 70;
/** How far the trees keep from the walls. */
const WALL_CLEARANCE = 4;

interface TreePlace {
    readonly x: number;
    readonly z: number;
    readonly scale: number;
    readonly turn: number;
}

/** Scatters the trees over the ground round the track, skipping any spot too near it. */
function placeTrees(track: Track): TreePlace[] {
    const { samples } = track;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < samples.length; i++) {
        minX = Math.min(minX, samples[i].x);
        maxX = Math.max(maxX, samples[i].x);
        minZ = Math.min(minZ, samples[i].z);
        maxZ = Math.max(maxZ, samples[i].z);
    }
    const keepClear = track.width / 2 + RUNOFF_WIDTH + WALL_CLEARANCE;
    const random = createSeededRandom(TREE_SEED);
    const trees: TreePlace[] = [];
    // Bounded, so an unlucky layout can't loop forever
    for (let attempt = 0; attempt < TREE_COUNT * 20 && trees.length < TREE_COUNT; attempt++) {
        const x = minX - SCATTER_MARGIN + random() * (maxX - minX + SCATTER_MARGIN * 2);
        const z = minZ - SCATTER_MARGIN + random() * (maxZ - minZ + SCATTER_MARGIN * 2);
        const nearest = samples[track.findNearestSampleAnywhere(x, z)];
        if (Math.hypot(nearest.x - x, nearest.z - z) < keepClear) continue;
        trees.push({ x, z, scale: 0.8 + random() * 0.7, turn: random() * Math.PI * 2 });
    }
    return trees;
}

const TREE_SEED = 20261120;

/** A small seeded random source, from 0 to 1, the same sequence for the same seed. */
function createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
