import type { EdgeMark, MazeGrid } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player's drags on the maze mean. Where a drag starts says what
 * it draws: nearer the middle of a cell than any corner, the path, and
 * nearer a corner, walls.
 *
 * - **The path** follows the cells a drag passes through the middle of.
 *   Each step from a cell to the next crosses the edge between them.
 * - **Walls** follow the grid's corners a drag passes near. Each step along
 *   a line, from a corner to the next, runs along the edge there.
 *
 * The first edge a drag steps over says whether it draws or rubs out. If
 * that edge is already marked with what the drag draws, the drag rubs out
 * that kind of mark from every edge it steps over. Otherwise it draws on
 * every edge it steps over. So going back over a line just drawn leaves
 * it, and a drag can't flicker between drawing and rubbing out.
 *
 * Each drag is one stroke, undone as one. It follows one finger or
 * the mouse at a time. Positions are in cells, across and down from the
 * maze's top left corner, so it knows nothing of pixels or of Pixi, and a
 * test can play it directly.
 */
export interface BoardGesturesViewModel {
    /** A finger, or the mouse, went down at (`x`, `y`). */
    press: (pointerId: number, x: number, y: number) => void;
    move: (pointerId: number, x: number, y: number) => void;
    release: (pointerId: number) => void;
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
    // The finger or mouse followed, what its drag draws, and whether it draws or rubs out, once its first step says
    let pointer: number | undefined;
    let drawing: DrawnMark = 'passage';
    let effect: StrokeEffect = 'undecided';
    // Where the drag is: a cell for the path, a corner (numbered row by row over the corners) for walls, or -1
    let at = -1;
    let isStroking = false;

    return {
        press(pointerId, x, y) {
            if (pointer !== undefined) return;
            pointer = pointerId;
            drawing = isNearerCorner(x, y) ? 'wall' : 'passage';
            effect = 'undecided';
            isStroking = false;
            at = findPlace(x, y);
        },
        move(pointerId, x, y) {
            if (pointerId !== pointer) return;
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
            if (isStroking) options.onStrokeFinished();
            isStroking = false;
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

    /** Draws on, or rubs out, the edge the drag crosses, or runs along, from `from` to `to`, next to each other. */
    function step(from: number, to: number): void {
        const edge = drawing === 'passage' ? grid.edgeBetween(from, to) : findEdgeAlong(from, to);
        if (edge < 0) return;
        const isDrawn = markAt(edge) === drawing;
        if (effect === 'undecided') effect = isDrawn ? 'rub-out' : 'draw';
        if (effect === 'draw' && !isDrawn) markEdge(edge, drawing);
        else if (effect === 'rub-out' && isDrawn) markEdge(edge, 'unknown');
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

/** Whether a drag draws or rubs out: undecided until it steps over its first edge. */
type StrokeEffect = 'undecided' | 'draw' | 'rub-out';

/** How near a cell's middle a drag must pass to step into it, and how near a corner, in cells, across and down. */
const CELL_REACH = 0.4;
const CORNER_REACH = 0.32;
