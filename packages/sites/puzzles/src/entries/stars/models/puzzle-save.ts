import type { StarPuzzle } from './star-puzzle';

// A puzzle's marks, kept as plain values for storage, and read back. What is
// read back comes from the visitor's browser, so it is checked first:
// anything that is not a whole save of the same puzzle is ignored.

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The puzzle it is of, as `describePuzzle` writes it. */
    readonly puzzle: string;
    /** Each cell's mark, as a digit: 0 for none, 1 for a dot, 2 for a star. */
    readonly marks: string;
}

/** Returns `puzzle` written out: its size and each cell's region, such as `9 001122...`. Two puzzles with the same description are the same puzzle. */
export function describePuzzle(puzzle: StarPuzzle): string {
    return `${puzzle.grid.size} ${puzzle.regions.join('')}`;
}

/** Returns the save of `puzzle` with `marks`. */
export function writePuzzleSave(puzzle: StarPuzzle, marks: Readonly<Uint8Array>): PuzzleSave {
    return { puzzle: describePuzzle(puzzle), marks: marks.join('') };
}

/** Returns the marks in `saved`, if it is a whole save of `puzzle`, or undefined if not. */
export function readPuzzleSave(saved: unknown, puzzle: StarPuzzle): Uint8Array | undefined {
    if (typeof saved !== 'object' || saved === null) return undefined;
    const { puzzle: description, marks } = saved as Record<string, unknown>;
    if (description !== describePuzzle(puzzle) || typeof marks !== 'string') return undefined;
    if (marks.length !== puzzle.grid.cellCount || !/^[012]*$/.test(marks)) return undefined;
    return Uint8Array.from(marks, Number);
}
