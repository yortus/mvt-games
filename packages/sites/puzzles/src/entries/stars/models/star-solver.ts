import { EMPTY, STAR, STARS_PER_LINE, UNKNOWN } from './cell-states';
import type { StarGrid } from './star-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a puzzle takes to solve, as a person would solve it.
 *
 * - `look-ahead`: the rules, counting, and one look ahead: "a star here
 *   would leave this region, or this pair of rows, without room for its
 *   stars". Every two-star puzzle needs some of this.
 * - `deep-look-ahead`: looking ahead further, counting inside the look.
 * - `guessing`: none of that finishes it, so it would take guessing. Such
 *   a puzzle is never made.
 */
export type StarReasoning = 'look-ahead' | 'deep-look-ahead' | 'guessing';

/** Works out a puzzle of stars, given its regions. */
export interface StarSolver {
    /**
     * Counts the puzzle's solutions, stopping at `most`. Each solution found
     * is added to `found`, if given, as `STAR` or `EMPTY` for each cell.
     */
    countSolutions: (most: number, found?: Uint8Array[]) => number;
    /** Finds what the puzzle takes to solve. A puzzle that doesn't take guessing has one solution. */
    grade: () => StarReasoning;
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

/**
 * Creates a solver for the puzzle with `regions`. It works on cells, each
 * unknown, a star or empty, and knows three rules:
 *
 * 1. **Neighbours.** The eight cells around a star are empty.
 * 2. **Full lines.** A row, column or region with its two stars has no
 *    more. One with only as many unknown cells as the stars it still needs
 *    has a star in each.
 * 3. **Room.** A line that needs two more stars needs two unknown cells
 *    that don't touch. Two rows side by side need four stars between them,
 *    with no two in neighbouring columns; and so do two columns.
 *
 * To count solutions, it applies the rules until they settle, then tries a
 * cell both ways. To grade, it also counts regions inside bands of rows and
 * columns, and looks ahead, as a person would, and never guesses.
 */
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

    // Scratch space for the band counting
    const lowest = new Int32Array(size);
    const highest = new Int32Array(size);
    const isInside = new Uint8Array(size);
    const isAcross = new Uint8Array(size);
    // Scratch space for looking ahead
    const trial = new Uint8Array(cellCount);

    return {
        countSolutions(most, found) {
            let count = 0;
            search(new Uint8Array(cellCount));
            return count;

            function search(cells: Uint8Array): void {
                if (!applyRules(cells)) return;
                // Try a cell of the line that needs stars and has the fewest unknown cells
                let bestLine = -1;
                let bestUnknowns = Infinity;
                for (let line = 0; line < lineCount; line++) {
                    let stars = 0;
                    let unknowns = 0;
                    for (let i = lineStarts[line]; i < lineStarts[line + 1]; i++) {
                        const state = cells[lineCells[i]];
                        if (state === STAR) stars++;
                        else if (state === UNKNOWN) unknowns++;
                    }
                    if (stars < STARS_PER_LINE && unknowns < bestUnknowns) {
                        bestUnknowns = unknowns;
                        bestLine = line;
                    }
                }
                if (bestLine < 0) {
                    count++;
                    found?.push(cells);
                    return;
                }
                let cell = -1;
                for (let i = lineStarts[bestLine]; i < lineStarts[bestLine + 1] && cell < 0; i++) {
                    if (cells[lineCells[i]] === UNKNOWN) cell = lineCells[i];
                }
                const withStar = cells.slice();
                withStar[cell] = STAR;
                search(withStar);
                if (count >= most) return;
                const withoutStar = cells.slice();
                withoutStar[cell] = EMPTY;
                search(withoutStar);
            }
        },
        grade() {
            // Solve as a person would, trying the easiest reasoning first each time, and note the hardest it needed
            const cells = new Uint8Array(cellCount);
            let reasoning: StarReasoning = 'look-ahead';
            for (;;) {
                if (!applyRules(cells)) return 'guessing';
                if (!cells.includes(UNKNOWN)) return reasoning;
                if (countBands(cells)) continue;
                if (lookAhead(cells, false)) continue;
                if (lookAhead(cells, true)) {
                    reasoning = 'deep-look-ahead';
                    continue;
                }
                return 'guessing';
            }
        },
    };

