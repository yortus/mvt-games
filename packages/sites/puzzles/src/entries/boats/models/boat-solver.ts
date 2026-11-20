import { BOAT, UNKNOWN, WATER } from './cell-states';
import {
    GIVEN_DINGHY, GIVEN_END_LEFT, GIVEN_END_UP, GIVEN_MIDDLE, GIVEN_WATER, isGivenBoat,
} from './given-pieces';
import {
    DIAGONALS, findCellAfterRun, findCellBeforeRun, type HarbourGrid,
} from './harbour-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A way a person works out cells by reading the harbour as it stands,
 * without guessing, or following where a guess leads. From easiest to
 * hardest:
 *
 * - `rules`: the four cells diagonally beside a boat are water, since boats
 *   never touch and never bend. A printed piece says which of its sides
 *   its boat goes on from. A row or column with all its boat cells found is
 *   water everywhere else. A line with only as many open cells as the boat
 *   cells it still needs is boat in all of them.
 * - `fleet`: a boat with water at both ends is finished. Once every boat of
 *   a length is found, an unfinished boat of that length must be longer.
 *   If it can grow only one way, it grows there. A boat as long as the
 *   longest still to find can't grow, so its open ends are water.
 * - `places`: list every place each boat still to find could go, from the
 *   water and the numbers so far. A place is a straight run of cells that
 *   could hold the boat. A cell that every place of the last boat of a
 *   length covers is boat. If there are only as many places as boats, each
 *   place holds one. A cell that every boat still to find misses is water.
 */
export type BoatTechnique = 'rules' | 'fleet' | 'places';

/** The techniques, from easiest to hardest. */
export const BOAT_TECHNIQUES: readonly BoatTechnique[] = ['rules', 'fleet', 'places'];

/** How far the techniques got with a puzzle. */
export interface SolverProgress {
    /** Each cell, as `BOAT`, `WATER`, or `UNKNOWN` where the techniques got no further. */
    readonly cells: Uint8Array;
    /** Whether every cell is known. A puzzle the techniques finish has one solution, since every step was forced. */
    readonly isFinished: boolean;
    /** The hardest technique it needed. */
    readonly hardest: BoatTechnique;
}

/**
 * Works out a harbour of boats from its fleet and its numbers, as a person
 * would, without guessing. When the rules alone get stuck, the solver goes
 * on only if the other techniques, between them, can find at least two
 * cells. That way a player never has to search the whole harbour for a
 * single cell.
 */
