import type { IndexedSlots } from '#common';
import { createArrayGrainGrid } from './array-grain-grid';
import { createObjectGrainGrid } from './object-grain-grid';
import { createStoreGrainGrid } from './store-grain-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a grain is made of. */
export type GrainKind = 'sand' | 'water' | 'wall';

/**
 * How a grid stores its grains. All three behave identically, step for step,
 * and differ only in how they hold their data:
 *
 * - `'objects'`: a record per grain, as most JavaScript code would write it.
 * - `'arrays'`: one typed array per field, indexed by grain id, as an
 *   entity-component system would lay it out.
 * - `'store'`: a SolidJS store, as a Solid developer would write it. Its
 *   reads are tracked, so a Solid effect that reads a grain re-runs when
 *   that grain changes; reactive views need this storage.
 */
export type GrainStorageKind = 'objects' | 'arrays' | 'store';

/**
 * Every grain in a grid, addressed by id. Read a grain's fields by its id,
 * rather than through an object per grain, so that storage laid out in
 * arrays can serve reads without creating objects.
 *
 * Shaped like a read-only array, so a `<List>` can project it directly:
 * `length` is one more than the highest id in use, and `at(id)` returns the
 * id back while a grain holds it, and `undefined` while it is free. A grain
 * keeps its id, and so its slot in a list, for its whole life.
 */
export interface Grains extends IndexedSlots<number> {
    /** Cell column, from 0 at the left. Only meaningful for an id a grain holds. */
    colOf: (id: number) => number;
    /** Cell row, from 0 at the top. Gravity pulls toward higher rows. Only meaningful for an id a grain holds. */
    rowOf: (id: number) => number;
    /** Only meaningful for an id a grain holds. */
    kindOf: (id: number) => GrainKind;
}

/**
 * A grid of cells holding at most one grain each, and the rules that move
 * them: one call to `step()` advances every moving grain by one discrete tick.
 *
 * `step()` visits only the grains that are moving. A grain that cannot move
 * for a few steps falls asleep and costs the simulation nothing until a
 * neighbouring cell empties and wakes it. So a settled pile of thousands of
 * grains steps in the time it takes to step its handful of moving ones.
 *
 * Not a model. An MVT model advances only through `update(deltaMs)`; this has
 * no notion of time at all, only discrete steps. `DemoModel` owns it and calls
 * `step()` on a fixed timestep, so the grid is the tank's simulation of the
 * grains, kept separate so the rules can be tested one step at a time.
 *
 * Three implementations, one per `GrainStorageKind`. Given the same random
 * numbers and the same calls, all produce the same grids, so `save()` from
 * one can be loaded into another.
 */
export interface GrainGrid {
    readonly cols: number;
    readonly rows: number;
    readonly storage: GrainStorageKind;

    /** Every grain, addressed by id. */
    readonly grains: Grains;
    /** How many grains are in the grid. */
    readonly grainCount: number;
    /** How many grains the next `step()` will visit. The rest are asleep. */
    readonly movingCount: number;

    /** The kind of grain in a cell, or `undefined` if the cell is empty or outside the grid. */
    kindAt: (col: number, row: number) => GrainKind | undefined;
    /**
     * Put a grain in an empty cell, optionally already falling at `fallSpeed`
     * cells per step. Returns false if the cell is taken or outside the grid.
     */
    add: (col: number, row: number, kind: GrainKind, fallSpeed?: number) => boolean;
    /** Remove the grain in a cell, if any, and wake the grains that can now move into it. */
    remove: (col: number, row: number) => void;
    /** Advance every moving grain by one tick. */
    step: () => void;
    /** Turn the grid upside down: every grain moves to the diametrically opposite cell and wakes. */
    rotateHalfTurn: () => void;
    /** Remove every grain. */
    clear: () => void;
    /**
     * Make a group of edits as one change. A grid whose reads are tracked
     * (`'store'`) tells whoever tracks them once, after `edits` returns, so
     * none of them sees the grid half changed. The others just call `edits`.
     */
    batch: (edits: () => void) => void;

    /** A copy of everything the grid holds, from which `load()` can resume exactly. */
    save: () => GrainGridSnapshot;
    /**
     * Replace the grid's contents with a snapshot from a grid of the same size,
     * of either storage kind. Throws if the sizes differ.
     */
    load: (snapshot: GrainGridSnapshot) => void;
}

/**
 * Everything a grid holds, in plain data. Arrays are indexed by grain id,
 * and cover every id below `kinds.length`, one more than the highest in use.
 * A free id's fields are zero.
 */
export interface GrainGridSnapshot {
    readonly cols: number;
    readonly rows: number;
    /** Each grain's kind, or `undefined` for an id no grain holds. */
    readonly kinds: readonly (GrainKind | undefined)[];
    readonly grainCols: Int32Array;
    readonly grainRows: Int32Array;
    /** Cells per step while falling freely. */
    readonly fallSpeeds: Float64Array;
    /** Consecutive steps each grain has failed to move. */
    readonly stillSteps: Int32Array;
    /** Which way each water grain last flowed: -1 left, 1 right. */
    readonly flowDirs: Int8Array;
    /** Ids of the moving grains, in the order the grid keeps them. */
    readonly moving: Int32Array;
    /** Ids no grain holds, as a stack: the last is handed out first. */
    readonly freeIds: Int32Array;
    /** Whether the last step visited the moving grains in reverse. */
    readonly isScanReversed: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GrainGridOptions {
    readonly cols: number;
    readonly rows: number;
    /** Source of random numbers in `[0, 1)`. Seed it for reproducible runs. */
    readonly random: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** A grid storing its grains the given way. */
export function createGrainGrid(storage: GrainStorageKind, options: GrainGridOptions): GrainGrid {
    switch (storage) {
        case 'objects': return createObjectGrainGrid(options);
        case 'arrays': return createArrayGrainGrid(options);
        case 'store': return createStoreGrainGrid(options);
    }
}
