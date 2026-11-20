import { EMPTY, STAR, UNKNOWN } from './cell-states';
import { type StarGrid, STARS_PER_LINE } from './star-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A way a person works out cells, by reading the board as it stands, with
 * nothing supposed and nothing followed. From easiest to hardest:
 *
 * - `rules`: the eight cells round a star are empty. A row, column or
 *   region with all its stars has no more, and one with only as many open
 *   cells as the stars it still needs has a star in each.
 * - `bands`: if k regions lie wholly inside k rows side by side, the rest
 *   of those rows is empty. If k rows are wholly covered by k regions,
 *   those regions are empty outside the rows. The same for columns.
 * - `pressure`: a star at a cell would empty its own ring of eight cells.
 *   If that would leave a row, column or region without room for the stars
 *   it still needs, the cell is empty.
 * - `boxes`: two rows side by side need twice a line's stars, and a 2x2 box
 *   holds one at most. If their open cells, covered by boxes from the left,
 *   take exactly that many boxes, each box holds one star: one with a single
 *   open cell has its star there, and a cell outside a box that touches
 *   every open cell in it is empty. The same for columns.
 */
export type StarTechnique = 'rules' | 'bands' | 'pressure' | 'boxes';

/** The techniques, from easiest to hardest. */
export const STAR_TECHNIQUES: readonly StarTechnique[] = ['rules', 'bands', 'pressure', 'boxes'];

/** How far the techniques got with a puzzle. */
export interface StarSolution {
    /** Each cell, as `STAR`, `EMPTY`, or `UNKNOWN` where the techniques got no further. */
    readonly cells: Uint8Array;
    /** Whether every cell is known. A puzzle the techniques finish has one solution, since every step was forced. */
    readonly isFinished: boolean;
    /** The hardest technique it needed. */
    readonly hardest: StarTechnique;
}

/**
 * Works out a puzzle of stars, given its regions, as a person would, and
 * never supposes. Wherever the rules get stuck, it asks for at least two
 * cells that the other techniques can find from the board as it stands. A
 * single cell to find, somewhere on the whole board, is a needle in a
 * haystack: a person would likely start trying cells to find it. So the
 * solver counts that as stuck too.
 */
export interface StarSolver {
    /**
     * Works out as many cells as the techniques up to `most` can, from
     * `givens`: `STAR` or `EMPTY` for each cell printed on the grid, and
     * `UNKNOWN` for the rest. Each time, it uses the easiest technique that
     * finds something.
     */
    solve: (givens: Readonly<Uint8Array>, most: StarTechnique) => StarSolution;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StarSolverOptions {
    readonly grid: StarGrid;
    /** Each cell's region, numbered from 0. There are as many regions as rows. */
    readonly regions: Readonly<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a solver for the puzzle with `regions`. */
export function createStarSolver(options: StarSolverOptions): StarSolver {
    const { grid, regions } = options;
    const { size, cellCount, neighbours } = grid;

    // The puzzle's lines: its rows, then its columns, then its regions, as runs of cells in one list
    const lineCount = size * 3;
    const lineStarts = new Int32Array(lineCount + 1);
    const lineCells = new Int32Array(cellCount * 3);
    let at = 0;
    for (let row = 0; row < size; row++) {
        lineStarts[row] = at;
        for (let col = 0; col < size; col++) lineCells[at++] = row * size + col;
    }
    for (let col = 0; col < size; col++) {
        lineStarts[size + col] = at;
        for (let row = 0; row < size; row++) lineCells[at++] = row * size + col;
    }
    for (let region = 0; region < size; region++) {
        lineStarts[size * 2 + region] = at;
        for (let cell = 0; cell < cellCount; cell++) {
            if (regions[cell] === region) lineCells[at++] = cell;
        }
    }
    lineStarts[lineCount] = at;

    // Scratch space: for the bands, for pressure and which lines a cell's ring reaches, and for the boxes
    const lowest = new Int32Array(size);
    const highest = new Int32Array(size);
    const isInside = new Uint8Array(size);
    const isAcross = new Uint8Array(size);
    const pool = new Int32Array(cellCount);
    const isLineReached = new Uint8Array(lineCount);
    const boxesNeeded = STARS_PER_LINE * 2;
    const boxCells = new Int32Array(boxesNeeded * 4);
    const boxSizes = new Int32Array(boxesNeeded);
    // Where the rules are stuck: the board after each technique, by its place in the list, and which cells any of them found
    const tried = STAR_TECHNIQUES.map(() => new Uint8Array(cellCount));
    const isFound = new Uint8Array(cellCount);

    return {
        solve(givens, most) {
            const cells = Uint8Array.from(givens);
            const mostLevel = STAR_TECHNIQUES.indexOf(most);
            let hardest = 0;
            for (;;) {
                applyRules(cells);
                if (!cells.includes(UNKNOWN)) break;
                // Each technique from the same board, easiest first, until enough cells are found between them
                isFound.fill(0);
                let foundCount = 0;
                let easiest = 0;
                for (let level = 1; level <= mostLevel && foundCount < FEWEST_FOUND; level++) {
                    tried[level].set(cells);
                    if (!applyTechnique(level, tried[level])) continue;
                    if (easiest === 0) easiest = level;
                    for (let cell = 0; cell < cellCount; cell++) {
                        if (tried[level][cell] === cells[cell] || isFound[cell] === 1) continue;
                        isFound[cell] = 1;
                        foundCount++;
                    }
                }
                if (foundCount < FEWEST_FOUND) break;
                cells.set(tried[easiest]);
                hardest = Math.max(hardest, easiest);
            }
            return { cells, isFinished: !cells.includes(UNKNOWN), hardest: STAR_TECHNIQUES[hardest] };
        },
    };

    /** Applies the technique at `level` in the list, past the rules, once. Returns whether it changed anything. */
    function applyTechnique(level: number, cells: Uint8Array): boolean {
        if (level === 1) return countBands(cells);
        if (level === 2) return applyPressure(cells);
        return fillBoxes(cells);
    }

    /** Applies the rules until nothing changes. */
    function applyRules(cells: Uint8Array): void {
        let isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (cells[cell] !== STAR) continue;
                for (let k = 0; k < 8; k++) {
                    const next = neighbours[cell * 8 + k];
                    if (next >= 0 && cells[next] === UNKNOWN) {
                        cells[next] = EMPTY;
                        isChanged = true;
                    }
                }
            }
            for (let line = 0; line < lineCount; line++) {
                const start = lineStarts[line];
                const end = lineStarts[line + 1];
                let stars = 0;
                let open = 0;
                for (let i = start; i < end; i++) {
                    const state = cells[lineCells[i]];
                    if (state === STAR) stars++;
                    else if (state === UNKNOWN) open++;
                }
                if (open === 0 || (stars < STARS_PER_LINE && stars + open > STARS_PER_LINE)) continue;
                const fill = stars >= STARS_PER_LINE ? EMPTY : STAR;
                for (let i = start; i < end; i++) {
                    if (cells[lineCells[i]] === UNKNOWN) cells[lineCells[i]] = fill;
                }
                isChanged = true;
            }
        }
    }

