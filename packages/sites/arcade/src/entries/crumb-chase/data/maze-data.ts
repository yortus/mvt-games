export type TileKind = 'empty' | 'wall' | 'crumb' | 'pen';

const MOUSE_CHAR = 'M';

const TILE_CHARS: Record<string, TileKind> = {
    '#': 'wall',
    '.': 'crumb',
    ' ': 'empty',
    '=': 'pen',
    [MOUSE_CHAR]: 'crumb',
};

/**
 * A hedge maze of garden beds laid in brick bond (22 rows × 28 columns), with
 * the cats' pen in the middle and its gap in the top hedge.
 *
 * Legend:  # = Hedge   . = Crumb   (space) = Empty   = = Pen   M = Mouse spawn
 */
const MAZE_STRING = `\
############################
#..........................#
#.####.####.####.####.####.#
#.####.####.####.####.####.#
#..........................#
#.##.####.########.####.##.#
#.##.####.########.####.##.#
#..........................#
#.###.###.###==###.###.###.#
#.###.###.#======#.###.###.#
#.........#======#.........#
#.###.###.#======#.###.###.#
#.###.###.########.###.###.#
#..........................#
#.#####.####.##.####.#####.#
#.#####.####.##.####.#####.#
#............M.............#
#.##.####.########.####.##.#
#.##.####.########.####.##.#
#.##.####.########.####.##.#
#..........................#
############################`;

/** Number of columns in the maze. */
export const MAZE_COLS = MAZE_STRING.indexOf('\n');

/** Number of rows in the maze. */
export const MAZE_ROWS = MAZE_STRING.split('\n').length;

const mazeRows = MAZE_STRING.split('\n');

export const MAZE_DATA: TileKind[][] = mazeRows.map((row) =>
    Array.from({ length: MAZE_COLS }, (_, i) => TILE_CHARS[row[i]] ?? 'empty'),
);

/** Mouse spawn tile [row, col] - derived from M in MAZE_STRING. */
export const MOUSE_SPAWN: [number, number] = (() => {
    for (let r = 0; r < mazeRows.length; r++) {
        const c = mazeRows[r].indexOf(MOUSE_CHAR);
        if (c !== -1) {
            const result: [number, number] = [r, c];
            return result;
        }
    }
    throw new Error('Mouse spawn not found in maze');
})();

/** The tile just outside the gap in the pen's top hedge, where the cats head first. */
export const PEN_EXIT: [number, number] = [7, 13];

/** Cat spawn tiles [row, col], inside the pen, in the order of the cats' behaviours. */
export const CAT_SPAWNS: [number, number][] = [
    [10, 12], // chases the mouse directly
    [10, 13], // ambushes ahead of the mouse
    [10, 14], // flanks, opposite the first cat
    [10, 15], // fickle: chases from afar, retreats when close
];
