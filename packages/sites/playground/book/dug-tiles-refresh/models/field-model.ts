import type { Random } from './seeded-random';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a digger takes to move one tile, in ms. */
const STEP_MS = 40;

/** The chance, each step, that a digger turns left, and the same chance that it turns right. */
const TURN_CHANCE = 0.12;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One tile of the field, which starts full of dirt, and stays dug once a digger has been through it. */
export interface Tile {
    readonly row: number;
    readonly col: number;
    readonly isDug: boolean;
}

/**
 * A field of dirt, and diggers that wander through it, one tile at a time,
 * digging every tile they reach. Positions are in tiles.
 */
export interface FieldModel {
    readonly rows: number;
    readonly cols: number;
    /** Every tile, by row, then column: tile `row * cols + col`. */
    readonly tiles: readonly Tile[];
    /** How many tiles have been dug. */
    readonly dugCount: number;
    readonly diggerCount: number;
    readonly diggerRowAt: (index: number) => number;
    readonly diggerColAt: (index: number) => number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FieldModelOptions {
    readonly rows: number;
    readonly cols: number;
    readonly diggerCount: number;
    /** Where the diggers start, and where they turn, come from this. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a field full of dirt, with each digger in a hole of its own. */
export function createFieldModel({ rows, cols, diggerCount, random }: FieldModelOptions): FieldModel {
    const tiles: MutableTile[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) tiles.push({ row, col, isDug: false });
    }
    let dugCount = 0;

    // Each digger's tile, and the way it's heading, as an index into STEPS
    const diggerRows: number[] = [];
    const diggerCols: number[] = [];
    const headings: number[] = [];
    for (let i = 0; i < diggerCount; i++) {
        diggerRows.push(Math.floor(random() * rows));
        diggerCols.push(Math.floor(random() * cols));
        headings.push(Math.floor(random() * STEPS.length));
        dig(diggerRows[i], diggerCols[i]);
    }
    // Time since the diggers last stepped, in ms
    let sinceStepMs = 0;

    const model: FieldModel = {
        rows,
        cols,
        tiles,
        get dugCount() { return dugCount; },
        diggerCount,
        diggerRowAt: (index) => diggerRows[index],
        diggerColAt: (index) => diggerCols[index],

        update(deltaMs) {
            sinceStepMs += deltaMs;
            while (sinceStepMs >= STEP_MS) {
                sinceStepMs -= STEP_MS;
                for (let i = 0; i < diggerCount; i++) stepDigger(i);
            }
        },
    };

    return model;

    function stepDigger(index: number): void {
        const roll = random();
        if (roll < TURN_CHANCE) headings[index] = (headings[index] + 1) % STEPS.length;
        else if (roll < 2 * TURN_CHANCE) headings[index] = (headings[index] + STEPS.length - 1) % STEPS.length;
        let step = STEPS[headings[index]];
        let row = diggerRows[index] + step.rows;
        let col = diggerCols[index] + step.cols;
        // At the edge of the field, it turns back
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            headings[index] = (headings[index] + 2) % STEPS.length;
            step = STEPS[headings[index]];
            row = diggerRows[index] + step.rows;
            col = diggerCols[index] + step.cols;
        }
        diggerRows[index] = row;
        diggerCols[index] = col;
        dig(row, col);
    }

    function dig(row: number, col: number): void {
        const tile = tiles[row * cols + col];
        if (tile.isDug) return;
        tile.isDug = true;
        dugCount++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One tile's step in each direction a digger can head: right, down, left and up, in turn. */
const STEPS: readonly { readonly rows: number; readonly cols: number }[] = [
    { rows: 0, cols: 1 },
    { rows: 1, cols: 0 },
    { rows: 0, cols: -1 },
    { rows: -1, cols: 0 },
];

interface MutableTile extends Tile {
    isDug: boolean;
}
