import { FOREST_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** The shape of a tree's leaves. Every leaf on a tree has the same one. */
export type LeafKind = 'blade' | 'diamond' | 'triangle' | 'hexagon';

/** A branch, from its base to its tip, in its tree's units, up from the tree's base. */
export interface Branch {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
    /** How thick it is, in its tree's units. */
    readonly thickness: number;
    /** How much of it has grown, from 0 to 1. */
    readonly growth: number;
}

/** A leaf, on its tree or fallen from it, in its tree's units. A fallen leaf lies a little below 0, on the ground. */
export interface Leaf {
    readonly x: number;
    readonly y: number;
    /** Which way it points, in radians, anticlockwise from pointing right. */
    readonly angle: number;
    /** How big it has grown, from 0 (a closed bud) to 1. */
    readonly size: number;
    /** How far it has turned for autumn, from 0 (green) to 1 (red). */
    readonly turn: number;
    /** Whether it is still on its tree, and so moves with it in the wind. */
    readonly isAttached: boolean;
    /** How much of it is left, from 1 down to 0, as a fallen leaf rots away in winter. */
    readonly remains: number;
}

/** A tree: a fractal, each branch splitting in two by the same rule all the way out. */
export interface Tree {
    /** Where it stands across the forest, in forest units. */
    readonly x: number;
    /** How far back it stands, from 0 at the front to 1 at the back. It stays the same each year. */
    readonly distance: number;
    readonly leafKind: LeafKind;
    /** How tall it is, in its own units. */
    readonly height: number;
    readonly branches: readonly Branch[];
    readonly leaves: readonly Leaf[];
}

/**
 * A small forest through a year, again and again. In spring new trees grow
 * from the ground, branch by branch, and come into leaf. In summer they stand
 * green. In autumn their leaves turn and fall, and in winter they rot away. At
 * the end of winter the old trees fade, and new ones, never the same, grow in
 * their places.
 */
export interface ForestModel {
    readonly season: Season;
    /** How far through the year it is, from 0 at the start of spring to 1. */
    readonly yearProgress: number;
    /** How much of the trees is there, from 1 down to 0 as they fade at the end of winter. */
    readonly presence: number;
    /** Seconds since the first year began. */
    readonly time: number;
    /** The trees, from the back of the forest to the front: the same trees every year, grown anew. */
    readonly trees: readonly Tree[];
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Starts the first spring, with new trees about to grow. */
export function createForestModel(): ForestModel {
    const trees: TreeState[] = PLACES.map((place) => ({
        x: 0, distance: place.distance, leafKind: 'blade', height: 0, branches: [], leaves: [], place,
    }));
    let yearSeconds = 0;
    let time = 0;
    for (let i = 0; i < trees.length; i++) growTree(trees[i]);

    return {
        get season() { return SEASONS[Math.min(3, Math.floor((yearSeconds / YEAR_SECONDS) * 4))]; },
        get yearProgress() { return yearSeconds / YEAR_SECONDS; },
        get presence() { return Math.min(1, (YEAR_SECONDS - yearSeconds) / FADE_SECONDS); },
        get time() { return time; },
        trees,
        update(deltaMs) {
            time += deltaMs / 1000;
            yearSeconds += deltaMs / 1000;
            if (yearSeconds >= YEAR_SECONDS) {
                yearSeconds -= YEAR_SECONDS;
                for (let i = 0; i < trees.length; i++) growTree(trees[i]);
            }
            for (let t = 0; t < trees.length; t++) {
                const tree = trees[t];
                for (let i = 0; i < tree.branches.length; i++) {
                    const branch = tree.branches[i];
                    branch.growth = clamp01((yearSeconds - branch.startSeconds) / GROW_SECONDS);
                }
                for (let i = 0; i < tree.leaves.length; i++) moveLeaf(tree.leaves[i]);
            }
        },
    };

    /** Plans a new tree in a tree's place: its rule, every branch and when it grows, and every leaf. */
    function growTree(tree: TreeState): void {
        tree.branches.length = 0;
        tree.leaves.length = 0;
        tree.height = 0;
        tree.x = tree.place.x + (Math.random() - 0.5) * 1.5;
        tree.leafKind = LEAF_KINDS[Math.floor(Math.random() * LEAF_KINDS.length)];
        const rule: Rule = {
            spread: 0.22 + Math.random() * 0.5,
            // Lopsided a little one way, and turning a little as it goes up
            lean: (Math.random() - 0.5) * 0.7,
            twist: (Math.random() - 0.5) * 0.22,
            shrink: 0.66 + Math.random() * 0.14,
            depth: tree.place.depth,
            startSeconds: Math.random() * 2,
        };
        addBranch(tree, rule, 0, 0, Math.PI / 2, TRUNK_LENGTH, TRUNK_THICKNESS, 0);
    }

    function addBranch(tree: TreeState, rule: Rule, x: number, y: number, angle: number, length: number, thickness: number, depth: number): void {
        const x1 = x + Math.cos(angle) * length;
        // A tree that curls hard would reach into the ground, so its lowest branches end a little above it
        const y1 = Math.max(LOWEST_TIP, y + Math.sin(angle) * length);
        const startSeconds = rule.startSeconds + depth * GROW_SECONDS;
        tree.branches.push({ x0: x, y0: y, x1, y1, thickness, growth: 0, startSeconds });
        tree.height = Math.max(tree.height, y1);
        // Leaves grow at the ends of the last two levels of branches
        if (depth >= rule.depth - 1) addLeaf(tree, x1, y1, angle, startSeconds + GROW_SECONDS);
        if (depth === rule.depth) return;
        const jitter = (Math.random() - 0.5) * 0.08;
        const turn = angle + rule.twist + jitter;
        addBranch(tree, rule, x1, y1, turn + rule.spread * (1 + rule.lean), length * rule.shrink, thickness * 0.66, depth + 1);
        addBranch(tree, rule, x1, y1, turn - rule.spread * (1 - rule.lean), length * rule.shrink, thickness * 0.66, depth + 1);
    }

    function addLeaf(tree: TreeState, x: number, y: number, angle: number, budSeconds: number): void {
        tree.leaves.push({
            x, y, angle, size: 0, turn: 0, isAttached: true, remains: 1,
            attachX: x,
            attachY: y,
            attachAngle: angle,
            budSeconds,
            fallSeconds: YEAR_SECONDS * (0.56 + Math.random() * 0.18),
            restY: -Math.random() * 1.6,
            flutter: Math.random() * Math.PI * 2,
        });
    }

    /** Where a leaf is this moment of the year, how grown, how turned, and whether it has fallen. */
    function moveLeaf(leaf: LeafState): void {
        leaf.size = clamp01((yearSeconds - leaf.budSeconds) / BUD_SECONDS);
        leaf.turn = clamp01((yearSeconds - AUTUMN_START) / (leaf.fallSeconds - AUTUMN_START));
        leaf.remains = 1 - clamp01((yearSeconds - ROT_START) / (YEAR_SECONDS - ROT_START - FADE_SECONDS));
        leaf.isAttached = yearSeconds < leaf.fallSeconds;
        if (leaf.isAttached) {
            leaf.x = leaf.attachX;
            leaf.y = leaf.attachY;
            leaf.angle = leaf.attachAngle;
            return;
        }
        // It flutters down, swinging from side to side and spinning, until it lands. The swing
        // starts from where the leaf was, so it does not jump as it lets go.
        const falling = Math.min(yearSeconds - leaf.fallSeconds, (leaf.attachY - leaf.restY) / FALL_SPEED);
        const swing = Math.sin(falling * 2.4 + leaf.flutter) - Math.sin(leaf.flutter);
        leaf.x = leaf.attachX + swing * 0.4 + falling * 0.15;
        leaf.y = Math.max(leaf.restY, leaf.attachY - falling * FALL_SPEED);
        leaf.angle = leaf.attachAngle + falling * 3;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A place in the forest that a tree grows in each year: roughly where, how far back, and how many times it branches. */
interface Place {
    x: number;
    distance: number;
    depth: number;
}

/** How a tree branches: the same at every split, so it grows as a fractal. */
interface Rule {
    /** The angle between each branch and either of its two children, in radians. */
    spread: number;
    /** How much wider one child's angle is than the other's, as a share of `spread`. */
    lean: number;
    /** How much each split turns from its branch, in radians, so the tree curls one way. */
    twist: number;
    /** Each branch's length as a share of its parent's. */
    shrink: number;
    /** How many times it splits, from the trunk out. */
    depth: number;
    /** When in spring it starts to grow. */
    startSeconds: number;
}

interface TreeState {
    x: number;
    distance: number;
    leafKind: LeafKind;
    height: number;
    branches: BranchState[];
    leaves: LeafState[];
    place: Place;
}

interface BranchState {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    thickness: number;
    growth: number;
    startSeconds: number;
}

interface LeafState {
    x: number;
    y: number;
    angle: number;
    size: number;
    turn: number;
    isAttached: boolean;
    remains: number;
    attachX: number;
    attachY: number;
    attachAngle: number;
    budSeconds: number;
    fallSeconds: number;
    /** How far below the tree's base it comes to rest. */
    restY: number;
    /** Where in its swing it starts to flutter down, in radians. */
    flutter: number;
}

/** The trees' places, from the back of the forest to the front. Further back, they branch fewer times. */
const PLACES: readonly Place[] = [
    { x: FOREST_WIDTH * 0.12, distance: 1, depth: 6 },
    { x: FOREST_WIDTH * 0.5, distance: 1, depth: 6 },
    { x: FOREST_WIDTH * 0.86, distance: 1, depth: 6 },
    { x: FOREST_WIDTH * 0.28, distance: 0.5, depth: 7 },
    { x: FOREST_WIDTH * 0.74, distance: 0.5, depth: 7 },
    { x: FOREST_WIDTH * 0.5, distance: 0, depth: 8 },
];

const LEAF_KINDS: readonly LeafKind[] = ['blade', 'diamond', 'triangle', 'hexagon'];
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const YEAR_SECONDS = 60;
const AUTUMN_START = YEAR_SECONDS / 2;
/** When fallen leaves start to rot away: a little into winter. */
const ROT_START = YEAR_SECONDS * 0.82;
/** How long the old trees take to fade at the end of winter. */
const FADE_SECONDS = 3;

/** How long each branch takes to grow. Each starts as its parent finishes. */
const GROW_SECONDS = 1.4;
/** How long a leaf takes to open from a bud. */
const BUD_SECONDS = 2;
/** How fast a leaf falls, in its tree's units per second. */
const FALL_SPEED = 1.6;

/** The lowest a branch may end, in its tree's units above the ground. */
const LOWEST_TIP = 0.5;
const TRUNK_LENGTH = 2.2;
const TRUNK_THICKNESS = 0.3;

function clamp01(n: number): number {
    return Math.min(1, Math.max(0, n));
}