export interface BoatSolver {
    /**
     * Works out as many cells as the techniques up to `hardest` can, from
     * `givens`. `givens` holds what each cell printed on the harbour shows,
     * as a number from `given-pieces`, and `NO_GIVEN` for the rest. Each
     * time, it uses the easiest technique that finds something.
     */
    solve: (givens: Readonly<Uint8Array>, hardest: BoatTechnique) => SolverProgress;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a solver is created with. */
export interface BoatSolverOptions {
    /** The puzzle's harbour. */
    readonly grid: HarbourGrid;
    /** The length of every boat in the fleet, longest first. */
    readonly fleet: readonly number[];
    /** How many boat cells each row holds, from the top. */
    readonly rowCounts: Readonly<Uint8Array>;
    /** How many boat cells each column holds, from the left. */
    readonly colCounts: Readonly<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a solver for the puzzle with `fleet` and these numbers. */
export function createBoatSolver(options: BoatSolverOptions): BoatSolver {
    const { grid, fleet, rowCounts, colCounts } = options;
    const { size, cellCount, neighbours, sides } = grid;
    const longest = fleet[0];
    // How many boats of each length the fleet has
    const fleetCounts = new Int32Array(longest + 1);
    for (let i = 0; i < fleet.length; i++) fleetCounts[fleet[i]]++;

    // Scratch space for the boats found so far, and the places a boat could go
    const boatOf = new Int32Array(cellCount);
    const boatCells = new Int32Array(cellCount);
    const boatStarts: number[] = [];
    const boatLengths: number[] = [];
    const isBoatFinished: boolean[] = [];
    const found = new Int32Array(longest + 1);
    const rowBoats = new Int32Array(size);
    const colBoats = new Int32Array(size);
    const placeCells = new Int32Array(cellCount * 2 * longest);
    const coverCounts = new Int32Array(cellCount);
    const isCovered = new Uint8Array(cellCount);
    // A copy of the cells as they were when a technique started. The technique
    // reads only this copy, and writes what it finds to the cells. That way, a
    // cell it finds early in its pass never changes what it finds later.
    const board = new Uint8Array(cellCount);
    // Where the rules are stuck, `tried` holds the cells after each technique,
    // by its place in `BOAT_TECHNIQUES`, and `isFound` marks the cells that
    // any of them found.
    const tried = BOAT_TECHNIQUES.map(() => new Uint8Array(cellCount));
    const isFound = new Uint8Array(cellCount);

    return {
        solve(givens, hardest) {
            const cells = new Uint8Array(cellCount);
            for (let cell = 0; cell < cellCount; cell++) {
                if (givens[cell] === GIVEN_WATER) cells[cell] = WATER;
                else if (isGivenBoat(givens[cell])) cells[cell] = BOAT;
            }
            const hardestLevel = BOAT_TECHNIQUES.indexOf(hardest);
            let neededLevel = 0;
            for (;;) {
                applyRules(cells, givens);
                if (!cells.includes(UNKNOWN)) break;
                // Try each technique on the same cells, easiest first, until they find enough cells between them
                isFound.fill(0);
                let foundCount = 0;
                let easiest = 0;
                for (let level = 1; level <= hardestLevel && foundCount < FEWEST_FOUND; level++) {
                    tried[level].set(cells);
                    if (!applyTechnique(BOAT_TECHNIQUES[level], tried[level])) continue;
                    if (easiest === 0) easiest = level;
                    for (let cell = 0; cell < cellCount; cell++) {
                        if (tried[level][cell] === cells[cell] || isFound[cell] === 1) continue;
                        isFound[cell] = 1;
                        foundCount++;
                    }
                }
                if (foundCount < FEWEST_FOUND) break;
                cells.set(tried[easiest]);
                neededLevel = Math.max(neededLevel, easiest);
            }
            return { cells, isFinished: !cells.includes(UNKNOWN), hardest: BOAT_TECHNIQUES[neededLevel] };
        },
    };

    /** Applies `technique` once. Returns whether it changed anything. */
    function applyTechnique(technique: BoatTechnique, cells: Uint8Array): boolean {
        switch (technique) {
            // `applyRules` has already run until the cells stopped changing, so the rules can't change any more cells here
            case 'rules': return false;
            case 'fleet': return countFleet(cells);
            case 'places': return findPlaces(cells);
        }
    }

    /** Applies the rules, with the printed pieces in `givens`, until the cells stop changing. */
    function applyRules(cells: Uint8Array, givens: Readonly<Uint8Array>): void {
        let isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (cells[cell] !== BOAT) continue;
                for (let i = 0; i < DIAGONALS.length; i++) {
                    if (setCell(cells, neighbours[cell * 8 + DIAGONALS[i]], WATER)) isChanged = true;
                }
                if (applyPiece(cells, givens[cell], cell)) isChanged = true;
            }
            for (let line = 0; line < size * 2; line++) {
                const isColumn = line >= size;
                const index = isColumn ? line - size : line;
                const count = isColumn ? colCounts[index] : rowCounts[index];
                let boats = 0;
                let open = 0;
                for (let i = 0; i < size; i++) {
                    const content = cells[isColumn ? i * size + index : index * size + i];
                    if (content === BOAT) boats++;
                    else if (content === UNKNOWN) open++;
                }
                if (open === 0 || (boats < count && boats + open > count)) continue;
                const fill = boats >= count ? WATER : BOAT;
                for (let i = 0; i < size; i++) setCell(cells, isColumn ? i * size + index : index * size + i, fill);
                isChanged = true;
            }
        }
    }

