import { CELL_COUNT, COLUMN_OF, countDigits, findCandidates, pickDigit, ROW_OF, type SudokuGenerator } from '#sudoku-digger';
import { findPuzzleSeed } from './find-puzzle-seed';
import type { PuzzleModel } from './puzzle-model';
import type { SudokuModel } from './sudoku-model';

/**
 * Plays some of today's puzzle, as a player might: it opens it, fills in a
 * few cells, and pencils into others digits that could go there. Further
 * down, it links a pair of cells side by side, and a pair with a gap
 * between, with group notes, and leaves the first pair selected. For the thumbnail, and the visual tests, which show
 * the game in play.
 */
export function playShowcase(options: ShowcaseOptions): void {
    const { model } = options;
    model.openPuzzle(model.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const { givens, solution } = options.generate({ seed: findPuzzleSeed(model.today, model.level), level: model.level });
    const givenDigits = Uint8Array.from(givens);

    const empty: number[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (givens[cell] === 0) empty.push(cell);
    }
    // Every third empty cell near the top is filled in, and the two after it are pencilled in
    for (let i = 0; i < SHOWCASE_CELLS && i < empty.length; i++) {
        const cell = empty[i];
        if (i % 3 === 0) {
            puzzle.openPicker(cell);
            puzzle.fillIn(solution[cell]);
            continue;
        }
        // The right digit, and up to two others that the givens allow there: the highest, and the middle one
        const candidates = findCandidates(givenDigits, cell);
        const count = countDigits(candidates);
        puzzle.select([cell]);
        for (const digit of new Set([solution[cell], pickDigit(candidates, count - 1), pickDigit(candidates, count >> 1)])) {
            puzzle.toggleNote(digit);
        }
    }

    // Below, a pair with a gap between, then a pair side by side, which is left selected
    const below = empty.slice(SHOWCASE_CELLS);
    const apart = below.find((cell) => below.some((other) => isPairApart(cell, other)));
    const partner = below.find((other) => apart !== undefined && isPairApart(apart, other));
    if (apart !== undefined && partner !== undefined) linkPair(puzzle, [apart, partner], solution);
    const side = below.find((cell) => COLUMN_OF[cell] < 8 && below.includes(cell + 1) && cell !== apart && cell + 1 !== apart);
    if (side !== undefined) linkPair(puzzle, [side, side + 1], solution);
}

/** What `playShowcase` plays in. */
export interface ShowcaseOptions {
    /** The game, on the calendar, to open today's puzzle in. */
    readonly model: SudokuModel;
    /** The puzzle maker the game was given, for the puzzle's solution. */
    readonly generate: SudokuGenerator;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many of the empty cells, from the top, the showcase fills in and pencils into. */
const SHOWCASE_CELLS = 24;

/** Notes the digits of `cells` in the solution as a group note, leaving them selected. */
function linkPair(puzzle: PuzzleModel, cells: readonly number[], solution: readonly number[]): void {
    puzzle.select(cells);
    for (const cell of cells) puzzle.toggleNote(solution[cell]);
}

/** Whether `cell` and `other` are in the same row, with two or three cells between them. */
function isPairApart(cell: number, other: number): boolean {
    return ROW_OF[cell] === ROW_OF[other] && other - cell >= 3 && other - cell <= 4;
}
