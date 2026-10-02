import { batch } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { assert } from '#mvt-utils';
import {
    FLOW_SIGHT_CELLS, GRAVITY, MAX_FALL_SPEED, MAX_FLOW_CELLS, SINK_CHANCE, STEPS_TO_SLEEP,
} from '../model-constants';
import type { GrainGrid, GrainGridOptions, GrainGridSnapshot, GrainKind, Grains } from './grain-grid';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A `GrainGrid` written as a SolidJS developer would write it: its state in
 * one `createStore`, read through the store and written with the store's
 * setter, so every read is tracked. A Solid effect that reads a grain
 * through `grains` subscribes to it, and re-runs when that grain changes;
 * nothing else needs telling. The grains are records, as in
 * `createObjectGrainGrid`, and the board is an array of cells holding the id
 * of the grain in each, as Solid's own grid examples keep a board.
 *
 * Only the simulation's own bookkeeping, which nothing presents, is kept
 * outside the store, as a Solid developer would keep any internal index: the
 * order it visits moving grains in, and which ids are free. Both are part of
 * the rules (they decide who moves first and which id a new grain gets), and
 * are kept the same as the other grids', so all three stay identical.
 *
 * Its rules are the same as `createObjectGrainGrid`'s, line for line; only
 * how the state is held differs. Keep them in step.
 */
