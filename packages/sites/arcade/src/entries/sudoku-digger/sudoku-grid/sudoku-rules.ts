// The rules of the grid, as tables and small helpers that every model here
// shares, and Sudoku, the game, too. A grid is 81 cells, numbered across each row from the top left,
// so cell `row * 9 + column`. A digit is 1 to 9, and 0 is an empty cell. A
// set of digits is a mask with bit `d` set for each digit `d` in it, so
// bits 1 to 9. The masks make "which digits could go here" a few bitwise
// operations, with nothing to allocate.

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

/** How many cells the grid has. */
export const CELL_COUNT = 81;

/** Each cell's row, column and box, from 0 to 8. Boxes count across from the top left. */
export const ROW_OF: Readonly<Uint8Array> = /* @__PURE__ */ createTable((cell) => Math.floor(cell / 9));
export const COLUMN_OF: Readonly<Uint8Array> = /* @__PURE__ */ createTable((cell) => cell % 9);
export const BOX_OF: Readonly<Uint8Array> = /* @__PURE__ */ createTable((cell) => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3));

/** How many units the grid has: see `UNIT_CELLS`. */
export const UNIT_COUNT = 27;
/**
 * The 27 units, each the 9 cells that must hold every digit once: the rows
 * are units 0 to 8, the columns 9 to 17, and the boxes 18 to 26. Unit `u`'s
 * cells are `UNIT_CELLS[u * 9]` to `UNIT_CELLS[u * 9 + 8]`.
 */
export const UNIT_CELLS: Readonly<Uint8Array> = /* @__PURE__ */ createUnitCells();

/** How many peers each cell has: the other cells in its row, its column and its box. */
export const PEER_COUNT = 20;
/** Each cell's peers. Cell `c`'s are `PEERS[c * 20]` to `PEERS[c * 20 + 19]`. */
export const PEERS: Readonly<Uint8Array> = /* @__PURE__ */ createPeers();

// ---------------------------------------------------------------------------
// Sets of digits
// ---------------------------------------------------------------------------

/** The set of all nine digits. */
export const ALL_DIGITS = 0b11_1111_1110;

/** The set holding only `digit`. */
export function toDigitSet(digit: number): number {
    return 1 << digit;
}

/** Whether `set` holds `digit`. */
export function hasDigit(set: number, digit: number): boolean {
    return (set & (1 << digit)) !== 0;
}

/** How many digits are in `set`. */
export function countDigits(set: number): number {
    let count = 0;
    for (let rest = set; rest !== 0; rest &= rest - 1) count++;
    return count;
}

/** The smallest digit in `set`, or 0 if it is empty. */
export function lowestDigit(set: number): number {
    return set === 0 ? 0 : 31 - Math.clz32(set & -set);
}

/** The digit at place `rank` in `set`, counting from 0 at the smallest. */
export function pickDigit(set: number, rank: number): number {
    let rest = set;
    for (let i = 0; i < rank; i++) rest &= rest - 1;
    return lowestDigit(rest);
}

/** The digits that could go in `cell`: those not already in its row, its column or its box. */
export function findCandidates(digits: Readonly<Uint8Array>, cell: number): number {
    let used = 0;
    const first = cell * PEER_COUNT;
    for (let i = first; i < first + PEER_COUNT; i++) used |= 1 << digits[PEERS[i]];
    return ALL_DIGITS & ~used;
}

/** Whether every digit in `digits` is the only one of its kind in its row, its column and its box. Empty cells are allowed. */
export function isConsistent(digits: Readonly<Uint8Array>): boolean {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        const digit = digits[cell];
        if (digit !== 0 && (findCandidates(digits, cell) & toDigitSet(digit)) === 0) return false;
    }
    return true;
}

/** Whether cells `a` and `b` share a row, a column or a box. */
export function isSameUnit(a: number, b: number): boolean {
    return ROW_OF[a] === ROW_OF[b] || COLUMN_OF[a] === COLUMN_OF[b] || BOX_OF[a] === BOX_OF[b];
}

/** Whether `cells` all share one row, one column or one box. */
export function isOneUnit(cells: readonly number[]): boolean {
    return isAllIn(cells, ROW_OF) || isAllIn(cells, COLUMN_OF) || isAllIn(cells, BOX_OF);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Whether `cells` are all in the same row, column or box as each other, as `unitOf` says: `ROW_OF`, `COLUMN_OF` or `BOX_OF`. */
function isAllIn(cells: readonly number[], unitOf: Readonly<Uint8Array>): boolean {
    for (let i = 1; i < cells.length; i++) if (unitOf[cells[i]] !== unitOf[cells[0]]) return false;
    return true;
}

function createTable(valueOf: (cell: number) => number): Uint8Array {
    const table = new Uint8Array(CELL_COUNT);
    for (let cell = 0; cell < CELL_COUNT; cell++) table[cell] = valueOf(cell);
    return table;
}

function createUnitCells(): Uint8Array {
    const cells = new Uint8Array(UNIT_COUNT * 9);
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            cells[i * 9 + j] = i * 9 + j;
            cells[(9 + i) * 9 + j] = j * 9 + i;
            cells[(18 + i) * 9 + j] = (Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3);
        }
    }
    return cells;
}

function createPeers(): Uint8Array {
    const peers = new Uint8Array(CELL_COUNT * PEER_COUNT);
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        let count = 0;
        for (let other = 0; other < CELL_COUNT; other++) {
            if (other === cell) continue;
            const isPeer = ROW_OF[other] === ROW_OF[cell] || COLUMN_OF[other] === COLUMN_OF[cell] || BOX_OF[other] === BOX_OF[cell];
            if (isPeer) peers[cell * PEER_COUNT + count++] = other;
        }
    }
    return peers;
}
