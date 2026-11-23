// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What covers one cell of the meadow. Water is the river, sand its banks,
 * grass the open meadow, flowers grass with flowers in it, and a tree grass
 * with a tree on it.
 */
export type MeadowKind = 'water' | 'sand' | 'grass' | 'flowers' | 'tree';

/** What the ground is at a point: the bed of a river, its sandy bank, or grass. */
export type MeadowGround = 'riverbed' | 'sand' | 'grass';

/**
 * The meadow outside: a long valley that runs along x, as far as you can
 * walk. A river winds down the middle of its grassy floor, which rises and
 * falls in low, gentle knolls, and slopes down into the river. Either side,
 * the floor gives way to steep hills, thick with forest, too steep to climb.
 * Trees and flowers grow on a grid of square cells, a metre on a side. Cell
 * (`col`, `row`) covers x from `col` to `col + 1` and z from `row` to
 * `row + 1`. The same seed always makes the same meadow, so the meadow
 * doesn't store anything. It works out each answer from the point asked
 * about.
 */
export interface MeadowTerrain {
    /** What covers the cell. */
    readonly kindAt: (col: number, row: number) => MeadowKind;
    /** The height of the ground at the point (`x`, `z`), in metres. In a river, it's the riverbed, under the water. */
    readonly heightAt: (x: number, z: number) => number;
    /** What the ground is at the point (`x`, `z`). */
    readonly groundAt: (x: number, z: number) => MeadowGround;
    /** A number from 0 to 1 that is different for each cell, for a view to vary how cells look, such as a tree's shape. */
    readonly varietyAt: (col: number, row: number) => number;
    /** The z of the line down the middle of the valley, where it passes `x`. The valley bends a little, slowly. */
    readonly valleyMiddleAt: (x: number) => number;
}

/** The height of the river's surface, in metres. */
export const WATER_LEVEL = -0.15;

/**
 * How far from the valley's middle the player can walk, in metres. It's a
 * few steps into the forest at the foot of the hills, where the ground
 * starts to climb too steeply to go on.
 */
