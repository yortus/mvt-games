import type { IndexedSlots } from '#common';
import {
    FLOW_SIGHT_CELLS, GRAVITY, MAX_FALL_SPEED, MAX_FLOW_CELLS, SINK_CHANCE, STEPS_TO_SLEEP,
} from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a grain is made of. */
export type GrainKind = 'sand' | 'water' | 'wall';

/** One grain in the grid, as the view sees it. */
export interface Grain {
    /** Stable for the grain's whole life, and its index in `GrainGrid.grains`. */
    readonly id: number;
    /** Cell column, from 0 at the left. */
    readonly col: number;
    /** Cell row, from 0 at the top. Gravity pulls toward higher rows. */
    readonly row: number;
    readonly kind: GrainKind;
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
 * `step()` on a fixed timestep, so the grid is the demo model's simulation of
 * the grains, kept separate so the rules can be tested one step at a time.
 */
export interface GrainGrid {
    readonly cols: number;
    readonly rows: number;

    /**
     * Every grain, addressed by id and shaped like a read-only array, so a
     * `<List>` can project it directly. An id no grain holds is `undefined`.
     * A grain keeps its id, and so its slot, for its whole life.
     */
    readonly grains: IndexedSlots<Grain>;
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

export function createGrainGrid(options: GrainGridOptions): GrainGrid {
    const { cols, rows, random } = options;
    const capacity = cols * rows;

    // occupant[row * cols + col] is the id + 1 of the grain in that cell, or 0 when empty.
    const occupant = new Int32Array(capacity);

    // One grain record per cell, allocated up front, so adding a grain never allocates.
    const pool: MutableGrain[] = [];
    for (let id = 0; id < capacity; id++) pool.push(createMutableGrain(id));

    // Free ids as a stack. Popping takes the lowest free id first, which keeps
    // `grains.length` (the highest id in use, plus one) as low as possible.
    const freeIds = new Int32Array(capacity);
    let freeCount = 0;

    // Ids below this bound may be live; ids at or above it are all free.
    let idBound = 0;
    let grainCount = 0;

    // The grains `step()` visits, packed, with swap-remove on sleep.
    const moving: MutableGrain[] = [];
    // A copy of `moving` taken at the start of each step, so grains woken
    // during a step wait for the next one. Allocated once.
    const stepBatch: MutableGrain[] = [];
    let isScanReversed = false;

    const grains: IndexedSlots<Grain> = {
        get length() { return idBound; },
        at(index) {
            if (index < 0 || index >= idBound) return undefined;
            const grain = pool[index];
            return grain.isLive ? grain : undefined;
        },
    };

    const grid: GrainGrid = {
        cols,
        rows,
        grains,
        get grainCount() { return grainCount; },
        get movingCount() { return moving.length; },
        kindAt,
        add,
        remove,
        step,
        rotateHalfTurn,
        clear,
    };

    clear();
    return grid;

    // --- Queries ------------------------------------------------------------

    function kindAt(col: number, row: number): GrainKind | undefined {
        if (!isInside(col, row)) return undefined;
        const value = occupant[row * cols + col];
        return value === 0 ? undefined : pool[value - 1].kind;
    }

    // --- Structural edits ---------------------------------------------------

    function add(col: number, row: number, kind: GrainKind, fallSpeed = 0): boolean {
        if (!isEmpty(col, row) || freeCount === 0) return false;

        const grain = pool[freeIds[--freeCount]];
        grain.col = col;
        grain.row = row;
        grain.kind = kind;
        grain.isLive = true;
        grain.fallSpeed = fallSpeed;
        grain.stillSteps = 0;
        grain.flowDir = random() < 0.5 ? -1 : 1;
        occupant[row * cols + col] = grain.id + 1;
        grainCount++;
        if (grain.id >= idBound) idBound = grain.id + 1;

        if (kind !== 'wall') startMoving(grain);
        return true;
    }

    function remove(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const value = occupant[row * cols + col];
        if (value === 0) return;

        const grain = pool[value - 1];
        occupant[row * cols + col] = 0;
        if (grain.movingIndex >= 0) stopMoving(grain);
        grain.isLive = false;
        grainCount--;
        freeIds[freeCount++] = grain.id;

        // Keep `idBound` tight, so a list projecting `grains` does not visit
        // a tail of empty slots.
        while (idBound > 0 && !pool[idBound - 1].isLive) idBound--;

        wakeNeighboursOf(col, row);
    }

    function clear(): void {
        occupant.fill(0);
        moving.length = 0;
        for (let id = 0; id < capacity; id++) {
            const grain = pool[id];
            grain.isLive = false;
            grain.movingIndex = -1;
            // Highest id at the bottom of the stack, so the lowest pops first.
            freeIds[id] = capacity - 1 - id;
        }
        freeCount = capacity;
        idBound = 0;
        grainCount = 0;
    }

    function rotateHalfTurn(): void {
        // A half turn maps every cell to a distinct cell, so the grid can be
        // cleared and restamped with no collisions.
        occupant.fill(0);
        moving.length = 0;
        for (let id = 0; id < idBound; id++) {
            const grain = pool[id];
            if (!grain.isLive) continue;
            grain.col = cols - 1 - grain.col;
            grain.row = rows - 1 - grain.row;
            grain.fallSpeed = 0;
            grain.stillSteps = 0;
            grain.movingIndex = -1;
            occupant[grain.row * cols + grain.col] = id + 1;
            if (grain.kind !== 'wall') startMoving(grain);
        }
    }

    // --- Stepping -----------------------------------------------------------

    function step(): void {
        const count = moving.length;
        for (let i = 0; i < count; i++) stepBatch[i] = moving[i];

        // Alternate the visiting order each step, so no side is systematically
        // first to claim a contested cell.
        isScanReversed = !isScanReversed;
        if (isScanReversed) {
            for (let i = count - 1; i >= 0; i--) stepGrain(stepBatch[i]);
        }
        else {
            for (let i = 0; i < count; i++) stepGrain(stepBatch[i]);
        }
    }

    function stepGrain(grain: MutableGrain): void {
        const hasMoved = grain.kind === 'sand' ? stepSand(grain) : stepWater(grain);
        if (hasMoved) {
            grain.stillSteps = 0;
        }
        else if (++grain.stillSteps >= STEPS_TO_SLEEP) {
            stopMoving(grain);
        }
    }

    /** Sand falls, sinks through water, or slides diagonally down. Returns whether it is still active. */
    function stepSand(grain: MutableGrain): boolean {
        const { col, row } = grain;
        if (isEmpty(col, row + 1)) {
            fall(grain);
            return true;
        }
        grain.fallSpeed = 0;

        if (isWater(col, row + 1)) return sinkInto(grain, col, row + 1);

        const dir = random() < 0.5 ? -1 : 1;
        if (isEmpty(col + dir, row + 1)) {
            moveTo(grain, col + dir, row + 1);
            return true;
        }
        if (isEmpty(col - dir, row + 1)) {
            moveTo(grain, col - dir, row + 1);
            return true;
        }
        if (isWater(col + dir, row + 1)) return sinkInto(grain, col + dir, row + 1);
        if (isWater(col - dir, row + 1)) return sinkInto(grain, col - dir, row + 1);
        return false;
    }

    /** Water falls, slides diagonally down, or flows sideways to find its level. */
    function stepWater(grain: MutableGrain): boolean {
        const { col, row } = grain;
        if (isEmpty(col, row + 1)) {
            fall(grain);
            return true;
        }
        grain.fallSpeed = 0;

        const dir = random() < 0.5 ? -1 : 1;
        if (isEmpty(col + dir, row + 1)) {
            moveTo(grain, col + dir, row + 1);
            return true;
        }
        if (isEmpty(col - dir, row + 1)) {
            moveTo(grain, col - dir, row + 1);
            return true;
        }

        // Flow keeps its direction until blocked, then turns around, so a
        // surface levels out instead of jittering in place.
        const isPressed = isLoose(col, row - 1);
        if (flow(grain, grain.flowDir, isPressed)) return true;
        grain.flowDir = -grain.flowDir;
        return flow(grain, grain.flowDir, isPressed);
    }

    /**
     * Fall under gravity: speed builds each step, and the grain drops up to
     * that many cells, checking each one so it never passes through anything.
     */
    function fall(grain: MutableGrain): void {
        const { col, row } = grain;
        grain.fallSpeed = Math.min(grain.fallSpeed + GRAVITY, MAX_FALL_SPEED);
        let cellsLeft = Math.max(1, Math.floor(grain.fallSpeed));
        let toRow = row;
        while (cellsLeft > 0 && isEmpty(col, toRow + 1)) {
            toRow++;
            cellsLeft--;
        }
        moveTo(grain, col, toRow);
    }

    /**
     * Move sideways through empty cells, but only with a reason to: a drop
     * in sight along the row to spill over, or a grain resting on top pushing
     * it aside (`isPressed`). Without either, water lying level stays put, so
     * a surface comes to rest, level to within one cell, instead of wandering
     * forever. Moves at most `MAX_FLOW_CELLS` per step.
     */
    function flow(grain: MutableGrain, dir: number, isPressed: boolean): boolean {
        const { col, row } = grain;
        let reachCol = col;
        let hasDrop = false;
        for (let n = 0; n < FLOW_SIGHT_CELLS && isEmpty(reachCol + dir, row); n++) {
            reachCol += dir;
            if (isEmpty(reachCol, row + 1)) {
                hasDrop = true;
                break;
            }
        }
        if (reachCol === col || (!hasDrop && !isPressed)) return false;
        const distance = Math.min(Math.abs(reachCol - col), MAX_FLOW_CELLS);
        moveTo(grain, col + dir * distance, row);
        return true;
    }

    /**
     * Sand swaps places with the water it is resting on, some steps but not
     * all, so it sinks more slowly than it falls. Sinking or not, the grain
     * stays awake: it is not resting on anything solid yet.
     */
    function sinkInto(grain: MutableGrain, col: number, row: number): true {
        if (random() < SINK_CHANCE) {
            swapWith(grain, pool[occupant[row * cols + col] - 1]);
        }
        return true;
    }

    // --- Movement and waking -----------------------------------------------

    function moveTo(grain: MutableGrain, col: number, row: number): void {
        const fromCol = grain.col;
        const fromRow = grain.row;
        occupant[fromRow * cols + fromCol] = 0;
        occupant[row * cols + col] = grain.id + 1;
        grain.col = col;
        grain.row = row;
        wakeNeighboursOf(fromCol, fromRow);
        // Landing on water presses it; it may now be pushed aside.
        wakeWaterAt(col, row + 1);
    }

    function swapWith(grain: MutableGrain, other: MutableGrain): void {
        const col = grain.col;
        const row = grain.row;
        grain.col = other.col;
        grain.row = other.row;
        other.col = col;
        other.row = row;
        occupant[grain.row * cols + grain.col] = grain.id + 1;
        occupant[other.row * cols + other.col] = other.id + 1;
        other.fallSpeed = 0;
        wake(other);
        wakeNeighboursOf(col, row);
        wakeNeighboursOf(other.col, other.row);
    }

    /**
     * A cell just emptied: wake every grain that might now move into it or
     * past it. Sand and water above can fall or slide into it. Water along
     * the same row may now see further, to a drop it can flow to. And if the
     * cell above is empty too, water along that row now has a drop in sight.
     */
    function wakeNeighboursOf(col: number, row: number): void {
        wakeAt(col, row - 1);
        wakeAt(col - 1, row - 1);
        wakeAt(col + 1, row - 1);
        wakeWaterInSightOf(col, row, -1);
        wakeWaterInSightOf(col, row, 1);
        if (isEmpty(col, row - 1)) {
            wakeWaterInSightOf(col, row - 1, -1);
            wakeWaterInSightOf(col, row - 1, 1);
        }
    }

    /** Wake the first grain along the row from an empty cell, if it is water in sight of that cell. */
    function wakeWaterInSightOf(col: number, row: number, dir: number): void {
        let c = col + dir;
        for (let n = 1; n < FLOW_SIGHT_CELLS && isEmpty(c, row); n++) c += dir;
        wakeWaterAt(c, row);
    }

    function wakeAt(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const value = occupant[row * cols + col];
        if (value !== 0) wake(pool[value - 1]);
    }

    function wakeWaterAt(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const value = occupant[row * cols + col];
        if (value !== 0 && pool[value - 1].kind === 'water') wake(pool[value - 1]);
    }

    function wake(grain: MutableGrain): void {
        if (grain.kind === 'wall') return;
        grain.stillSteps = 0;
        if (grain.movingIndex < 0) startMoving(grain);
    }

    function startMoving(grain: MutableGrain): void {
        grain.movingIndex = moving.length;
        moving.push(grain);
    }

    function stopMoving(grain: MutableGrain): void {
        const index = grain.movingIndex;
        const last = moving[moving.length - 1];
        moving[index] = last;
        last.movingIndex = index;
        moving.pop();
        grain.movingIndex = -1;
    }

    // --- Cell tests ---------------------------------------------------------

    function isInside(col: number, row: number): boolean {
        return col >= 0 && col < cols && row >= 0 && row < rows;
    }

    function isEmpty(col: number, row: number): boolean {
        return isInside(col, row) && occupant[row * cols + col] === 0;
    }

    /** Holds sand or water: a grain that can rest its weight on the one below. */
    function isLoose(col: number, row: number): boolean {
        if (!isInside(col, row)) return false;
        const value = occupant[row * cols + col];
        return value !== 0 && pool[value - 1].kind !== 'wall';
    }

    function isWater(col: number, row: number): boolean {
        if (!isInside(col, row)) return false;
        const value = occupant[row * cols + col];
        return value !== 0 && pool[value - 1].kind === 'water';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableGrain {
    readonly id: number;
    col: number;
    row: number;
    kind: GrainKind;
    isLive: boolean;
    /** Cells per step while falling freely. Reset on landing. */
    fallSpeed: number;
    /** Consecutive steps the grain has failed to move. */
    stillSteps: number;
    /** Which way water last flowed: -1 left, 1 right. */
    flowDir: number;
    /** Index in the moving list, or -1 while asleep. */
    movingIndex: number;
}

function createMutableGrain(id: number): MutableGrain {
    return {
        id,
        col: 0,
        row: 0,
        kind: 'sand',
        isLive: false,
        fallSpeed: 0,
        stillSteps: 0,
        flowDir: 1,
        movingIndex: -1,
    };
}