    /** Sets the sides of `cell` that its printed piece, `given`, says. Returns whether it changed anything. */
    function applyPiece(cells: Uint8Array, given: number, cell: number): boolean {
        let isChanged = false;
        if (given === GIVEN_DINGHY || (given >= GIVEN_END_UP && given <= GIVEN_END_LEFT)) {
            // A dinghy has water all round it. An end has water on every side but the one its boat goes on from
            const onward = given === GIVEN_DINGHY ? -1 : given - GIVEN_END_UP;
            for (let side = 0; side < 4; side++) {
                if (setCell(cells, sides[cell * 4 + side], side === onward ? BOAT : WATER)) isChanged = true;
            }
        }
        else if (given === GIVEN_MIDDLE) {
            // A middle goes on both ways along one line. Water or the edge on
            // one side means the boat runs along the other line. A boat on one
            // side means it runs along that side's line.
            for (let side = 0; side < 4; side++) {
                const next = sides[cell * 4 + side];
                const content = next < 0 ? WATER : cells[next];
                if (content === UNKNOWN) continue;
                const along = content === BOAT ? side % 2 : (side + 1) % 2;
                for (let other = 0; other < 4; other++) {
                    if (setCell(cells, sides[cell * 4 + other], other % 2 === along ? BOAT : WATER)) isChanged = true;
                }
                break;
            }
        }
        return isChanged;
    }

    /** Finds finished boats, then grows or caps the boats the fleet says must grow or stop. Returns whether it changed anything. */
    function countFleet(cells: Uint8Array): boolean {
        board.set(cells);
        findBoats(board);
        let isChanged = false;
        const longestNeeded = findLongestNeeded();
        for (let boat = 0; boat < boatStarts.length; boat++) {
            if (isBoatFinished[boat]) continue;
            const length = boatLengths[boat];
            if (length >= longestNeeded) {
                // It can't grow, so every open cell it could grow into is water
                for (let i = 0; i < 4; i++) {
                    const next = findCellToGrowInto(board, boat, i);
                    if (next >= 0 && setCell(cells, next, WATER)) isChanged = true;
                }
            }
            else if (found[length] >= fleetCounts[length]) {
                // Every boat this long is found, so this one must grow. If it can grow only one way, it grows there
                let only = -1;
                let open = 0;
                for (let i = 0; i < 4; i++) {
                    const next = findCellToGrowInto(board, boat, i);
                    if (next < 0) continue;
                    only = next;
                    open++;
                }
                if (open === 1 && setCell(cells, only, BOAT)) isChanged = true;
            }
        }
        return isChanged;
    }

    /**
     * Lists the places each boat still to find could go, and fills in what
     * they force. Returns whether it changed anything.
     */
    function findPlaces(cells: Uint8Array): boolean {
        board.set(cells);
        findBoats(board);
        countLines(board);
        isCovered.fill(0);
        let isChanged = false;
        for (let length = longest; length >= 1; length--) {
            const left = fleetCounts[length] - found[length];
            if (left <= 0) continue;
            const placeCount = listPlaces(board, length);
            if (placeCount < left) continue;
            for (let place = 0; place < placeCount; place++) {
                for (let i = 0; i < length; i++) isCovered[placeCells[place * length + i]] = 1;
            }
            if (left === 1) {
                // This is the last boat of this length, so a cell that every place covers is boat
                coverCounts.fill(0);
                for (let place = 0; place < placeCount; place++) {
                    for (let i = 0; i < length; i++) coverCounts[placeCells[place * length + i]]++;
                }
                for (let cell = 0; cell < cellCount; cell++) {
                    if (coverCounts[cell] === placeCount && setCell(cells, cell, BOAT)) isChanged = true;
                }
            }
            else if (placeCount === left && arePlacesApart(placeCount, length)) {
                // There are only as many places as boats, so each holds one
                for (let i = 0; i < placeCount * length; i++) {
                    if (setCell(cells, placeCells[i], BOAT)) isChanged = true;
                }
            }
        }
        // A cell that every boat still to find misses is water
        for (let cell = 0; cell < cellCount; cell++) {
            if (cells[cell] === UNKNOWN && isCovered[cell] === 0) {
                cells[cell] = WATER;
                isChanged = true;
            }
        }
        return isChanged;
    }

