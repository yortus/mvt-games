import type { CellKind, ObstacleSpec } from '../data';
import type { Direction } from './common';
import { measureDistanceSquared, type Placed } from './geometry';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The meadow is a grid of cells, with fences along the lines between them.
 * Cells are named by row and column. So are the grid points at their
 * corners, and point (r, c) is the top left corner of cell (r, c). A fence
 * runs from a point to the next point up, down, left or right, and has no
 * width.
 *
 * The open meadow is split into regions. A region is the cells that reach
 * one another without crossing a fence. Fencing off a region turns it to
 * pasture.
 */
export interface FieldModel {
    /** Rows and columns of cells. Points run one further each way. */
    readonly rows: number;
    readonly cols: number;
    /** Cells that can be fenced off. That is every cell but the ponds and rocks. */
    readonly claimableCount: number;
    /** Cells fenced off so far. */
    readonly claimedCount: number;
    /** The share of the claimable cells fenced off, from 0 to 1. */
    readonly claimedShare: number;
    /** Wires tied off so far. Each rise is a new stretch of fence. */
    readonly closureCount: number;
    /** Cells the latest wire fenced off, and their middle, in cells. */
    readonly lastClosureCells: number;
    readonly lastClosureRow: number;
    readonly lastClosureCol: number;
    /** What cell (row, col) is. Cells off the grid are rock. */
    cellKindAt: (row: number, col: number) => CellKind;
    /** Which wire fenced off cell (row, col), counting from 1, or 0 for one not fenced off. */
    closureAt: (row: number, col: number) => number;
    /** Whether cell (row, col) is open meadow, not yet fenced off. */
    isMeadow: (row: number, col: number) => boolean;
    /** The region of meadow cell (row, col), or -1 for a cell that is not meadow. */
    regionAt: (row: number, col: number) => number;
    /** How many cells region `region` has. */
    regionSize: (region: number) => number;
    /** Whether a fence runs from point (row, col) one step `direction`. */
    hasFence: (row: number, col: number, direction: Direction) => boolean;
    /**
     * Whether there is a fence to walk from point (row, col) one step
     * `direction`. It must have open meadow on at least one side. Fences with
     * pasture on both sides are left behind.
     */
    isWalkable: (row: number, col: number, direction: Direction) => boolean;
    /** Whether point (row, col) is on a fence that can be walked. */
    isOnFence: (row: number, col: number) => boolean;
    /** Whether wire can be strung from point (row, col) one step `direction`, across open meadow and along no fence. */
    canString: (row: number, col: number, direction: Direction) => boolean;
    /**
     * Turns a wire into fence. The wire runs through `length` points, the
     * first at (pathRows[0], pathCols[0]). The meadow's regions are then
     * worked out again, ready for `claimRegions`.
     */
    addFence: (pathRows: ArrayLike<number>, pathCols: ArrayLike<number>, length: number) => void;
    /** Fences off every region for which `isKept` returns false, and returns how many cells that was. */
    claimRegions: (isKept: (region: number) => boolean) => number;
    /** Returns the fence point that `search` asks for, or undefined if there is none. */
    findFencePoint: (search: FencePointSearch) => Placed | undefined;
    /** Returns a way along a walkable fence from point (row, col), or undefined if there is none. */
    findWayAlongFence: (row: number, col: number) => Direction | undefined;
}

