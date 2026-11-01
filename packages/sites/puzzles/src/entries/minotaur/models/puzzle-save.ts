import type { MazePuzzle } from './make-maze-puzzle';

// A puzzle's marks, kept as plain values for storage, and read back. What is
// read back comes from the visitor's browser, so it is checked first:
// anything that is not a whole save of the same maze is ignored.

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The maze it is of, as `describeMaze` writes it. */
    readonly maze: string;
    /** Each edge's mark, as a digit: 0 for none, 1 for a passage, 2 for a wall. */
    readonly marks: string;
}

/** Returns `maze` written out: its size, its ends and its clues, such as `5x5 3-21 1.2/3/...`. Two mazes with the same description are the same puzzle. */
export function describeMaze(maze: MazePuzzle): string {
    const clues = maze.clues.map((clue) => clue.join('.')).join('/');
    return `${maze.grid.rows}x${maze.grid.cols} ${maze.start}-${maze.end} ${clues}`;
}

/** Returns the save of `maze` with `marks`. */
export function writePuzzleSave(maze: MazePuzzle, marks: Readonly<Uint8Array>): PuzzleSave {
    return { maze: describeMaze(maze), marks: marks.join('') };
}

/** Returns the marks in `saved`, if it is a whole save of `maze`, or undefined if not. */
export function readPuzzleSave(saved: unknown, maze: MazePuzzle): Uint8Array | undefined {
    if (typeof saved !== 'object' || saved === null) return undefined;
    const { maze: description, marks } = saved as Record<string, unknown>;
    if (description !== describeMaze(maze) || typeof marks !== 'string') return undefined;
    if (marks.length !== maze.grid.edgeCount || !/^[012]*$/.test(marks)) return undefined;
    return Uint8Array.from(marks, Number);
}