    /**
     * Lists the places a boat `length` long could go, into `placeCells`,
     * `length` cells to a place. A place is a straight run of open or boat
     * cells that fits the numbers of its rows and columns, and that boats
     * outside it never touch. A finished boat isn't a place, since it is
     * found already. Returns how many places there are.
     */
    function listPlaces(cells: Uint8Array, length: number): number {
        let count = 0;
        const directions = length === 1 ? 1 : 2;
        for (let start = 0; start < cellCount; start++) {
            const row = Math.floor(start / size);
            const col = start % size;
            for (let direction = 0; direction < directions; direction++) {
                const isDown = direction === 1;
                if ((isDown ? row : col) + length > size) continue;
                const step = isDown ? size : 1;
                if (!isPlaceOpen(cells, start, step, length, isDown)) continue;
                for (let i = 0; i < length; i++) placeCells[count * length + i] = start + i * step;
                count++;
            }
        }
        return count;
    }

    /** Whether a boat `length` long fits from `start`, `step` apart, down if `isDown`, across if not. */
    function isPlaceOpen(cells: Uint8Array, start: number, step: number, length: number, isDown: boolean): boolean {
        const row = Math.floor(start / size);
        const col = start % size;
        let open = 0;
        for (let i = 0; i < length; i++) {
            const cell = start + i * step;
            if (cells[cell] === WATER) return false;
            if (cells[cell] === UNKNOWN) open++;
        }
        // The ring of cells round it must be free of boats, so that boats outside never touch it
        const lastRow = isDown ? row + length : row + 1;
        const lastCol = isDown ? col + 1 : col + length;
        for (let r = row - 1; r <= lastRow; r++) {
            for (let c = col - 1; c <= lastCol; c++) {
                if (r < 0 || r >= size || c < 0 || c >= size) continue;
                const isInside = isDown ? c === col && r >= row && r < row + length : r === row && c >= col && c < col + length;
                if (!isInside && cells[r * size + c] === BOAT) return false;
            }
        }
        // A boat this long is there already. It is a place only if it isn't finished, so it could still grow
        if (open === 0) return isGrowable(cells, start, step, length);
        // Its own line must have room for all its open cells, and each line across it for one
        if (isDown) {
            if (colBoats[col] + open > colCounts[col]) return false;
            for (let i = 0; i < length; i++) {
                if (cells[start + i * step] === UNKNOWN && rowBoats[row + i] + 1 > rowCounts[row + i]) return false;
            }
        }
        else {
            if (rowBoats[row] + open > rowCounts[row]) return false;
            for (let i = 0; i < length; i++) {
                if (cells[start + i] === UNKNOWN && colBoats[col + i] + 1 > colCounts[col + i]) return false;
            }
        }
        return true;
    }

    /**
     * Whether a boat `length` long from `start`, `step` apart, has an open
     * cell that it could grow into. A longer boat could grow past either
     * end, and a boat of one cell across any side.
     */
    function isGrowable(cells: Uint8Array, start: number, step: number, length: number): boolean {
        if (length === 1) {
            for (let side = 0; side < 4; side++) {
                const next = sides[start * 4 + side];
                if (next >= 0 && cells[next] === UNKNOWN) return true;
            }
            return false;
        }
        const last = start + (length - 1) * step;
        const before = findCellBeforeRun(grid, start, last);
        const after = findCellAfterRun(grid, start, last);
        return (before >= 0 && cells[before] === UNKNOWN) || (after >= 0 && cells[after] === UNKNOWN);
    }

