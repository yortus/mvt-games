import type { GrainGrid, GrainGridOptions, GrainGridSnapshot, GrainKind, Grains } from './grain-grid';
import {
    FLOW_SIGHT_CELLS, GRAVITY, MAX_FALL_SPEED, MAX_FLOW_CELLS, SINK_CHANCE, STEPS_TO_SLEEP,
} from '../model-constants';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A `GrainGrid` that keeps a record per grain, as most JavaScript code would:
 * each grain's column, row, kind and motion together in one object, and the
 * moving grains in an array of those objects. The records are allocated up
 * front, one per cell, so adding a grain never allocates.
 *
 * Its rules are the same as `createArrayGrainGrid`'s, line for line; only the
 * data layout differs. Keep the two in step.
 */
export function createObjectGrainGrid(options: GrainGridOptions): GrainGrid {
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

    let grainCount = 0;

    // The grains `step()` visits, packed, with swap-remove on sleep.
    const moving: MutableGrain[] = [];
    // A copy of `moving` taken at the start of each step, so grains woken
    // during a step wait for the next one. Allocated once.
    const stepBatch: MutableGrain[] = [];
    let isScanReversed = false;

    // `length` bounds the ids that may be live; ids at or above it are all
    // free. A plain field the grid keeps up to date, not a getter: V8 keeps an
    // object literal with a getter in dictionary mode, and then cannot inline
    // calls through it, which views make for every grain every frame.
    const grains: MutableGrains = {
        length: 0,
        at(id) {
            if (id < 0 || id >= grains.length) return undefined;
            return pool[id].isLive ? id : undefined;
        },
        colOf: (id) => pool[id].col,
        rowOf: (id) => pool[id].row,
        kindOf: (id) => pool[id].kind,
    };

    const grid: GrainGrid = {
        cols,
        rows,
        storage: 'objects',
        grains,
        get grainCount() { return grainCount; },
        get movingCount() { return moving.length; },
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
        if (grain.id >= grains.length) grains.length = grain.id + 1;

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

        // Keep `grains.length` tight, so a list projecting `grains` does not visit
        // a tail of empty slots.
        while (grains.length > 0 && !pool[grains.length - 1].isLive) grains.length--;

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
        grains.length = 0;
        grainCount = 0;
    }

    function rotateHalfTurn(): void {
        // A half turn maps every cell to a distinct cell, so the grid can be
        // cleared and restamped with no collisions.
        occupant.fill(0);
        moving.length = 0;
        for (let id = 0; id < grains.length; id++) {
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

    // --- Saving and loading -------------------------------------------------

    function save(): GrainGridSnapshot {
        const kinds: (GrainKind | undefined)[] = [];
        const grainCols = new Int32Array(grains.length);
        const grainRows = new Int32Array(grains.length);
        const fallSpeeds = new Float64Array(grains.length);
        const stillSteps = new Int32Array(grains.length);
        const flowDirs = new Int8Array(grains.length);
        for (let id = 0; id < grains.length; id++) {
            const grain = pool[id];
            kinds.push(grain.isLive ? grain.kind : undefined);
            grainCols[id] = grain.col;
            grainRows[id] = grain.row;
            fallSpeeds[id] = grain.fallSpeed;
            stillSteps[id] = grain.stillSteps;
            flowDirs[id] = grain.flowDir;
        }
        const movingIds = new Int32Array(moving.length);
        for (let i = 0; i < moving.length; i++) movingIds[i] = moving[i].id;
        return {
            cols,
            rows,
            kinds,
            grainCols,
            grainRows,
            fallSpeeds,
            stillSteps,
            flowDirs,
            moving: movingIds,
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
        for (let id = 0; id < grains.length; id++) {
            const kind = snapshot.kinds[id];
            if (kind === undefined) continue;
            const grain = pool[id];
            grain.col = snapshot.grainCols[id];
            grain.row = snapshot.grainRows[id];
            grain.kind = kind;
            grain.isLive = true;
            grain.fallSpeed = snapshot.fallSpeeds[id];
            grain.stillSteps = snapshot.stillSteps[id];
            grain.flowDir = snapshot.flowDirs[id];
            occupant[grain.row * cols + grain.col] = id + 1;
            grainCount++;
        }
        for (let i = 0; i < snapshot.moving.length; i++) startMoving(pool[snapshot.moving[i]]);
        freeIds.set(snapshot.freeIds);
        freeCount = snapshot.freeIds.length;
        isScanReversed = snapshot.isScanReversed;
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

/** `Grains`, as the grid that keeps its `length` up to date sees it. */
type MutableGrains = { -readonly [K in keyof Grains]: Grains[K] };

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