    /** Counts regions in bands of rows, and of columns. Returns whether it changed anything. */
    function countBands(cells: Uint8Array): boolean {
        let isChanged = false;
        for (let isColumns = 0; isColumns < 2; isColumns++) {
            // The rows (or columns) each region still spans. A band's change only narrows them, so a count from these stays sound
            lowest.fill(size);
            highest.fill(-1);
            for (let cell = 0; cell < cellCount; cell++) {
                if (cells[cell] === EMPTY) continue;
                const place = isColumns === 0 ? Math.floor(cell / size) : cell % size;
                const region = regions[cell];
                if (place < lowest[region]) lowest[region] = place;
                if (place > highest[region]) highest[region] = place;
            }
            for (let first = 0; first < size; first++) {
                for (let last = first; last < size && last - first < size - 1; last++) {
                    let inside = 0;
                    let across = 0;
                    for (let region = 0; region < size; region++) {
                        isInside[region] = lowest[region] >= first && highest[region] <= last ? 1 : 0;
                        isAcross[region] = highest[region] >= first && lowest[region] <= last ? 1 : 0;
                        inside += isInside[region];
                        across += isAcross[region];
                    }
                    const bandSize = last - first + 1;
                    if (inside !== bandSize && across !== bandSize) continue;
                    for (let cell = 0; cell < cellCount; cell++) {
                        if (cells[cell] !== UNKNOWN) continue;
                        const place = isColumns === 0 ? Math.floor(cell / size) : cell % size;
                        const isInBand = place >= first && place <= last;
                        const region = regions[cell];
                        if ((inside === bandSize && isInBand && isInside[region] === 0) || (across === bandSize && !isInBand && isAcross[region] === 1)) {
                            cells[cell] = EMPTY;
                            isChanged = true;
                        }
                    }
                }
            }
        }
        return isChanged;
    }