    /** Applies the three rules until nothing changes. Returns false if the cells break a rule, so they can't be part of a solution. */
    function applyRules(cells: Uint8Array): boolean {
        let isChanged = true;
        while (isChanged) {
            isChanged = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (cells[cell] !== STAR) continue;
                for (let k = 0; k < 8; k++) {
                    const next = neighbours[cell * 8 + k];
                    if (next < 0) continue;
                    if (cells[next] === STAR) return false;
                    if (cells[next] === UNKNOWN) {
                        cells[next] = EMPTY;
                        isChanged = true;
                    }
                }
            }
            for (let line = 0; line < lineCount; line++) {
                const start = lineStarts[line];
                const end = lineStarts[line + 1];
                let stars = 0;
                let unknowns = 0;
                for (let i = start; i < end; i++) {
                    const state = cells[lineCells[i]];
                    if (state === STAR) stars++;
                    else if (state === UNKNOWN) unknowns++;
                }
                if (stars > STARS_PER_LINE || stars + unknowns < STARS_PER_LINE) return false;
                if (unknowns === 0) continue;
                if (stars === STARS_PER_LINE || stars + unknowns === STARS_PER_LINE) {
                    const fill = stars === STARS_PER_LINE ? EMPTY : STAR;
                    for (let i = start; i < end; i++) {
                        if (cells[lineCells[i]] === UNKNOWN) cells[lineCells[i]] = fill;
                    }
                    isChanged = true;
                }
                else if (STARS_PER_LINE - stars >= 2 && !hasCellsApart(cells, start, end)) return false;
            }
        }
        return hasRoomInPairs(cells);
    }

    /** Whether the line from `start` to `end` in the list has two unknown cells that don't touch. */
    function hasCellsApart(cells: Uint8Array, start: number, end: number): boolean {
        for (let i = start; i < end; i++) {
            if (cells[lineCells[i]] !== UNKNOWN) continue;
            for (let j = i + 1; j < end; j++) {
                if (cells[lineCells[j]] === UNKNOWN && !grid.isTouching(lineCells[i], lineCells[j])) return true;
            }
        }
        return false;
    }

    /**
     * Whether every two rows side by side, and every two columns, still have
     * room for their four stars: no two in neighbouring places along them,
     * since any two cells there touch.
     */
    function hasRoomInPairs(cells: Uint8Array): boolean {
        for (let isColumns = 0; isColumns < 2; isColumns++) {
            for (let first = 0; first + 1 < size; first++) {
                // The most stars that fit up to each place: with none at the place, or with one
                let withNone = 0;
                let withOne = -Infinity;
                for (let along = 0; along < size; along++) {
                    const a = isColumns === 0 ? first * size + along : along * size + first;
                    const b = isColumns === 0 ? a + size : a + 1;
                    const canBeNone = cells[a] !== STAR && cells[b] !== STAR;
                    const canBeOne = cells[a] !== EMPTY || cells[b] !== EMPTY;
                    const nextNone = canBeNone ? Math.max(withNone, withOne) : -Infinity;
                    withOne = canBeOne ? withNone + 1 : -Infinity;
                    withNone = nextNone;
                }
                if (Math.max(withNone, withOne) < STARS_PER_LINE * 2) return false;
            }
        }
        return true;
    }

    /**
     * Counts regions in bands of rows, and of columns. If k regions lie
     * wholly inside k rows side by side, those rows' stars are all theirs,
     * so the rest of the rows is empty. If k rows are wholly covered by k
     * regions, those regions have no stars outside the rows. Returns
     * whether it changed anything.
     */
    function countBands(cells: Uint8Array): boolean {
        let isChanged = false;
        for (let isColumns = 0; isColumns < 2; isColumns++) {
            // The rows (or columns) each region still spans
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

    /**
     * Looks for cells where a star would break the rules, one cell at a
     * time, and empties each it finds. Looking deep, it counts bands inside
     * each look too. Returns whether it found any.
     */
    function lookAhead(cells: Uint8Array, isDeep: boolean): boolean {
        let isChanged = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (cells[cell] !== UNKNOWN) continue;
            trial.set(cells);
            trial[cell] = STAR;
            let isPossible = applyRules(trial);
            while (isDeep && isPossible && countBands(trial)) isPossible = applyRules(trial);
            // A star that breaks the rules here breaks them still, once more cells are known
            if (!isPossible) {
                cells[cell] = EMPTY;
                isChanged = true;
            }
        }
        return isChanged;
    }
}
