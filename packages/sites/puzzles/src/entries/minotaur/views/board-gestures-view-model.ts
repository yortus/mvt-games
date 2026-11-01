import type { EdgeMark, MazeGrid } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player's taps and drags on the maze mean. Where a drag starts
 * says what it draws: nearer the middle of a cell than any corner, the
 * path, and nearer a corner, walls.
 *
 * - **The path** follows the cells a drag passes through the middle of.
 *   Each step from a cell to the next marks the edge between them as a
 *   passage.
 * - **Walls** follow the grid's corners a drag passes near. Each step along
 *   a line, from a corner to the next, marks the edge there as a wall.
 * - **A tap** on a wall, or on the path, rubs that mark out.
 *
 * Each drag or tap is one stroke, undone as one. It follows one finger or
 * the mouse at a time. Positions are in cells, across and down from the
 * maze's top left corner, so it knows nothing of pixels or of Pixi, and a
 * test can play it directly.
 */
export interface BoardGesturesViewModel {
    /** A finger, or the mouse, went down at (`x`, `y`). */
    press: (pointerId: number, x: number, y: number) => void;
    move: (pointerId: number, x: number, y: number) => void;
    release: (pointerId: number) => void;
    /** Moves the clock on, which tells a tap from a press. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    readonly grid: MazeGrid;
    readonly markAt: (edge: number) => EdgeMark;
    /** The player began a stroke, with its first mark to come. */
    readonly onStrokeStarted: () => void;
    readonly onEdgeMarked: (edge: number, mark: EdgeMark) => void;
    readonly onStrokeFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the gestures, with no finger down. */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): BoardGesturesViewModel {
    const { grid, markAt, onEdgeMarked } = options;
    const { rows, cols } = grid;
    let clockMs = 0;
    // The finger or mouse followed: what its drag draws, where it went down and when, and how far it has gone
    let pointer: number | undefined;
    let drawing: DrawnMark = 'passage';
    let downX = 0;
    let downY = 0;
    let downMs = 0;
    let travel = 0;
    // Where the drag is: a cell for the path, a corner (numbered row by row over the corners) for walls, or -1
    let at = -1;
    let isStroking = false;

    return {
        press(pointerId, x, y) {
            if (pointer !== undefined) return;
            pointer = pointerId;
            drawing = isNearerCorner(x, y) ? 'wall' : 'passage';
            downX = x;
            downY = y;
            downMs = clockMs;
            travel = 0;
            isStroking = false;
            at = findPlace(x, y);
        },
        move(pointerId, x, y) {
            if (pointerId !== pointer) return;
            travel = Math.max(travel, Math.hypot(x - downX, y - downY));
            const place = findPlace(x, y);
            if (place < 0) return;
            if (at < 0) {
                at = place;
                return;
            }
            // A fast drag can skip a cell or a corner, so the drag steps there one at a time, along the longer way first
            const width = drawing === 'passage' ? cols : cols + 1;
            while (at !== place) {
                const rowGap = Math.floor(place / width) - Math.floor(at / width);
                const colGap = (place % width) - (at % width);
                const next = Math.abs(colGap) >= Math.abs(rowGap) ? at + Math.sign(colGap) : at + Math.sign(rowGap) * width;
                step(at, next);
                at = next;
            }
        },
        release(pointerId) {
            if (pointerId !== pointer) return;
            pointer = undefined;
            const isTap = !isStroking && travel <= TAP_REACH && clockMs - downMs <= TAP_MS;
            if (isTap) rubOutNear(downX, downY);
            if (isStroking) options.onStrokeFinished();
            isStroking = false;
        },
        update(deltaMs) {
            clockMs += deltaMs;
        },
    };

    /** Whether (`x`, `y`) is nearer a corner of the grid than the middle of a cell. Off the grid, only corners are near. */
    function isNearerCorner(x: number, y: number): boolean {
        if (x < 0 || x > cols || y < 0 || y > rows) return true;
        const toMiddle = Math.hypot(x - Math.floor(x) - 0.5, y - Math.floor(y) - 0.5);
        const toCorner = Math.hypot(x - Math.round(x), y - Math.round(y));
        return toCorner < toMiddle;
    }

    /** The cell, or the corner, the pointer is near enough to count as at, by what the drag draws, or -1. */
    function findPlace(x: number, y: number): number {
        if (drawing === 'passage') {
            const col = Math.floor(x);
            const row = Math.floor(y);
            if (col < 0 || col >= cols || row < 0 || row >= rows) return -1;
            const isNearMiddle = Math.abs(x - col - 0.5) < CELL_REACH && Math.abs(y - row - 0.5) < CELL_REACH;
            return isNearMiddle ? row * cols + col : -1;
        }
        const col = Math.round(x);
        const row = Math.round(y);
        if (col < 0 || col > cols || row < 0 || row > rows) return -1;
        const isNearCorner = Math.abs(x - col) < CORNER_REACH && Math.abs(y - row) < CORNER_REACH;
        return isNearCorner ? row * (cols + 1) + col : -1;
    }

    /** Marks the edge the drag crosses, or runs along, from `from` to `to`, next to each other. */
    function step(from: number, to: number): void {
        const edge = drawing === 'passage' ? grid.edgeBetween(from, to) : findEdgeAlong(from, to);
        if (edge < 0) return;
        if (markAt(edge) !== drawing) markEdge(edge, drawing);
    }

    /** The edge on the line between two corners next to each other, or -1 on the border. */
    function findEdgeAlong(from: number, to: number): number {
        const low = Math.min(from, to);
        const row = Math.floor(low / (cols + 1));
        const col = low % (cols + 1);
        if (Math.abs(to - from) === 1) {
            // Along a line between rows, over the cell below it
            return row > 0 && row < rows ? grid.edgeBetween((row - 1) * cols + col, row * cols + col) : -1;
        }
        // Along a line between columns, beside the cell to its right
        return col > 0 && col < cols ? grid.edgeBetween(row * cols + col - 1, row * cols + col) : -1;
    }

    /**
     * What a tap at (`x`, `y`) does: rubs out the mark nearest it, among the
     * sides of the cell it is in, if one is near enough. A wall is measured
     * to its line, and a passage to the path's line, which crosses the side
     * from one cell's middle to the other's.
     */
    function rubOutNear(x: number, y: number): void {
        const col = Math.floor(x);
        const row = Math.floor(y);
        if (col < 0 || col >= cols || row < 0 || row >= rows) return;
        let nearest = -1;
        let nearestDistance = TAP_MARK_REACH;
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[(row * cols + col) * 4 + side];
            if (edge < 0 || markAt(edge) === 'unknown') continue;
            const distance = measureToMark(edge, x, y);
            if (distance < nearestDistance) {
                nearest = edge;
                nearestDistance = distance;
            }
        }
        if (nearest >= 0) markEdge(nearest, 'unknown');
    }

    /** How far (`x`, `y`) is from the line `edge`'s mark is drawn along. */
    function measureToMark(edge: number, x: number, y: number): number {
        const cell = grid.edgeCellA[edge];
        const left = cell % cols;
        const top = Math.floor(cell / cols);
        const isBetweenColumns = grid.isEdgeBetweenColumns(edge);
        if (markAt(edge) === 'passage') {
            // From the middle of the cell to the left or above, to the middle of the next
            return isBetweenColumns
                ? measureToSegment(x, y, left + 0.5, top + 0.5, left + 1.5, top + 0.5)
                : measureToSegment(x, y, left + 0.5, top + 0.5, left + 0.5, top + 1.5);
        }
        // Along the line on the cell's right, or under it
        return isBetweenColumns
            ? measureToSegment(x, y, left + 1, top, left + 1, top + 1)
            : measureToSegment(x, y, left, top + 1, left + 1, top + 1);
    }

    function markEdge(edge: number, mark: EdgeMark): void {
        if (!isStroking) {
            isStroking = true;
            options.onStrokeStarted();
        }
        onEdgeMarked(edge, mark);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What a drag draws. */
type DrawnMark = Exclude<EdgeMark, 'unknown'>;

/** A tap is a touch let go within this time, in ms, and this distance, in cells. */
const TAP_MS = 350;
const TAP_REACH = 0.2;
/** How near a mark a tap must be to rub it out, in cells. */
const TAP_MARK_REACH = 0.3;
/** How near a cell's middle a drag must pass to step into it, and how near a corner, in cells, across and down. */
const CELL_REACH = 0.4;
const CORNER_REACH = 0.32;

/** How far (`x`, `y`) is from the straight line from (`x1`, `y1`) to (`x2`, `y2`), which runs across or down. */
function measureToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
    const nearestX = Math.min(Math.max(x, Math.min(x1, x2)), Math.max(x1, x2));
    const nearestY = Math.min(Math.max(y, Math.min(y1, y2)), Math.max(y1, y2));
    return Math.hypot(x - nearestX, y - nearestY);
}