export function createStoreGrainGrid(options: GrainGridOptions): GrainGrid {
    const { cols, rows, random } = options;
    const capacity = cols * rows;

    const [state, setState] = createStore<GridState>({
        grains: [],
        cells: createEmptyCells(capacity),
        idBound: 0,
        grainCount: 0,
    });

    // The grains `step()` visits, packed, with swap-remove on sleep, and each
    // grain's index in it, or -1 while asleep.
    const moving: number[] = [];
    const movingIndices = new Int32Array(capacity).fill(-1);
    // A copy of `moving` taken at the start of each step, so grains woken
    // during a step wait for the next one.
    const stepBatch: number[] = [];
    // Free ids as a stack. Popping takes the lowest free id first, which keeps
    // `grains.length` (the highest id in use, plus one) as low as possible.
    const freeIds: number[] = [];
    let isScanReversed = false;

    const grains = createTrackedGrains(state);

    const grid: GrainGrid = {
        cols,
        rows,
        storage: 'store',
        grains,
        get grainCount() { return state.grainCount; },
        get movingCount() { return moving.length; },
        kindAt,
        add,
        remove,
        step,
        rotateHalfTurn,
        clear,
        batch,
        save,
        load,
    };

    clear();
    return grid;

    // --- Queries ------------------------------------------------------------

    function kindAt(col: number, row: number): GrainKind | undefined {
        if (!isInside(col, row)) return undefined;
        const id = state.cells[row * cols + col];
        return id === undefined ? undefined : state.grains[id]!.kind;
    }

    // --- Structural edits ---------------------------------------------------

    function add(col: number, row: number, kind: GrainKind, fallSpeed = 0): boolean {
        if (!isEmpty(col, row) || freeIds.length === 0) return false;

        const id = freeIds.pop()!;
        const flowDir = random() < 0.5 ? -1 : 1;
        setState('grains', id, { col, row, kind, fallSpeed, stillSteps: 0, flowDir });
        setState('cells', row * cols + col, id);
        setState('grainCount', (count) => count + 1);
        if (id >= state.idBound) setState('idBound', id + 1);

        if (kind !== 'wall') startMoving(id);
        return true;
    }

    function remove(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const id = state.cells[row * cols + col];
        if (id === undefined) return;

        setState('cells', row * cols + col, undefined);
        if (movingIndices[id] >= 0) stopMoving(id);
        setState('grains', id, undefined);
        setState('grainCount', (count) => count - 1);
        freeIds.push(id);

        // Keep `grains.length` tight, so a list projecting `grains` does not
        // visit a tail of empty slots.
        let bound = state.idBound;
        while (bound > 0 && state.grains[bound - 1] === undefined) bound--;
        setState('idBound', bound);

        wakeNeighboursOf(col, row);
    }

    function clear(): void {
        setState({ grains: [], cells: createEmptyCells(capacity), idBound: 0, grainCount: 0 });
        moving.length = 0;
        movingIndices.fill(-1);
        freeIds.length = 0;
        // Highest id at the bottom of the stack, so the lowest pops first.
        for (let id = capacity - 1; id >= 0; id--) freeIds.push(id);
    }

    function rotateHalfTurn(): void {
        // A half turn maps every cell to a distinct cell, so the board can be
        // cleared and restamped with no collisions.
        moving.length = 0;
        movingIndices.fill(-1);
        setState(produce((draft) => {
            draft.cells = createEmptyCells(capacity);
            for (let id = 0; id < draft.idBound; id++) {
                const grain = draft.grains[id];
                if (grain === undefined) continue;
                grain.col = cols - 1 - grain.col;
                grain.row = rows - 1 - grain.row;
                grain.fallSpeed = 0;
                grain.stillSteps = 0;
                draft.cells[grain.row * cols + grain.col] = id;
            }
        }));
        for (let id = 0; id < state.idBound; id++) {
            const grain = state.grains[id];
            if (grain !== undefined && grain.kind !== 'wall') startMoving(id);
        }
    }

    // --- Saving and loading -------------------------------------------------

    function save(): GrainGridSnapshot {
        const count = state.idBound;
        const kinds: (GrainKind | undefined)[] = [];
        const grainCols = new Int32Array(count);
        const grainRows = new Int32Array(count);
        const fallSpeeds = new Float64Array(count);
        const stillSteps = new Int32Array(count);
        const flowDirs = new Int8Array(count);
        for (let id = 0; id < count; id++) {
            const grain = state.grains[id];
            kinds.push(grain?.kind);
            if (grain === undefined) continue;
            grainCols[id] = grain.col;
            grainRows[id] = grain.row;
            fallSpeeds[id] = grain.fallSpeed;
            stillSteps[id] = grain.stillSteps;
            flowDirs[id] = grain.flowDir;
        }
        return {
            cols,
            rows,
            kinds,
            grainCols,
            grainRows,
            fallSpeeds,
            stillSteps,
            flowDirs,
            moving: Int32Array.from(moving),
            freeIds: Int32Array.from(freeIds),
            isScanReversed,
        };
    }

    function load(snapshot: GrainGridSnapshot): void {
        assert(
            snapshot.cols === cols && snapshot.rows === rows,
            () => `Cannot load a ${snapshot.cols} x ${snapshot.rows} grid into a ${cols} x ${rows} one`,
        );
        const loadedGrains: (StoredGrain | undefined)[] = [];
        const cells = createEmptyCells(capacity);
        let grainCount = 0;
        for (let id = 0; id < snapshot.kinds.length; id++) {
            const kind = snapshot.kinds[id];
            if (kind === undefined) {
                loadedGrains.push(undefined);
                continue;
            }
            const col = snapshot.grainCols[id];
            const row = snapshot.grainRows[id];
            loadedGrains.push({
                col,
                row,
                kind,
                fallSpeed: snapshot.fallSpeeds[id],
                stillSteps: snapshot.stillSteps[id],
                flowDir: snapshot.flowDirs[id],
            });
            cells[row * cols + col] = id;
            grainCount++;
        }
        setState({ grains: loadedGrains, cells, idBound: snapshot.kinds.length, grainCount });

        moving.length = 0;
        movingIndices.fill(-1);
        for (let i = 0; i < snapshot.moving.length; i++) startMoving(snapshot.moving[i]);
        freeIds.length = 0;
        for (let i = 0; i < snapshot.freeIds.length; i++) freeIds.push(snapshot.freeIds[i]);
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

    function stepGrain(id: number): void {
        const hasMoved = state.grains[id]!.kind === 'sand' ? stepSand(id) : stepWater(id);
        if (hasMoved) {
            setState('grains', id, 'stillSteps', 0);
        }
        else {
            setState('grains', id, 'stillSteps', (steps) => steps + 1);
            if (state.grains[id]!.stillSteps >= STEPS_TO_SLEEP) stopMoving(id);
        }
    }

    /** Sand falls, sinks through water, or slides diagonally down. Returns whether it is still active. */
    function stepSand(id: number): boolean {
        const { col, row } = state.grains[id]!;
        if (isEmpty(col, row + 1)) {
            fall(id);
            return true;
        }
        setState('grains', id, 'fallSpeed', 0);

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
        const { col, row } = state.grains[id]!;
        if (isEmpty(col, row + 1)) {
            fall(id);
            return true;
        }
        setState('grains', id, 'fallSpeed', 0);

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
        if (flow(id, state.grains[id]!.flowDir, isPressed)) return true;
        setState('grains', id, 'flowDir', (flowDir) => -flowDir);
        return flow(id, state.grains[id]!.flowDir, isPressed);
    }

    /**
     * Fall under gravity: speed builds each step, and the grain drops up to
     * that many cells, checking each one so it never passes through anything.
     */
    function fall(id: number): void {
        const { col, row } = state.grains[id]!;
        setState('grains', id, 'fallSpeed', (speed) => Math.min(speed + GRAVITY, MAX_FALL_SPEED));
        let cellsLeft = Math.max(1, Math.floor(state.grains[id]!.fallSpeed));
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
        const { col, row } = state.grains[id]!;
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
            swapWith(id, state.cells[row * cols + col]!);
        }
        return true;
    }

    // --- Movement and waking -----------------------------------------------

    function moveTo(id: number, col: number, row: number): void {
        const { col: fromCol, row: fromRow } = state.grains[id]!;
        setState('cells', fromRow * cols + fromCol, undefined);
        setState('cells', row * cols + col, id);
        setState('grains', id, { col, row });
        wakeNeighboursOf(fromCol, fromRow);
        // Landing on water presses it; it may now be pushed aside.
        wakeWaterAt(col, row + 1);
    }

    function swapWith(id: number, other: number): void {
        const { col, row } = state.grains[id]!;
        const { col: otherCol, row: otherRow } = state.grains[other]!;
        setState('grains', id, { col: otherCol, row: otherRow });
        setState('grains', other, { col, row, fallSpeed: 0 });
        setState('cells', otherRow * cols + otherCol, id);
        setState('cells', row * cols + col, other);
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
        const id = state.cells[row * cols + col];
        if (id !== undefined) wake(id);
    }

    function wakeWaterAt(col: number, row: number): void {
        if (!isInside(col, row)) return;
        const id = state.cells[row * cols + col];
        if (id !== undefined && state.grains[id]!.kind === 'water') wake(id);
    }

    function wake(id: number): void {
        if (state.grains[id]!.kind === 'wall') return;
        setState('grains', id, 'stillSteps', 0);
        if (movingIndices[id] < 0) startMoving(id);
    }

    function startMoving(id: number): void {
        movingIndices[id] = moving.length;
        moving.push(id);
    }

    function stopMoving(id: number): void {
        const index = movingIndices[id];
        const last = moving[moving.length - 1];
        moving[index] = last;
        movingIndices[last] = index;
        moving.pop();
        movingIndices[id] = -1;
    }

    // --- Cell tests ---------------------------------------------------------

    function isInside(col: number, row: number): boolean {
        return col >= 0 && col < cols && row >= 0 && row < rows;
    }

    function isEmpty(col: number, row: number): boolean {
        return isInside(col, row) && state.cells[row * cols + col] === undefined;
    }

    /** Holds sand or water: a grain that can rest its weight on the one below. */
    function isLoose(col: number, row: number): boolean {
        if (!isInside(col, row)) return false;
        const id = state.cells[row * cols + col];
        return id !== undefined && state.grains[id]!.kind !== 'wall';
    }

    function isWater(col: number, row: number): boolean {
        if (!isInside(col, row)) return false;
        const id = state.cells[row * cols + col];
        return id !== undefined && state.grains[id]!.kind === 'water';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One grain, as the store holds it. */
interface StoredGrain {
    col: number;
    row: number;
    kind: GrainKind;
    /** Cells per step while falling freely. Reset on landing. */
    fallSpeed: number;
    /** Consecutive steps the grain has failed to move. */
    stillSteps: number;
    /** Which way water last flowed: -1 left, 1 right. */
    flowDir: number;
}

interface GridState {
    /** Every grain, by id; `undefined` for an id no grain holds. */
    grains: (StoredGrain | undefined)[];
    /** The id of the grain in each cell, row by row; `undefined` for an empty cell. */
    cells: (number | undefined)[];
    /** One more than the highest id in use. */
    idBound: number;
    grainCount: number;
}

function createEmptyCells(capacity: number): (number | undefined)[] {
    return new Array<number | undefined>(capacity).fill(undefined);
}

/**
 * `Grains` reading through the store, so a Solid effect that reads a grain
 * subscribes to it. `length` is an accessor, so that it is tracked too, added
 * with `defineProperty` rather than written in the literal: V8 keeps an
 * object literal that has a getter in slow dictionary mode, and cannot then
 * inline calls through it.
 */
function createTrackedGrains(state: GridState): Grains {
    const grains = {
        // Not bounded by `idBound`: every id at or above it is empty anyway,
        // and reading it here would make every effect that checks a grain
        // re-run whenever any grain is added or removed at the top.
        at: (id: number) => (id >= 0 && state.grains[id] !== undefined ? id : undefined),
        colOf: (id: number) => state.grains[id]!.col,
        rowOf: (id: number) => state.grains[id]!.row,
        kindOf: (id: number) => state.grains[id]!.kind,
    };
    Object.defineProperty(grains, 'length', { get: () => state.idBound, enumerable: true });
    return grains as Grains;
}
