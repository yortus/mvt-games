export type TileKind = 'empty' | 'wall' | 'dot' | 'ghost-house';

const PACMAN_CHAR = 'P';

const TILE_CHARS: Record<string, TileKind> = {
    '#': 'wall',
    '.': 'dot',
    ' ': 'empty',
    G: 'ghost-house',
    [PACMAN_CHAR]: 'dot',
};

/**
 * Classic Pac-Man-inspired maze layout (22 rows × 28 columns).
 *
 * Legend:  # = Wall   . = Dot   (space) = Empty   G = Ghost-house   P = Pac-Man spawn
 */
// prettier-ignore
const MAZE_STRING = `\
############################
#............##............#
#.####.#####.##.#####.####.#
#.####.#####.##.#####.####.#
#..........................#
#.####.##.########.##.####.#
#......##....##....##......#
######.##### ## #####.######
     #.##          ##.#     
######.## ###GG### ##.######
      .   #GGGGGG#   .      
######.## #GGGGGG# ##.######
     #.## ######## ##.#     
######.##          ##.######
#............##............#
#.####.#####.##.#####.####.#
#...##........P.......##...#
###.##.##.########.##.##.###
#......##....##....##......#
#.##########.##.##########.#
#..........................#
############################`;

/** Number of columns in the maze. */
export const MAZE_COLS = MAZE_STRING.indexOf('\n');

/** Number of rows in the maze. */
export const MAZE_ROWS = MAZE_STRING.split('\n').length;

/** Tile size in pixels. */
export const TILE_SIZE = 20;

const mazeRows = MAZE_STRING.split('\n');

export const MAZE_DATA: TileKind[][] = mazeRows.map((row) =>
    Array.from({ length: MAZE_COLS }, (_, i) => TILE_CHARS[row[i]] ?? 'empty'),
);

/** Pac-Man spawn tile [row, col] - derived from P in MAZE_STRING. */
export const PACMAN_SPAWN: [number, number] = (() => {
    for (let r = 0; r < mazeRows.length; r++) {
        const c = mazeRows[r].indexOf(PACMAN_CHAR);
        if (c !== -1) {
            const result: [number, number] = [r, c];
            return result;
        }
    }
    throw new Error('Pac-Man spawn not found in maze');
})();

/** Ghost spawn tiles [row, col] - Blinky, Pinky, Inky, Clyde. */
export const GHOST_SPAWNS: [number, number][] = [
    [10, 13], // Blinky (red)   - just outside ghost house
    [10, 14], // Pinky (pink)
    [10, 15], // Inky (cyan)
    [10, 16], // Clyde (orange)
];

/** Height of the HUD area in pixels. */
export const HUD_HEIGHT = 30;

/** Ghost colors: Blinky, Pinky, Inky, Clyde. */
export const GHOST_COLORS: number[] = [
    0xff0000, // Blinky - red
    0xffb8ff, // Pinky  - pink
    0x00ffff, // Inky   - cyan
    0xffb852, // Clyde  - orange
];