/** A search for a point on a walkable fence. */
export interface FencePointSearch {
    /** The point to search from. */
    readonly row: number;
    readonly col: number;
    /** Whether to find the fence point nearest to it, or the one farthest from it. */
    readonly which: 'nearest' | 'farthest';
    /** A point to stay away from, and how far, in grid steps. */
    readonly clearOf?: Placed & { readonly distance: number };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FieldModelOptions {
    readonly rows: number;
    readonly cols: number;
    /** Ponds and rocks, there from the start. */
    readonly obstacles: readonly ObstacleSpec[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a meadow, open but for its ponds and rocks, fenced all round. */
export function createFieldModel(options: FieldModelOptions): FieldModel {
    const { rows, cols, obstacles } = options;
    const cellCount = rows * cols;

    // Each cell's kind, as an index into CELL_KINDS
    const cells = new Uint8Array(cellCount);
    const closures = new Uint16Array(cellCount);
    const regions = new Int32Array(cellCount);
    const regionSizes = new Int32Array(cellCount);
    const keptRegions = new Uint8Array(cellCount);
    // A stack of cells for the flood fill
    const stack = new Int32Array(cellCount);

    // Fences between point (r, c) and (r, c + 1), indexed r * cols + c
    const acrossFences = new Uint8Array((rows + 1) * cols);
    // Fences between point (r, c) and (r + 1, c), indexed r * (cols + 1) + c
    const downFences = new Uint8Array(rows * (cols + 1));

    let regionCount = 0;
    let claimableCount = 0;
    let claimedCount = 0;
    let closureCount = 0;
    let lastClosureCells = 0;
    let lastClosureRowSum = 0;
    let lastClosureColSum = 0;

    placeObstacles();
    fenceRoundMeadow();
    findRegions();

    const model: FieldModel = {
        rows,
        cols,
        get claimableCount() { return claimableCount; },
        get claimedCount() { return claimedCount; },
        get claimedShare() { return claimableCount === 0 ? 0 : claimedCount / claimableCount; },
        get closureCount() { return closureCount; },
        get lastClosureCells() { return lastClosureCells; },
        get lastClosureRow() { return lastClosureCells === 0 ? 0 : lastClosureRowSum / lastClosureCells + 0.5; },
        get lastClosureCol() { return lastClosureCells === 0 ? 0 : lastClosureColSum / lastClosureCells + 0.5; },

        cellKindAt(row, col) {
            if (!isCell(row, col)) return 'rock';
            return CELL_KINDS[cells[row * cols + col]];
        },
        closureAt(row, col) {
            return isCell(row, col) ? closures[row * cols + col] : 0;
        },
        isMeadow,
        regionAt(row, col) {
            return isMeadow(row, col) ? regions[row * cols + col] : -1;
        },
        regionSize(region) {
            return region >= 0 && region < regionCount ? regionSizes[region] : 0;
        },
        hasFence,
        isWalkable(row, col, direction) {
            if (!hasFence(row, col, direction)) return false;
            return isMeadowBeside(row, col, direction, 0) || isMeadowBeside(row, col, direction, 1);
        },
        isOnFence(row, col) {
            return model.isWalkable(row, col, 'up') || model.isWalkable(row, col, 'down')
                || model.isWalkable(row, col, 'left') || model.isWalkable(row, col, 'right');
        },
        canString(row, col, direction) {
            if (!isPoint(row, col) || hasFence(row, col, direction)) return false;
            return isMeadowBeside(row, col, direction, 0) && isMeadowBeside(row, col, direction, 1);
        },

        addFence(pathRows, pathCols, length) {
            for (let i = 1; i < length; i++) {
                setFence(pathRows[i - 1], pathCols[i - 1], pathRows[i], pathCols[i]);
            }
            closureCount++;
            lastClosureCells = 0;
            lastClosureRowSum = 0;
            lastClosureColSum = 0;
            findRegions();
        },

        claimRegions(isKept) {
            for (let region = 0; region < regionCount; region++) {
                keptRegions[region] = isKept(region) ? 1 : 0;
            }
            let claimed = 0;
            for (let i = 0; i < cellCount; i++) {
                if (cells[i] !== MEADOW || keptRegions[regions[i]] === 1) continue;
                cells[i] = PASTURE;
                closures[i] = closureCount;
                regions[i] = -1;
                claimed++;
                lastClosureRowSum += Math.floor(i / cols);
                lastClosureColSum += i % cols;
            }
            claimedCount += claimed;
            lastClosureCells += claimed;
            return claimed;
        },

        findFencePoint(search) {
            const { row, col, which, clearOf } = search;
            const isNearest = which === 'nearest';
            let best = isNearest ? Infinity : -1;
            let foundRow = 0;
            let foundCol = 0;
            for (let r = 0; r <= rows; r++) {
                for (let c = 0; c <= cols; c++) {
                    const distance = measureDistanceSquared(r, c, row, col);
                    if (isNearest ? distance >= best : distance <= best) continue;
                    if (!model.isOnFence(r, c)) continue;
                    if (clearOf !== undefined
                        && measureDistanceSquared(r, c, clearOf.row, clearOf.col) < clearOf.distance * clearOf.distance) continue;
                    best = distance;
                    foundRow = r;
                    foundCol = c;
                }
            }
            const isFound = isNearest ? best !== Infinity : best >= 0;
            return isFound ? { row: foundRow, col: foundCol } : undefined;
        },

        findWayAlongFence(row, col) {
            for (let i = 0; i < DIRECTIONS.length; i++) {
                if (model.isWalkable(row, col, DIRECTIONS[i])) return DIRECTIONS[i];
            }
            return undefined;
        },
    };

    return model;

    // ---- Setting up --------------------------------------------------------

    function placeObstacles(): void {
        for (let i = 0; i < obstacles.length; i++) {
            const { kind, row, col, rowRadius, colRadius } = obstacles[i];
            const code = kind === 'pond' ? POND : ROCK;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const dr = (r + 0.5 - row) / rowRadius;
                    const dc = (c + 0.5 - col) / colRadius;
                    if (dr * dr + dc * dc <= 1) cells[r * cols + c] = code;
                }
            }
        }
        for (let i = 0; i < cellCount; i++) {
            if (cells[i] === MEADOW) claimableCount++;
        }
    }

    /** Fences every line with meadow on one side only. That is round the edge, and round each pond and rock. */
    function fenceRoundMeadow(): void {
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c < cols; c++) {
                acrossFences[r * cols + c] = isMeadow(r - 1, c) === isMeadow(r, c) ? 0 : 1;
            }
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c <= cols; c++) {
                downFences[r * (cols + 1) + c] = isMeadow(r, c - 1) === isMeadow(r, c) ? 0 : 1;
            }
        }
    }

    // ---- Regions -----------------------------------------------------------

    /** Numbers the meadow's regions, by flood fill, and counts their cells. */
    function findRegions(): void {
        regions.fill(-1);
        regionCount = 0;
        for (let start = 0; start < cellCount; start++) {
            if (cells[start] !== MEADOW || regions[start] !== -1) continue;
            const region = regionCount++;
            let size = 0;
            let top = 0;
            stack[top++] = start;
            regions[start] = region;
            while (top > 0) {
                const i = stack[--top];
                size++;
                const r = Math.floor(i / cols);
                const c = i - r * cols;
                // Visit each neighbour, up, down, left and right, that no fence divides from it
                if (r > 0 && acrossFences[r * cols + c] === 0) top = visit(i - cols, region, top);
                if (r < rows - 1 && acrossFences[(r + 1) * cols + c] === 0) top = visit(i + cols, region, top);
                if (c > 0 && downFences[r * (cols + 1) + c] === 0) top = visit(i - 1, region, top);
                if (c < cols - 1 && downFences[r * (cols + 1) + c + 1] === 0) top = visit(i + 1, region, top);
            }
            regionSizes[region] = size;
        }
    }

    function visit(i: number, region: number, top: number): number {
        if (cells[i] !== MEADOW || regions[i] !== -1) return top;
        regions[i] = region;
        stack[top] = i;
        return top + 1;
    }

    // ---- Fences ------------------------------------------------------------

    function hasFence(row: number, col: number, direction: Direction): boolean {
        switch (direction) {
            case 'right': return row >= 0 && row <= rows && col >= 0 && col < cols && acrossFences[row * cols + col] === 1;
            case 'left': return row >= 0 && row <= rows && col > 0 && col <= cols && acrossFences[row * cols + col - 1] === 1;
            case 'down': return row >= 0 && row < rows && col >= 0 && col <= cols && downFences[row * (cols + 1) + col] === 1;
            case 'up': return row > 0 && row <= rows && col >= 0 && col <= cols && downFences[(row - 1) * (cols + 1) + col] === 1;
        }
    }

    function setFence(r0: number, c0: number, r1: number, c1: number): void {
        if (r0 === r1) acrossFences[r0 * cols + Math.min(c0, c1)] = 1;
        else downFences[Math.min(r0, r1) * (cols + 1) + c0] = 1;
    }

    /**
     * Whether a cell beside the line from point (row, col) one step
     * `direction` is meadow. Side 0 is the cell above or to the left of the
     * line, and side 1 the cell below or to the right.
     */
    function isMeadowBeside(row: number, col: number, direction: Direction, side: 0 | 1): boolean {
        switch (direction) {
            case 'right': return isMeadow(row - 1 + side, col);
            case 'left': return isMeadow(row - 1 + side, col - 1);
            case 'down': return isMeadow(row, col - 1 + side);
            case 'up': return isMeadow(row - 1, col - 1 + side);
        }
    }

    // ---- Cells -------------------------------------------------------------

    function isCell(row: number, col: number): boolean {
        return row >= 0 && row < rows && col >= 0 && col < cols;
    }

    function isPoint(row: number, col: number): boolean {
        return row >= 0 && row <= rows && col >= 0 && col <= cols;
    }

    function isMeadow(row: number, col: number): boolean {
        return isCell(row, col) && cells[row * cols + col] === MEADOW;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MEADOW = 0;
const PASTURE = 1;
const POND = 2;
const ROCK = 3;
const CELL_KINDS: readonly CellKind[] = ['meadow', 'pasture', 'pond', 'rock'];
const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];