export const VALLEY_WALK_HALF_WIDTH = 26;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MeadowTerrainOptions {
    readonly seed: number;
    /** The middle of a treeless clearing, where the player arrives, in metres. */
    readonly clearingX: number;
    readonly clearingZ: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a meadow. */
export function createMeadowTerrain({ seed, clearingX, clearingZ }: MeadowTerrainOptions): MeadowTerrain {
    return {
        kindAt(col, row) {
            const fromRiver = distanceFromRiver(col + 0.5, row + 0.5);
            if (fromRiver < 0) return 'water';
            if (fromRiver < BANK_WIDTH) return 'sand';
            if (isTree(col, row, fromRiver)) return 'tree';
            return hashCell(col, row, FLOWER_SALT) < FLOWER_SHARE ? 'flowers' : 'grass';
        },

        heightAt(x, z) {
            const fromRiver = distanceFromRiver(x, z);
            // Down into the river, as far as its bed
            if (fromRiver < 0) return Math.max(RIVERBED_HEIGHT, fromRiver * INTO_RIVER_SLOPE);
            // Up across the sandy bank, then into the knolls, which rise to their full height a little way back
            const bank = Math.min(fromRiver, BANK_WIDTH) * BANK_SLOPE;
            const rise = ease(Math.min(1, Math.max(0, (fromRiver - BANK_WIDTH) / KNOLL_RAMP)));
            const knolls = smoothNoise(x / KNOLL_SCALE, z / KNOLL_SCALE, KNOLL_SALT) * KNOLL_HEIGHT
                + smoothNoise(x / HUMMOCK_SCALE, z / HUMMOCK_SCALE, HUMMOCK_SALT) * HUMMOCK_HEIGHT;
            return bank + knolls * rise + hillsideHeight(x, z);
        },

        groundAt(x, z) {
            const fromRiver = distanceFromRiver(x, z);
            if (fromRiver < 0) return 'riverbed';
            return fromRiver < BANK_WIDTH ? 'sand' : 'grass';
        },

        varietyAt: (col, row) => hashCell(col, row, VARIETY_SALT),

        valleyMiddleAt,
    };

    function valleyMiddleAt(x: number): number {
        return VALLEY_BEND * Math.sin(x / VALLEY_BEND_LENGTH);
    }

    /**
     * How high the hills either side of the valley lift the ground at `x`,
     * `z`: 0 on the floor, then up the steep slope to a ridge whose
     * height wanders along the valley, and on up, more gently, beyond it.
     */
    function hillsideHeight(x: number, z: number): number {
        const middle = valleyMiddleAt(x);
        const pastFloor = Math.abs(z - middle) - FLOOR_HALF_WIDTH;
        if (pastFloor <= 0) return 0;
        const climb = ease(Math.min(1, pastFloor / HILLSIDE_WIDTH));
        // Each side's ridge rises and falls along the valley in its own way
        const side = z < middle ? 0 : RIDGE_SIDE_APART;
        const ridge = HILLSIDE_HEIGHT + (smoothNoise(x / RIDGE_SCALE, side, RIDGE_SALT) - 0.5) * RIDGE_VARIATION;
        const lumps = smoothNoise(x / LUMP_SCALE, z / LUMP_SCALE, LUMP_SALT) * LUMP_HEIGHT;
        const beyond = Math.max(0, pastFloor - HILLSIDE_WIDTH) * BEYOND_SLOPE;
        return (ridge + lumps) * climb + beyond;
    }

    /**
     * How far the point at `x`, `z` is from the river's bank, in metres, or
     * below 0 inside the river. The river winds its way down the valley's
     * floor, never far enough from the middle to reach the hills.
     */
    function distanceFromRiver(x: number, z: number): number {
        const middle = valleyMiddleAt(x)
            + MEANDER * Math.sin(x / MEANDER_LENGTH)
            + WIGGLE * Math.sin(x / WIGGLE_LENGTH);
        const halfWidth = RIVER_HALF_WIDTH + RIVER_WIDTH_CHANGE * Math.sin(x / 13);
        return Math.abs(z - middle) - halfWidth;
    }

    /**
     * Whether a tree grows on the cell. On the valley's floor, trees grow in
     * groves now and then, and alone here and there, but never by the river
     * or in the clearing. The forest at the foot of the hills thickens fast,
     * and covers the hillsides.
     */
    function isTree(col: number, row: number, fromRiver: number): boolean {
        if (fromRiver < TREE_GAP_FROM_RIVER) return false;
        if (Math.hypot(col + 0.5 - clearingX, row + 0.5 - clearingZ) < CLEARING_RADIUS) return false;
        const intoFringe = Math.abs(row + 0.5 - valleyMiddleAt(col + 0.5)) - (FLOOR_HALF_WIDTH - FOREST_FRINGE);
        if (intoFringe > 0) return hashCell(col, row, TREE_SALT) < Math.min(HILLSIDE_FOREST, intoFringe * FRINGE_THICKENING);
        const forest = smoothNoise(col / FOREST_SCALE, row / FOREST_SCALE, FOREST_SALT);
        // Thickening quickly past a grove's edge, but never so thick that the player can't find a way between the trees
        const chance = forest > FOREST_EDGE ? Math.min(DENSEST_FOREST, (forest - FOREST_EDGE) * FOREST_THICKENING) : LONE_TREE_SHARE;
        return hashCell(col, row, TREE_SALT) < chance;
    }

    /** A number from 0 to 1 for the cell, the same each time, and unrelated to its neighbours'. */
    function hashCell(col: number, row: number, salt: number): number {
        let hash = Math.imul(col, 0x27d4eb2d) ^ Math.imul(row, 0x165667b1) ^ Math.imul(seed + salt, 0x9e3779b1);
        hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
        hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
        hash ^= hash >>> 16;
        return (hash >>> 0) / 4294967296;
    }

    /** Noise from 0 to 1 that changes smoothly from point to point, blending the hashes of the grid's corners round it. */
    function smoothNoise(x: number, z: number, salt: number): number {
        const col = Math.floor(x);
        const row = Math.floor(z);
        const across = ease(x - col);
        const down = ease(z - row);
        const top = mix(hashCell(col, row, salt), hashCell(col + 1, row, salt), across);
        const bottom = mix(hashCell(col, row + 1, salt), hashCell(col + 1, row + 1, salt), across);
        return mix(top, bottom, down);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How deep the rivers are, and how steeply the ground slopes down into them. */
const RIVERBED_HEIGHT = -0.6;
const INTO_RIVER_SLOPE = 0.5;
/** How steeply the sandy banks rise from the water. */
const BANK_SLOPE = 0.15;
/** How wide the river is, and how it winds. */
const RIVER_HALF_WIDTH = 2.2;
const RIVER_WIDTH_CHANGE = 0.8;
const MEANDER = 8;
const MEANDER_LENGTH = 23;
const WIGGLE = 3.5;
const WIGGLE_LENGTH = 9.3;
/** The sandy bank along each side of the river. */
const BANK_WIDTH = 1.2;
/**
 * How wide and high the knolls on the valley's floor are, how wide and high
 * the smaller hummocks on them, and how far from the bank they reach full
 * height. They're low, so you can see a long way down the valley.
 */
const KNOLL_SCALE = 18;
const KNOLL_HEIGHT = 1.4;
const HUMMOCK_SCALE = 6;
const HUMMOCK_HEIGHT = 0.45;
const KNOLL_RAMP = 8;
/** How far the valley bends from a straight line, and how slowly. */
const VALLEY_BEND = 6;
const VALLEY_BEND_LENGTH = 90;
/**
 * The valley's floor reaches this far either side of its middle. Past it,
 * the hillside climbs this far across to the ridge, which is about this
 * high, give or take, and then the ground climbs on, gently, out of sight.
 * Small lumps on the hillside keep its slope from looking smooth.
 */
const FLOOR_HALF_WIDTH = 24;
const HILLSIDE_WIDTH = 30;
const HILLSIDE_HEIGHT = 22;
const RIDGE_SCALE = 45;
const RIDGE_VARIATION = 14;
const RIDGE_SIDE_APART = 7;
const LUMP_SCALE = 9;
const LUMP_HEIGHT = 3;
const BEYOND_SLOPE = 0.3;
/**
 * How wide the groves on the valley's floor are, where their edge is, how
 * quickly they thicken past it, and the share of cells with a tree where
 * they're thickest. Groves are few, so the view down the valley is open.
 */
const FOREST_SCALE = 26;
const FOREST_EDGE = 0.58;
const FOREST_THICKENING = 5;
const DENSEST_FOREST = 0.45;
const LONE_TREE_SHARE = 0.01;
/**
 * The forest at the foot of the hills starts this far onto the floor,
 * thickens this much a metre, and covers this share of the hillside's cells.
 */
const FOREST_FRINGE = 4;
const FRINGE_THICKENING = 0.12;
const HILLSIDE_FOREST = 0.55;
const TREE_GAP_FROM_RIVER = 3;
const CLEARING_RADIUS = 5;
/** How many open cells have flowers. */
const FLOWER_SHARE = 0.08;
/** Salts, so each choice draws on its own hashes. */
const KNOLL_SALT = 11;
const HUMMOCK_SALT = 17;
const RIDGE_SALT = 59;
const LUMP_SALT = 61;
const FOREST_SALT = 23;
const TREE_SALT = 37;
const FLOWER_SALT = 41;
const VARIETY_SALT = 53;

function mix(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

/** Eases `t`, from 0 to 1, in and out, so noise has no creases at the grid's lines. */
function ease(t: number): number {
    return t * t * (3 - 2 * t);
}
