// Grids and helpers for the models' tests. The grids were made by this
// demo's own model, from seed 2026.

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------

/** A full, valid grid, written row by row. */
export const FULL_GRID = parseGrid(`
    853149726
    924867351
    167523849
    635218974
    782694135
    491375682
    348951267
    516782493
    279436518
`);

/** A puzzle with one solution that naked singles alone solve. Dots are empty cells. */
export const SINGLES_PUZZLE = parseGrid(`
    2456.9837
    ...83..25
    ...5249.6
    .7.36..8.
    38.7.15..
    65.2.8..9
    7149.3..2
    ..3.76..8
    9.815.743
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A grid from rows of digits, with dots for empty cells. Spaces and line breaks are ignored. */
export function parseGrid(text: string): Uint8Array {
    const digits = text.replace(/\s/g, '');
    const grid = new Uint8Array(81);
    for (let cell = 0; cell < 81; cell++) grid[cell] = digits[cell] === '.' ? 0 : Number(digits[cell]);
    return grid;
}

/** How many solutions `puzzle` has, counting no further than `limit`. */
export function countSolutions(puzzle: Readonly<Uint8Array>, limit = 2): number {
    return searchSolutions(puzzle, limit).count;
}

/** The first solution of `puzzle` found, or undefined if it has none. */
export function findSolution(puzzle: Readonly<Uint8Array>): Uint8Array | undefined {
    return searchSolutions(puzzle, 1).first;
}

/** The digits that break no rule in `cell` of `grid`, as a set: bit `d` for each digit `d`. */
export function findAllowedDigits(grid: Readonly<Uint8Array>, cell: number): number {
    return candidatesOf(grid, cell);
}

/** Whether `grid` breaks no rule: no digit twice in a row, a column or a box. Empty cells are allowed. */
export function isValidGrid(grid: Readonly<Uint8Array>): boolean {
    for (let cell = 0; cell < 81; cell++) {
        const digit = grid[cell];
        if (digit !== 0 && (candidatesOf(grid, cell) & (1 << digit)) === 0) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Searches for solutions of `puzzle`, up to `limit` of them, filling the cell with the fewest choices first. */
function searchSolutions(puzzle: Readonly<Uint8Array>, limit: number): { count: number; first: Uint8Array | undefined } {
    const grid = new Uint8Array(puzzle);
    let count = 0;
    let first: Uint8Array | undefined;
    search();
    return { count, first };

    function search(): void {
        let best = -1;
        let bestSet = 0;
        let bestCount = 10;
        for (let cell = 0; cell < 81; cell++) {
            if (grid[cell] !== 0) continue;
            const set = candidatesOf(grid, cell);
            const size = countBits(set);
            if (size < bestCount) {
                best = cell;
                bestSet = set;
                bestCount = size;
            }
        }
        if (best < 0) {
            count++;
            first ??= new Uint8Array(grid);
            return;
        }
        for (let digit = 1; digit <= 9 && count < limit; digit++) {
            if ((bestSet & (1 << digit)) === 0) continue;
            grid[best] = digit;
            search();
            grid[best] = 0;
        }
    }
}

/** The digits that could go in `cell`, worked out from scratch, so the tests don't lean on the code they test. */
function candidatesOf(grid: Readonly<Uint8Array>, cell: number): number {
    const row = Math.floor(cell / 9);
    const column = cell % 9;
    const boxTop = row - (row % 3);
    const boxLeft = column - (column % 3);
    let used = 0;
    for (let i = 0; i < 9; i++) {
        const peers = [row * 9 + i, i * 9 + column, (boxTop + Math.floor(i / 3)) * 9 + boxLeft + (i % 3)];
        for (const peer of peers) {
            if (peer !== cell) used |= 1 << grid[peer];
        }
    }
    return 0b11_1111_1110 & ~used;
}

function countBits(set: number): number {
    let count = 0;
    for (let rest = set; rest !== 0; rest &= rest - 1) count++;
    return count;
}
