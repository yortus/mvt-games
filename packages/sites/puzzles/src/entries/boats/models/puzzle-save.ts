import { GIVEN_WATER, isGivenBoat } from './given-pieces';
import type { BoatPuzzle } from './boat-puzzle';

// A puzzle's marks, kept as plain values for storage, and read back. What is
// read back comes from the visitor's browser, so it is checked first:
// anything that is not a whole save of the same puzzle is ignored.

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The puzzle it is of, as `describePuzzle` writes it. */
    readonly puzzle: string;
    /** Each cell's mark, as a digit: `NO_MARK`, `WATER_MARK` or `BOAT_MARK`. */
    readonly marks: string;
}

/**
 * A cell that isn't marked. Each mark is stored as a number, in the puzzle
 * and in a save, and a save writes it as one digit. Saves in players'
 * browsers hold these digits, so the numbers must never change.
 */
export const NO_MARK = 0;

/** Water, stored as a number. See `NO_MARK`. */
export const WATER_MARK = 1;

/** Part of a boat, stored as a number. See `NO_MARK`. */
export const BOAT_MARK = 2;

/**
 * Returns `puzzle` written out: its size, its fleet, its numbers, and each
 * cell's given, such as `6 322111 1.2.0.3.2.2 2.1.2.1.2.2 000100...`. Two
 * puzzles with the same description are the same puzzle, since the fleet,
 * the numbers and the givens have one solution between them.
 */
export function describePuzzle(puzzle: BoatPuzzle): string {
    const { grid, fleet, rowCounts, colCounts, givens } = puzzle;
    return `${grid.size} ${fleet.join('')} ${rowCounts.join('.')} ${colCounts.join('.')} ${givens.join('')}`;
}

/** Returns the save of `puzzle` with `marks`. */
export function writePuzzleSave(puzzle: BoatPuzzle, marks: Readonly<Uint8Array>): PuzzleSave {
    return { puzzle: describePuzzle(puzzle), marks: marks.join('') };
}

/** Returns the marks in `saved`, if it is a whole save of `puzzle`, or undefined if not. */
export function readPuzzleSave(saved: unknown, puzzle: BoatPuzzle): Uint8Array | undefined {
    if (typeof saved !== 'object' || saved === null) return undefined;
    const { puzzle: description, marks } = saved as Record<string, unknown>;
    const { cellCount } = puzzle.grid;
    if (description !== describePuzzle(puzzle) || typeof marks !== 'string') return undefined;
    if (marks.length !== cellCount || !/^\d*$/.test(marks)) return undefined;
    const readMarks = Uint8Array.from(marks, Number);
    for (let cell = 0; cell < cellCount; cell++) {
        const mark = readMarks[cell];
        if (mark !== NO_MARK && mark !== WATER_MARK && mark !== BOAT_MARK) return undefined;
        // Each given's mark is the given itself: water, or part of a boat
        const given = puzzle.givens[cell];
        if ((given === GIVEN_WATER && mark !== WATER_MARK) || (isGivenBoat(given) && mark !== BOAT_MARK)) return undefined;
    }
    return readMarks;
}
