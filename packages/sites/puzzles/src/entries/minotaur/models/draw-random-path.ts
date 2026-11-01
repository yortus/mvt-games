import type { MazeGrid } from './maze-grid';
import type { Random } from './random';

/** What `drawRandomPath` draws on. */
export interface DrawRandomPathOptions {
    readonly grid: MazeGrid;
    readonly random: Random;
}

/**
 * Returns a random path through every cell of `grid`, once each, as its
 * cells in order. Its ends are the maze's start and end.
 *
 * It starts from a snake that runs back and forth along the rows, and
 * reshapes it with backbite moves, many times over. A move picks an end of
 * the path and one of the four ways from it. If that way leads to a cell of
 * the path, other than the one next to the end, the end joins on to it, and
 * the path is cut just before that cell. The piece cut loose turns round to
 * make the path whole again, with a new end. A way off the grid, or back
 * along the path, wastes the move: choosing among all four ways, rather than
 * among the cells there are, keeps ends at the edges from being favoured.
 */
export function drawRandomPath(options: DrawRandomPathOptions): Int32Array {
    const { grid, random } = options;
    const { rows, cols, cellCount } = grid;
    const path = new Int32Array(cellCount);
    // Where each cell is along the path
    const place = new Int32Array(cellCount);
    for (let row = 0; row < rows; row++) {
        for (let i = 0; i < cols; i++) path[row * cols + i] = row * cols + (row % 2 === 0 ? i : cols - 1 - i);
    }
    for (let i = 0; i < cellCount; i++) place[path[i]] = i;

    const last = cellCount - 1;
    const moves = cellCount * MOVES_PER_CELL;
    for (let move = 0; move < moves; move++) {
        const isAtStart = random.next() < 0.5;
        const end = path[isAtStart ? 0 : last];
        const way = Math.floor(random.next() * 4);
        const row = Math.floor(end / cols) + (way === 0 ? -1 : way === 2 ? 1 : 0);
        const col = (end % cols) + (way === 3 ? -1 : way === 1 ? 1 : 0);
        if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
        const joined = place[row * cols + col];
        if (isAtStart && joined > 1) turnRound(0, joined - 1);
        else if (!isAtStart && joined < last - 1) turnRound(joined + 1, last);
    }
    return path;

    /** Turns the run of the path from `from` to `to` round. */
    function turnRound(from: number, to: number): void {
        for (let i = from, j = to; i < j; i++, j--) {
            const cell = path[i];
            path[i] = path[j];
            path[j] = cell;
            place[path[i]] = i;
            place[path[j]] = j;
        }
    }
}

/**
 * How many backbite moves are made for each cell. Checked against every path
 * on small grids: the paths drawn come up as often as each other.
 */
const MOVES_PER_CELL = 60;
