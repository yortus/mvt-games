import type { Random } from '@mvtjs/site-kit/random';
import { TREE_RADIUS, TREE_SPACING } from '../data';
import { isCircleTouchingCar } from './is-circle-touching-car';
import type { Track, TrackPlace } from './track';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The trees that stand on the grass between the asphalt and the walls, which wreck a car that hits them. */
export interface TreeField {
    readonly trees: readonly Tree[];
    /** The index of a tree touching a car near a track sample, or -1 if none is. */
    readonly findTreeTouching: (carX: number, carZ: number, carHeading: number, sample: number) => number;
    /** Whether a tree's trunk is within `radius` of a point near a track sample, such as a missile. */
    readonly isTreeWithin: (x: number, z: number, radius: number, sample: number) => boolean;
}

/** A tree's trunk, on the ground. */
export interface Tree {
    readonly x: number;
    readonly z: number;
    /** How big it is, from about 0.8 to 1.5 of a typical tree. */
    readonly size: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TreeFieldOptions {
    readonly track: Track;
    /** Where the trees go. The same seed gives the same trees. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Plants trees along the track, at varying gaps, on one side or the other.
 * Each stands somewhere on the grass between the kerb and the wall. None
 * stands on the start straight, or on another stretch of track that passes
 * close by.
 */
export function createTreeField(options: TreeFieldOptions): TreeField {
    const { track, random } = options;
    const half = track.width / 2;
    const trees: Tree[] = [];
    // The trees near each sample, so a car checks only those, not every tree
    const nearSample: number[][] = [];
    for (let i = 0; i < track.samples.length; i++) nearSample.push([]);

    const place: TrackPlace = { x: 0, z: 0, heading: 0 };
    for (let distance = START_CLEAR; distance < track.length - START_CLEAR / 2; distance += random.between(0.5, 1.5) * TREE_SPACING) {
        const side = random.next() < 0.5 ? 1 : -1;
        // Between the kerb and the wall, which is closer on the inside of a tight bend
        track.locate(distance, 0, place);
        const wall = track.findWallOffset(track.findNearestSampleAnywhere(place.x, place.z), side);
        const offset = side * (half + random.between(KERB_CLEAR, Math.max(KERB_CLEAR, wall - half - WALL_CLEAR)));
        track.locate(distance, offset, place);
        const sample = track.findNearestSampleAnywhere(place.x, place.z);
        // Where another stretch passes close, the nearest sample is on that stretch, and the tree would stand on it
        if (Math.abs(track.measureOffset(place.x, place.z, sample)) < half + KERB_CLEAR) continue;
        nearSample[sample].push(trees.length);
        trees.push({ x: place.x, z: place.z, size: random.between(0.8, 1.5) });
    }

    return {
        trees,
        findTreeTouching(carX, carZ, carHeading, sample) {
            const count = track.samples.length;
            for (let offset = -SEARCH_REACH; offset <= SEARCH_REACH; offset++) {
                const near = nearSample[(sample + offset + count) % count];
                for (let i = 0; i < near.length; i++) {
                    const tree = trees[near[i]];
                    if (isCircleTouchingCar(tree.x, tree.z, TREE_RADIUS * tree.size, carX, carZ, carHeading)) return near[i];
                }
            }
            return -1;
        },
        isTreeWithin(x, z, radius, sample) {
            const count = track.samples.length;
            for (let offset = -SEARCH_REACH; offset <= SEARCH_REACH; offset++) {
                const near = nearSample[(sample + offset + count) % count];
                for (let i = 0; i < near.length; i++) {
                    const tree = trees[near[i]];
                    const reach = radius + TREE_RADIUS * tree.size;
                    const dx = tree.x - x;
                    const dz = tree.z - z;
                    if (dx * dx + dz * dz < reach * reach) return true;
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far past the start line the trees begin, and before it they end, so the start is clear. */
const START_CLEAR = 80;
/** How far a tree stands from the kerb, at least. */
const KERB_CLEAR = 3;
/** How far a tree stands from the wall, at least. */
const WALL_CLEAR = 2;
/** How many samples either side of the car's the trees are checked at. A tree's nearest sample is never further. */
const SEARCH_REACH = 12;
