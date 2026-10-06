// The arcade's pixel font, which both its letterings are set in: the cards'
// titles (`PixelTextView`) and its own name (`WordmarkView`).

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A run of filled cells along a row, in cells. */
export interface CellRun {
    readonly x: number;
    readonly y: number;
    readonly width: number;
}

// ---------------------------------------------------------------------------
// The font
// ---------------------------------------------------------------------------

/**
 * Each character as rows of cells, `#` filled: five wide (`I` three, `0`
 * four, `M` and `W` seven), seven tall. It is set bold: each stroke doubled
 * sideways, as arcade lettering often was, so each character is a cell wider
 * than it is drawn here. Setting it bold fills in a gap one cell wide, so
 * where a gap must still show, as in `G`'s bar or `M`'s notch, it is two.
 */
export const PIXEL_FONT: Readonly<Record<string, readonly string[]>> = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#.....#', '##...##', '#.#.#.#', '#..#..#', '#.....#', '#.....#', '#.....#'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#...#', '.###.', '....#'],
    'R': ['####.', '#...#', '#...#', '####.', '#..#.', '#...#', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#.....#', '#.....#', '#.....#', '#..#..#', '#.#.#.#', '##...##', '#.....#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

/** How many rows tall each character is. */
export const PIXEL_HEIGHT = 7;

/** The width of `text` set bold, in cells, from its first character's left edge to its last's right edge. */
export function pixelTextWidth(text: string): number {
    let width = 0;
    for (const char of text) {
        const rows = PIXEL_FONT[char];
        width += rows === undefined ? SPACE_WIDTH : rows[0].length + 1 + GAP;
    }
    return Math.max(1, width - GAP);
}

/**
 * Every run of filled cells in `text` set bold, row by row, its top left
 * corner at `left`, `top`. Anything the font has no character for reads as
 * a space.
 */
export function pixelTextRuns(text: string, left: number, top: number): CellRun[] {
    const runs: CellRun[] = [];
    let x = left;
    for (const char of text) {
        const rows = boldRows(char);
        if (rows === undefined) {
            x += SPACE_WIDTH;
            continue;
        }
        pushCellRuns(runs, rows, x, top);
        x += rows[0].length + GAP;
    }
    return runs;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Between characters, and a space's width, in cells. */
const GAP = 1;
const SPACE_WIDTH = 3;

/** A character's rows, set bold: each filled cell also fills the cell to its right, so the glyph is a cell wider. */
function boldRows(char: string): readonly string[] | undefined {
    const rows = PIXEL_FONT[char];
    if (rows === undefined) return undefined;
    return rows.map((row) => {
        let bold = '';
        for (let i = 0; i <= row.length; i++) bold += row[i] === '#' || row[i - 1] === '#' ? '#' : '.';
        return bold;
    });
}

/** Every run of filled cells in a glyph's `rows`, the glyph's top left corner at `left`, `top`, pushed onto `runs`. */
function pushCellRuns(runs: CellRun[], rows: readonly string[], left: number, top: number): void {
    for (let row = 0; row < rows.length; row++) {
        const cells = rows[row];
        for (let start = 0; start < cells.length; start++) {
            if (cells[start] !== '#') continue;
            let end = start;
            while (end < cells.length && cells[end] === '#') end++;
            runs.push({ x: left + start, y: top + row, width: end - start });
            start = end;
        }
    }
}
