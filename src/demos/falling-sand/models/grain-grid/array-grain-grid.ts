import type { GrainGrid, GrainGridOptions, GrainGridSnapshot, GrainKind, Grains } from './grain-grid';
import {
    FLOW_SIGHT_CELLS, GRAVITY, MAX_FALL_SPEED, MAX_FLOW_CELLS, SINK_CHANCE, STEPS_TO_SLEEP,
} from '../model-constants';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A `GrainGrid` that keeps each field of every grain in its own typed array,
 * indexed by grain id: all the columns together, all the rows together, and
 * so on, as an entity-component system would lay them out. The moving grains
 * are a packed array of ids. Nothing here is an object per grain, so the
 * whole grid is a few flat blocks of memory, allocated up front.
 *
 * Its rules are the same as `createObjectGrainGrid`'s, line for line; only
 * the data layout differs. Keep the two in step.
 */
export function createArrayGrainGrid(options: GrainGridOptions): GrainGrid {
    const { cols, rows, random } = options;
    const capacity = cols * rows;

    // occupant[row * cols + col] is the id + 1 of the grain in that cell, or 0 when empty.
    const occupant = new Int32Array(capacity);

    // The grains' fields, one array each, indexed by id. `kinds` holds a
    // `KIND_CODES` value, with `NONE` for an id no grain holds.
    const kinds = new Uint8Array(capacity);
    const grainCols = new Int32Array(capacity);
    const grainRows = new Int32Array(capacity);
    /** Cells per step while falling freely. Reset on landing. */
    const fallSpeeds = new Float64Array(capacity);
    /** Consecutive steps the grain has failed to move. */
    const stillSteps = new Int32Array(capacity);
    /** Which way water last flowed: -1 left, 1 right. */
    const flowDirs = new Int8Array(capacity);
    /** Index in `moving`, or -1 while asleep. */
    const movingIndices = new Int32Array(capacity);

    // Free ids as a stack. Popping takes the lowest free id first, which keeps
    // `grains.length` (the highest id in use, plus one) as low as possible.
    const freeIds = new Int32Array(capacity);
    let freeCount = 0;

    let grainCount = 0;

    // The ids `step()` visits, packed, with swap-remove on sleep.
    const moving = new Int32Array(capacity);
    let movingCount = 0;
    // A copy of `moving` taken at the start of each step, so grains woken
    // during a step wait for the next one.
    const stepBatch = new Int32Array(capacity);
    let isScanReversed = false;

    // `length` bounds the ids that may be live; ids at or above it are all
    // free. A plain field the grid keeps up to date, not a getter: V8 keeps an
    // object literal with a getter in dictionary mode, and then cannot inline
    // calls through it, which views make for every grain every frame.
    const grains: MutableGrains = {
        length: 0,
        at(id) {
            if (id < 0 || id >= grains.length) return undefined;
            return kinds[id] === NONE ? undefined : id;
        },
        colOf: (id) => grainCols[id],
        rowOf: (id) => grainRows[id],
        kindOf: (id) => GRAIN_KINDS[kinds[id]],
    };

    const grid: GrainGrid = {
        cols,
        rows,
        storage: 'arrays',
        grains,
        get grainCount() { return grainCount; },
        get movingCount() { return movingCount; },
        kindAt,
        add,
        remove,
        step,
        rotateHalfTurn,
        clear,
        save,
        load,
    };

    clear();
    return grid;

    // --- Queries ------------------------------------------------------------

    function kindAt(col: number, row: number): GrainKind | undefined {
        if (!isInside(col, row)) return undefined;
        const value = occupant[row * cols + col];
        return value === 0 ? undefined : GRAIN_KINDS[kinds[value - 1]];
    }

    // --- Structural edits ---------------------------------------------------

    function add(col: number, row: number, kind: GrainKind, fallSpeed = 0): boolean {
        if (!isEmpty(col, row) || freeCount === 0) return false;

        const id = freeIds[--freeCount];
        const code = KIND_CODES[kind];
        grainCols[id] = col;
        grainRows[id] = row;
        kinds[id] = code;
        fallSpeeds[id] = fallSpeed;
        stillSteps[id] = 0;
        flowDirs[id] = random() < 0.5 ? -1 : 1;
        occupant[row * cols + col] = id + 1;
        grainCount++;
        if (id >= grains.length) grains.length = id + 1;

        if (code !== WALL) startMoving(id);
        return true;
    }

    function remove(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const value = occupant[row * cols + col];
        if (value === 0) return;

        const id = value - 1;
        occupant[row * cols + col] = 0;
        if (movingIndices[id] >= 0) stopMoving(id);
        kinds[id] = NONE;
        grainCount--;
        freeIds[freeCount++] = id;

        // Keep `grains.length` tight, so a list projecting `grains` does not visit
        // a tail of empty slots.
        while (grains.length > 0 && kinds[grains.length - 1] === NONE) grains.length--;

        wakeNeighboursOf(col, row);
    }

    function clear(): void {
        occupant.fill(0);
        kinds.fill(NONE);
        movingIndices.fill(-1);
        movingCount = 0;
        for (let id = 0; id < capacity; id++) {
            // Highest id at the bottom of the stack, so the lowest pops first.
            freeIds[id] = capacity - 1 - id;
        }
        freeCount = capacity;
        grains.length = 0;
        grainCount = 0;
    }

    function rotateHalfTurn(): void {
        // A half turn maps every cell to a distinct cell, so the grid can be
        // cleared and restamped with no collisions.
        occupant.fill(0);
        movingCount = 0;
        for (let id = 0; id < grains.length; id++) {
            const code = kinds[id];
            if (code === NONE) continue;
            const col = cols - 1 - grainCols[id];
            const row = rows - 1 - grainRows[id];
            grainCols[id] = col;
            grainRows[id] = row;
            fallSpeeds[id] = 0;
            stillSteps[id] = 0;
            movingIndices[id] = -1;
            occupant[row * cols + col] = id + 1;
            if (code !== WALL) startMoving(id);
        }
    }

    // --- Saving and loading -------------------------------------------------

    function save(): GrainGridSnapshot {
        const savedKinds: (GrainKind | undefined)[] = [];
        for (let id = 0; id < grains.length; id++) {
            savedKinds.push(kinds[id] === NONE ? undefined : GRAIN_KINDS[kinds[id]]);
        }
        return {
            cols,
            rows,
            kinds: savedKinds,
            grainCols: grainCols.slice(0, grains.length),
            grainRows: grainRows.slice(0, grains.length),
            fallSpeeds: fallSpeeds.slice(0, grains.length),
            stillSteps: stillSteps.slice(0, grains.length),
            flowDirs: flowDirs.slice(0, grains.length),
            moving: moving.slice(0, movingCount),
            freeIds: freeIds.slice(0, freeCount),
            isScanReversed,
        };
    }

    function load(snapshot: GrainGridSnapshot): void {
        if (snapshot.cols !== cols || snapshot.rows !== rows) {
            throw new Error(`Cannot load a ${snapshot.cols} x ${snapshot.rows} grid into a ${cols} x ${rows} one`);
        }
        clear();
        grains.length = snapshot.kinds.length;
        grainCols.set(snapshot.grainCols);
        grainRows.set(snapshot.grainRows);
        fallSpeeds.set(snapshot.fallSpeeds);
        stillSteps.set(snapshot.stillSteps);
        flowDirs.set(snapshot.flowDirs);
        for (let id = 0; id < grains.length; id++) {
            const kind = snapshot.kinds[id];
            if (kind === undefined) continue;
            kinds[id] = KIND_CODES[kind];
            occupant[grainRows[id] * cols + grainCols[id]] = id + 1;
            grainCount++;
        }
        for (let i = 0; i < snapshot.moving.length; i++) startMoving(snapshot.moving[i]);
        freeIds.set(snapshot.freeIds);
        freeCount = snapshot.freeIds.length;
        isScanReversed = snapshot.isScanReversed;
    }

    // --- Stepping -----------------------------------------------------------

    function step(): void {
        const count = movingCount;
        stepBatch.set(moving.subarray(0, count));

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

    function stepGrain(id: number): void {
        const hasMoved = kinds[id] === SAND ? stepSand(id) : stepWater(id);
        if (hasMoved) {
            stillSteps[id] = 0;
        }
        else if (++stillSteps[id] >= STEPS_TO_SLEEP) {
            stopMoving(id);
        }
    }

    /** Sand falls, sinks through water, or slides diagonally down. Returns whether it is still active. */
    function stepSand(id: number): boolean {
        const col = grainCols[id];
        const row = grainRows[id];
        if (isEmpty(col, row + 1)) {
            fall(id);
            return true;
        }
        fallSpeeds[id] = 0;

        if (isWater(col, row + 1)) return sinkInto(id, col, row + 1);

        const dir = random() < 0.5 ? -1 : 1;
        if (isEmpty(col + dir, row + 1)) {
            moveTo(id, col + dir, row + 1);
            return true;
        }
        if (isEmpty(col - dir, row + 1)) {
            moveTo(id, col - dir, row + 1);
            return true;
        }
        if (isWater(col + dir, row + 1)) return sinkInto(id, col + dir, row + 1);
        if (isWater(col - dir, row + 1)) return sinkInto(id, col - dir, row + 1);
        return false;
    }

    /** Water falls, slides diagonally down, or flows sideways to find its level. */
    function stepWater(id: number): boolean {
        const col = grainCols[id];
        const row = grainRows[id];
        if (isEmpty(col, row + 1)) {
            fall(id);
            return true;
        }
        fallSpeeds[id] = 0;

        const dir = random() < 0.5 ? -1 : 1;
        if (isEmpty(col + dir, row + 1)) {
            moveTo(id, col + dir, row + 1);
            return true;
        }
        if (isEmpty(col - dir, row + 1)) {
            moveTo(id, col - dir, row + 1);
            return true;
        }

        // Flow keeps its direction until blocked, then turns around, so a
        // surface levels out instead of jittering in place.
        const isPressed = isLoose(col, row - 1);
        if (flow(id, flowDirs[id], isPressed)) return true;
        flowDirs[id] = -flowDirs[id];
        return flow(id, flowDirs[id], isPressed);
    }

    /**
     * Fall under gravity: speed builds each step, and the grain drops up to
     * that many cells, checking each one so it never passes through anything.
     */
    function fall(id: number): void {
        const col = grainCols[id];
        const row = grainRows[id];
        const fallSpeed = Math.min(fallSpeeds[id] + GRAVITY, MAX_FALL_SPEED);
        fallSpeeds[id] = fallSpeed;
        let cellsLeft = Math.max(1, Math.floor(fallSpeed));
        let toRow = row;
        while (cellsLeft > 0 && isEmpty(col, toRow + 1)) {
            toRow++;
            cellsLeft--;
        }
        moveTo(id, col, toRow);
    }

    /**
     * Move sideways through empty cells, but only with a reason to: a drop
     * in sight along the row to spill over, or a grain resting on top pushing
     * it aside (`isPressed`). Without either, water lying level stays put, so
     * a surface comes to rest, level to within one cell, instead of wandering
     * forever. Moves at most `MAX_FLOW_CELLS` per step.
     */
    function flow(id: number, dir: number, isPressed: boolean): boolean {
        const col = grainCols[id];
        const row = grainRows[id];
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
        moveTo(id, col + dir * distance, row);
        return true;
    }

    /**
     * Sand swaps places with the water it is resting on, some steps but not
     * all, so it sinks more slowly than it falls. Sinking or not, the grain
     * stays awake: it is not resting on anything solid yet.
     */
    function sinkInto(id: number, col: number, row: number): true {
        if (random() < SINK_CHANCE) {
            swapWith(id, occupant[row * cols + col] - 1);
        }
        return true;
    }

    // --- Movement and waking -----------------------------------------------

    function moveTo(id: number, col: number, row: number): void {
        const fromCol = grainCols[id];
        const fromRow = grainRows[id];
        occupant[fromRow * cols + fromCol] = 0;
        occupant[row * cols + col] = id + 1;
        grainCols[id] = col;
        grainRows[id] = row;
        wakeNeighboursOf(fromCol, fromRow);
        // Landing on water presses it; it may now be pushed aside.
        wakeWaterAt(col, row + 1);
    }

    function swapWith(id: number, other: number): void {
        const col = grainCols[id];
        const row = grainRows[id];
        const otherCol = grainCols[other];
        const otherRow = grainRows[other];
        grainCols[id] = otherCol;
        grainRows[id] = otherRow;
        grainCols[other] = col;
        grainRows[other] = row;
        occupant[otherRow * cols + otherCol] = id + 1;
        occupant[row * cols + col] = other + 1;
        fallSpeeds[other] = 0;
        wake(other);
        // The grain's old cell now holds water, which sand above can sink
        // into. Its new cell is full, as it was.
        wakeNeighboursOf(col, row);
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
        if (value !== 0) wake(value - 1);
    }

    function wakeWaterAt(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const value = occupant[row * cols + col];
        if (value !== 0 && kinds[value - 1] === WATER) wake(value - 1);
    }

    function wake(id: number): void {
        if (kinds[id] === WALL) return;
        stillSteps[id] = 0;
        if (movingIndices[id] < 0) startMoving(id);
    }

    function startMoving(id: number): void {
        movingIndices[id] = movingCount;
        moving[movingCount++] = id;
    }

    function stopMoving(id: number): void {
        const index = movingIndices[id];
        const last = moving[--movingCount];
        moving[index] = last;
        movingIndices[last] = index;
        movingIndices[id] = -1;
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
        return value !== 0 && kinds[value - 1] !== WALL;
    }

    function isWater(col: number, row: number): boolean {
        if (!isInside(col, row)) return false;
        const value = occupant[row * cols + col];
        return value !== 0 && kinds[value - 1] === WATER;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** `Grains`, as the grid that keeps its `length` up to date sees it. */
type MutableGrains = { -readonly [K in keyof Grains]: Grains[K] };

// Grain kinds as stored in `kinds`. `NONE` marks an id no grain holds.
const NONE = 0;
const SAND = 1;
const WATER = 2;
const WALL = 3;

/** A stored kind back to its name, by code. `NONE` maps to a placeholder that is never read. */
const GRAIN_KINDS: readonly GrainKind[] = ['sand', 'sand', 'water', 'wall'];

const KIND_CODES: Readonly<Record<GrainKind, number>> = { sand: SAND, water: WATER, wall: WALL };