    /** Whether the first `placeCount` places, each `length` cells, are far enough apart that they could all hold boats at once. */
    function arePlacesApart(placeCount: number, length: number): boolean {
        for (let a = 0; a < placeCount; a++) {
            for (let b = a + 1; b < placeCount; b++) {
                for (let i = 0; i < length; i++) {
                    for (let j = 0; j < length; j++) {
                        const p = placeCells[a * length + i];
                        const q = placeCells[b * length + j];
                        if (Math.abs(Math.floor(p / size) - Math.floor(q / size)) <= 1 && Math.abs((p % size) - (q % size)) <= 1) return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Finds the boats as they stand. A boat is a run of boat cells joined
     * side to side. It is finished once every cell it could grow into is
     * water or past the edge. Counts the finished boats of each length in
     * `found`.
     */
    function findBoats(cells: Uint8Array): void {
        boatOf.fill(-1);
        boatStarts.length = 0;
        boatLengths.length = 0;
        isBoatFinished.length = 0;
        found.fill(0);
        let at = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            if (cells[cell] !== BOAT || boatOf[cell] >= 0) continue;
            const boat = boatStarts.length;
            boatStarts.push(at);
            boatOf[cell] = boat;
            boatCells[at++] = cell;
            // The cells joined to it, side to side, which lie in one straight line, since diagonals are water
            for (let i = boatStarts[boat]; i < at; i++) {
                for (let side = 0; side < 4; side++) {
                    const next = sides[boatCells[i] * 4 + side];
                    if (next < 0 || cells[next] !== BOAT || boatOf[next] >= 0) continue;
                    boatOf[next] = boat;
                    boatCells[at++] = next;
                }
            }
            const length = at - boatStarts[boat];
            boatLengths.push(length);
            let isFinished = true;
            for (let i = 0; i < 4 && isFinished; i++) {
                if (findCellToGrowInto(cells, boat, i) >= 0) isFinished = false;
            }
            isBoatFinished.push(isFinished);
            if (isFinished && length <= longest) found[length]++;
        }
    }

    /**
     * Returns the `index`th of up to four cells that `boat` could grow into,
     * if that cell is open, or -1 if not. A boat of one cell could grow
     * across any of its sides, `UP` to `LEFT`. A longer boat lies along a
     * line, so it could grow only past its ends. Index 0 is past its first
     * cell, and 1 is past its last.
     */
    function findCellToGrowInto(cells: Uint8Array, boat: number, index: number): number {
        const start = boatStarts[boat];
        const length = boatLengths[boat];
        let next = -1;
        if (length === 1) next = sides[boatCells[start] * 4 + index];
        else if (index < 2) {
            // Find the boat's lowest and highest cells along its line
            let first = boatCells[start];
            let last = first;
            for (let i = 1; i < length; i++) {
                first = Math.min(first, boatCells[start + i]);
                last = Math.max(last, boatCells[start + i]);
            }
            next = index === 0 ? findCellBeforeRun(grid, first, last) : findCellAfterRun(grid, first, last);
        }
        return next >= 0 && cells[next] === UNKNOWN ? next : -1;
    }

    /** Returns the longest boat length that the fleet still needs a boat of, or 0 once every boat is found. */
    function findLongestNeeded(): number {
        for (let length = longest; length >= 1; length--) {
            if (found[length] < fleetCounts[length]) return length;
        }
        return 0;
    }

    /** Counts the boat cells in each row and column. */
    function countLines(cells: Uint8Array): void {
        rowBoats.fill(0);
        colBoats.fill(0);
        for (let cell = 0; cell < cellCount; cell++) {
            if (cells[cell] !== BOAT) continue;
            rowBoats[Math.floor(cell / size)]++;
            colBoats[cell % size]++;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many cells, at least, the techniques must find between them wherever the rules are stuck. */
const FEWEST_FOUND = 2;

/** Sets `cell` to `content`, if it is on the grid and open. Returns whether it did. */
function setCell(cells: Uint8Array, cell: number, content: number): boolean {
    if (cell < 0 || cells[cell] !== UNKNOWN) return false;
    cells[cell] = content;
    return true;
}
