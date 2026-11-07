import { createGridGesturesViewModel, type GridGesturesViewModel } from '@mvtjs/site-kit/input';
import type { EdgeMark, MazeGrid } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a drag over the maze draws: the path, through cells, or walls, along the lines between them. */
export type DrawnMark = Exclude<EdgeMark, 'unknown'>;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardGesturesViewModelOptions {
    readonly grid: MazeGrid;
    /** The player dragged over `edge`: across it, for the path, or along it, for walls. */
    readonly onDraggedOver: (edge: number, mark: DrawnMark) => void;
    /** The player let go, or the drag was cancelled, after dragging over an edge or more. */
    readonly onDragFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the drags on the maze, as the edges they go over. Where a drag
 * starts says what it draws: nearer the middle of a cell than any corner,
 * the path, and nearer a corner, walls.
 *
 * - **The path** follows the cells a drag passes through the middle of.
 *   Each step from a cell to the next crosses the edge between them.
 * - **Walls** follow the grid's corners a drag passes near. Each step along
 *   a line, from a corner to the next, runs along the edge there. The
 *   border has no edges, so a step along it goes over none.
 *
 * It reports only the edges. Whether a drag draws on them or rubs them out
 * is the stroke's to say. Positions are in cells, across and down from the
 * maze's top left corner.
 */
export function createBoardGesturesViewModel(options: BoardGesturesViewModelOptions): GridGesturesViewModel {
    const { grid, onDraggedOver, onDragFinished } = options;
    const gestures = createGridGesturesViewModel({
        rows: grid.rows,
        cols: grid.cols,
        lattice: 'nearest',
        steps: 'four-way',
        cellReach: CELL_REACH,
        cornerReach: CORNER_REACH,
        onStepped(from, to) {
            const isPath = gestures.lattice === 'cells';
            const edge = isPath ? grid.edgeBetween(from, to) : grid.edgeAlong(from, to);
            if (edge >= 0) onDraggedOver(edge, isPath ? 'passage' : 'wall');
        },
        onDragFinished,
        onDragCancelled: onDragFinished,
    });
    return gestures;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a cell's middle a drag must pass to step into it, and how near a corner, in cells, across and down. */
const CELL_REACH = 0.4;
const CORNER_REACH = 0.32;
