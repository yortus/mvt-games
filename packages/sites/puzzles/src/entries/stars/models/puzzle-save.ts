import { EMPTY, STAR } from './cell-states';
import { STARS_PER_LINE } from './star-grid';
import type { StarPuzzle } from './star-puzzle';

// A puzzle's marks, kept as plain values for storage, and read back. What is
// read back comes from the visitor's browser, so it is checked first:
// anything that is not a whole save of the same puzzle is ignored.

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The puzzle it is of, as `describePuzzle` writes it. */
    readonly puzzle: string;
    /** Each cell's mark, as a digit: `NO_MARK`, `CROSS_MARK` or `STAR_MARK`. */
    readonly marks: string;
    /** The groups the player ringed, each its cells joined by dots, the groups joined by slashes, such as `3.4/12.13.21`. */
    readonly groups: string;
}

/** A puzzle's marks and groups, as a save holds them. */
export interface PuzzleMarks {
    /** Each cell's mark: `NO_MARK`, `CROSS_MARK` or `STAR_MARK`. */
    readonly marks: Uint8Array;
    /** Each group's cells, in order. */
    readonly groups: (readonly number[])[];
}

/**
 * A cell that isn't marked. Each mark is stored as a number, in the puzzle
 * and in a save, and a save writes it as one digit. Saves in players'
 * browsers hold these digits, so the numbers must never change.
 */
export const NO_MARK = 0;

/** A cross, stored as a number. See `NO_MARK`. */
export const CROSS_MARK = 1;

/** A star, stored as a number. See `NO_MARK`. */
export const STAR_MARK = 2;

/**
 * Returns `puzzle` written out: its size, its stars a line, each cell's
 * region, and each cell's given, such as `9x2 001122... 000102...`. Two
 * puzzles with the same description are the same puzzle.
 */
export function describePuzzle(puzzle: StarPuzzle): string {
    return `${puzzle.grid.size}x${STARS_PER_LINE} ${puzzle.regions.join('')} ${puzzle.givens.join('')}`;
}

/** Returns the save of `puzzle` with `marks` and `groups`. */
export function writePuzzleSave(puzzle: StarPuzzle, marks: Readonly<Uint8Array>, groups: readonly (readonly number[])[]): PuzzleSave {
    return { puzzle: describePuzzle(puzzle), marks: marks.join(''), groups: groups.map((group) => group.join('.')).join('/') };
}

/** Returns the marks and groups in `saved`, if it is a whole save of `puzzle`, or undefined if not. */
export function readPuzzleSave(saved: unknown, puzzle: StarPuzzle): PuzzleMarks | undefined {
    if (typeof saved !== 'object' || saved === null) return undefined;
    const { puzzle: description, marks, groups } = saved as Record<string, unknown>;
    const { cellCount } = puzzle.grid;
    if (description !== describePuzzle(puzzle) || typeof marks !== 'string' || typeof groups !== 'string') return undefined;
    if (marks.length !== cellCount || !/^\d*$/.test(marks)) return undefined;
    if (groups !== '' && !/^\d+(\.\d+)+(\/\d+(\.\d+)+)*$/.test(groups)) return undefined;
    const readGroups = groups === '' ? [] : groups.split('/').map((group) => group.split('.').map(Number));
    if (readGroups.some((group) => group.some((cell) => cell >= cellCount))) return undefined;
    const readMarks = Uint8Array.from(marks, Number);
    for (let cell = 0; cell < cellCount; cell++) {
        const mark = readMarks[cell];
        if (mark !== NO_MARK && mark !== CROSS_MARK && mark !== STAR_MARK) return undefined;
        // Each given's mark is the given itself: a star, or a cross
        const given = puzzle.givens[cell];
        if ((given === STAR && mark !== STAR_MARK) || (given === EMPTY && mark !== CROSS_MARK)) return undefined;
    }
    return { marks: readMarks, groups: readGroups };
}
