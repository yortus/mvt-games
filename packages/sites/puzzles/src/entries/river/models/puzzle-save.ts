import { GIVEN_DRY } from './given-pieces';
import type { RiverPuzzle } from './river-puzzle';

// A puzzle's marks, kept as plain values for storage, and read back. What is
// read back comes from the visitor's browser, so it is checked first:
// anything that is not a whole save of the same puzzle is ignored.

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The puzzle it is of, as `describePuzzle` writes it. */
    readonly puzzle: string;
    /** Each edge's mark, as a digit: 1 where the river crosses it, and 0 elsewhere. */
    readonly rivers: string;
    /** Each cell's mark, as a digit: 1 where it is marked as meadow, and 0 elsewhere. */
    readonly meadows: string;
}

/** A puzzle's marks, as a save holds them. */
export interface PuzzleMarks {
    /** Each edge's mark: 1 for river, 0 for none. */
    readonly rivers: Uint8Array;
    /** Each cell's mark: 1 for meadow, 0 for none. */
    readonly meadows: Uint8Array;
}

/**
 * Returns `puzzle` written out: its size, its spring and its sea, its
 * numbers, and each cell's given as one character, such as
 * `6 12.33 1.2.4.3.2.3 3.3.2.1.4.2 00g0...`. Two puzzles with the same
 * description are the same puzzle, since the ends, the numbers and the
 * givens have one solution between them.
 */
export function describePuzzle(puzzle: RiverPuzzle): string {
    const { grid, spring, sea, rowCounts, colCounts, givens } = puzzle;
    let given = '';
    for (let cell = 0; cell < givens.length; cell++) given += givens[cell].toString(36);
    return `${grid.size} ${spring}.${sea} ${rowCounts.join('.')} ${colCounts.join('.')} ${given}`;
}

/** Returns the save of `puzzle` with these marks. */
export function writePuzzleSave(puzzle: RiverPuzzle, marks: PuzzleMarks): PuzzleSave {
    return { puzzle: describePuzzle(puzzle), rivers: marks.rivers.join(''), meadows: marks.meadows.join('') };
}

/** Returns the marks in `saved`, if it is a whole save of `puzzle`, or undefined if not. */
export function readPuzzleSave(saved: unknown, puzzle: RiverPuzzle): PuzzleMarks | undefined {
    if (typeof saved !== 'object' || saved === null) return undefined;
    const { puzzle: description, rivers, meadows } = saved as Record<string, unknown>;
    const { cellCount, edgeCount } = puzzle.grid;
    if (description !== describePuzzle(puzzle) || typeof rivers !== 'string' || typeof meadows !== 'string') return undefined;
    if (rivers.length !== edgeCount || meadows.length !== cellCount || !/^[01]*$/.test(rivers) || !/^[01]*$/.test(meadows)) return undefined;
    const readMeadows = Uint8Array.from(meadows, Number);
    // Each given dry cell is marked as meadow
    for (let cell = 0; cell < cellCount; cell++) {
        if (puzzle.givens[cell] === GIVEN_DRY && readMeadows[cell] !== 1) return undefined;
    }
    return { rivers: Uint8Array.from(rivers, Number), meadows: readMeadows };
}