    /** Empties every open cell whose ring of eight would leave some line without room for its stars. Returns whether it emptied any. */
    function applyPressure(cells: Uint8Array): boolean {
        let isChanged = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (cells[cell] !== UNKNOWN) continue;
            // Only the lines through the cell and its ring change
            isLineReached.fill(0);
            markLinesOf(cell);
            for (let k = 0; k < 8; k++) {
                const next = neighbours[cell * 8 + k];
                if (next >= 0) markLinesOf(next);
            }
            let isEmpty = false;
            for (let line = 0; line < lineCount && !isEmpty; line++) {
                if (isLineReached[line] === 0) continue;
                let stars = 0;
                let poolSize = 0;
                let hasCell = false;
                for (let i = lineStarts[line]; i < lineStarts[line + 1]; i++) {
                    const other = lineCells[i];
                    if (other === cell) hasCell = true;
                    else if (cells[other] === STAR) stars++;
                    else if (cells[other] === UNKNOWN && !grid.isTouching(other, cell)) pool[poolSize++] = other;
                }
                if (!hasRoom(poolSize, STARS_PER_LINE - stars - (hasCell ? 1 : 0))) isEmpty = true;
            }
            if (isEmpty) {
                cells[cell] = EMPTY;
                isChanged = true;
            }
        }
        return isChanged;
    }

    function markLinesOf(cell: number): void {
        isLineReached[Math.floor(cell / size)] = 1;
        isLineReached[size + (cell % size)] = 1;
        isLineReached[size * 2 + regions[cell]] = 1;
    }

    /** Whether the first `poolSize` cells of `pool` can hold `need` stars, none touching. Exact for one star or two. */
    function hasRoom(poolSize: number, need: number): boolean {
        if (need <= 0) return true;
        if (poolSize < need) return false;
        if (need === 1) return true;
        for (let i = 0; i < poolSize; i++) {
            for (let j = i + 1; j < poolSize; j++) {
                if (!grid.isTouching(pool[i], pool[j])) return true;
            }
        }
        return false;
    }

    /** Covers each two rows, and each two columns, side by side with 2x2 boxes, and fills what the boxes force. Returns whether it changed anything. */
    function fillBoxes(cells: Uint8Array): boolean {
        let isChanged = false;
        for (let isColumns = 0; isColumns < 2; isColumns++) {
            for (let first = 0; first + 1 < size; first++) {
                const cellAt = (line: number, along: number): number => (isColumns === 0 ? line * size + along : along * size + line);
                // Boxes from the left, each starting at the first place along with a cell that isn't empty, and taking that place and the next
                let boxCount = 0;
                let along = 0;
                while (along < size && boxCount <= boxesNeeded) {
                    if (cells[cellAt(first, along)] === EMPTY && cells[cellAt(first + 1, along)] === EMPTY) {
                        along++;
                        continue;
                    }
                    if (boxCount === boxesNeeded) {
                        boxCount++;
                        break;
                    }
                    let count = 0;
                    for (let step = 0; step < 2 && along + step < size; step++) {
                        for (let line = first; line <= first + 1; line++) {
                            const cell = cellAt(line, along + step);
                            if (cells[cell] !== EMPTY) boxCells[boxCount * 4 + count++] = cell;
                        }
                    }
                    boxSizes[boxCount++] = count;
                    along += 2;
                }
                if (boxCount !== boxesNeeded) continue;
                for (let box = 0; box < boxCount; box++) {
                    if (fillBox(cells, box)) isChanged = true;
                }
            }
        }
        return isChanged;
    }

    /** Fills what a box holding exactly one star forces. Returns whether it changed anything. */
    function fillBox(cells: Uint8Array, box: number): boolean {
        let open = 0;
        let lastOpen = -1;
        for (let i = 0; i < boxSizes[box]; i++) {
            const cell = boxCells[box * 4 + i];
            if (cells[cell] === STAR) return false;
            if (cells[cell] === UNKNOWN) {
                open++;
                lastOpen = cell;
            }
        }
        if (open === 0) return false;
        if (open === 1) {
            cells[lastOpen] = STAR;
            return true;
        }
        // A cell outside the box that touches every open cell in it touches the last one, so look round that one
        let isChanged = false;
        for (let k = 0; k < 8; k++) {
            const candidate = neighbours[lastOpen * 8 + k];
            if (candidate < 0 || cells[candidate] !== UNKNOWN || isInBox(box, candidate)) continue;
            let isTouchingAll = true;
            for (let i = 0; i < boxSizes[box] && isTouchingAll; i++) {
                const cell = boxCells[box * 4 + i];
                if (cells[cell] === UNKNOWN && !grid.isTouching(cell, candidate)) isTouchingAll = false;
            }
            if (isTouchingAll) {
                cells[candidate] = EMPTY;
                isChanged = true;
            }
        }
        return isChanged;
    }

    function isInBox(box: number, cell: number): boolean {
        for (let i = 0; i < boxSizes[box]; i++) {
            if (boxCells[box * 4 + i] === cell) return true;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many cells, at least, the techniques must find between them wherever the rules are stuck. */
const FEWEST_FOUND = 2;
