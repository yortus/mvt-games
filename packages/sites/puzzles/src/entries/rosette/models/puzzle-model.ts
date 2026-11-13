import type { GlassWindow } from './glass-window';
import { MOST_UNDOS } from './model-constants';
import { type PuzzleSave, readPuzzleSave, writePuzzleSave } from './puzzle-save';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One picture being put back together: which piece is on each tile. The
 * player swaps two pieces at a time, and the picture is solved once every
 * piece is on its own tile. Only pieces of the same shape swap, as panes of
 * glass would, since a piece can't change its shape to fit another tile.
 *
 * Locked pieces never move. A few are locked from the start. A piece put on
 * its own tile next to a locked one locks too, as a jigsaw piece put in
 * place stays put, and so does any piece in its place that this joins up
 * with. A piece in its place anywhere else stays free, and nothing says it
 * is right, so the player works it out from the colours. Which pieces are
 * locked follows from where the pieces are, so an undo unlocks what its
 * swap locked, and a save needs no record of them.
 *
 * Every swap can be undone, back to the start of the visit. Once the
 * picture is solved, every piece is locked, and it takes no more swaps.
 */
export interface PuzzleModel {
    readonly puzzle: GlassWindow;
    /** The piece on `tile`. */
    readonly pieceAt: (tile: number) => number;
    /** The colour of the piece on `tile`, as 0xRRGGBB. */
    readonly colourAt: (tile: number) => number;
    /** Whether the piece on `tile` is locked there: from the start, or since it joined the locked pieces in its place. */
    readonly isLockedAt: (tile: number) => boolean;
    /** How many pieces are locked. */
    readonly lockedCount: number;
    /** Swaps that locked more pieces, since the puzzle opened. It only rises: an undo that unlocks them doesn't take it back. */
    readonly locksGained: number;
    /** Whether the pieces on `a` and `b` can swap: two different tiles, both free, of the same shape. */
    readonly canSwap: (a: number, b: number) => boolean;
    readonly isSolved: boolean;
    /** Swaps that stand: each swap counts one, and each undo takes one back. */
    readonly swapCount: number;
    /** How many swaps undo can take back. */
    readonly undoCount: number;
    /** Swaps made, and undone, since the puzzle opened. Each only rises. */
    readonly swapsMade: number;
    readonly undosDone: number;
    /** The two tiles whose pieces changed places last, by a swap or an undo, or -1. */
    readonly lastTileA: number;
    readonly lastTileB: number;
    /** A count that rises with every swap and every undo, so that progress can be kept, and the picture redrawn, as it changes. */
    readonly changes: number;

    /** Swaps the pieces on `a` and `b`. Does nothing if they can't swap, or the picture is solved. */
    swap: (a: number, b: number) => void;
    /** Takes back the last swap. */
    undo: () => void;
    /** Returns the puzzle as it stands, to be restored later through the options' `saved`. */
    save: () => PuzzleSave;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PuzzleModelOptions {
    readonly puzzle: GlassWindow;
    /**
     * A save of this puzzle, from `save`, maybe from a visit before. It is
     * read from storage, so it is checked first. One that is not a save of
     * this puzzle is ignored, and the puzzle starts from its jumble.
     */
    readonly saved?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a puzzle jumbled, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { puzzle } = options;
    const { colours, locked } = puzzle;
    const { count, shapes } = puzzle.patch;
    const restored = readPuzzleSave(options.saved, puzzle);
    const pieces = restored?.pieces ?? Uint16Array.from(puzzle.jumble);
    // Pairs of tiles, two to a swap, newest last
    const history: number[] = [];
    // Which tiles' pieces are locked, worked out again after every change, and a queue to work them out with
    const isLocked = new Uint8Array(count);
    const queue = new Int32Array(count);
    let lockedCount = 0;
    findLocks();

    let misplaced = 0;
    for (let t = 0; t < count; t++) if (pieces[t] !== t) misplaced++;
    let swapCount = restored?.swaps ?? 0;
    let swapsMade = 0;
    let locksGained = 0;
    let undosDone = 0;
    let lastTileA = -1;
    let lastTileB = -1;
    let changes = 0;

    const model: PuzzleModel = {
        puzzle,
        pieceAt: (tile) => pieces[tile],
        colourAt: (tile) => colours[pieces[tile]],
        isLockedAt: (tile) => isLocked[tile] === 1,
        get lockedCount() { return lockedCount; },
        get locksGained() { return locksGained; },
        canSwap,
        get isSolved() { return misplaced === 0; },
        get swapCount() { return swapCount; },
        get undoCount() { return history.length / 2; },
        get swapsMade() { return swapsMade; },
        get undosDone() { return undosDone; },
        get lastTileA() { return lastTileA; },
        get lastTileB() { return lastTileB; },
        get changes() { return changes; },
        swap(a, b) {
            if (misplaced === 0 || !canSwap(a, b)) return;
            const lockedBefore = lockedCount;
            exchange(a, b);
            if (lockedCount > lockedBefore) locksGained++;
            history.push(a, b);
            if (history.length > MOST_UNDOS * 2) history.splice(0, 2);
            swapCount++;
            swapsMade++;
        },
        undo() {
            if (misplaced === 0 || history.length === 0) return;
            const b = history.pop()!;
            const a = history.pop()!;
            exchange(a, b);
            swapCount = Math.max(0, swapCount - 1);
            undosDone++;
        },
        save: () => writePuzzleSave(puzzle, pieces, swapCount),
    };
    return model;

    function canSwap(a: number, b: number): boolean {
        return a !== b && isTile(a) && isTile(b) && isLocked[a] === 0 && isLocked[b] === 0 && shapes[a] === shapes[b];
    }

    function isTile(tile: number): boolean {
        return Number.isInteger(tile) && tile >= 0 && tile < count;
    }

    /**
     * Locks the pieces locked from the start, and every piece in its place
     * that joins up with them through pieces in their places, neighbour to
     * neighbour, breadth first.
     */
    function findLocks(): void {
        isLocked.fill(0);
        let head = 0;
        let tail = 0;
        for (let t = 0; t < count; t++) {
            if (locked[t] === 0) continue;
            isLocked[t] = 1;
            queue[tail++] = t;
        }
        while (head < tail) {
            const near = puzzle.patch.neighboursOf(queue[head++]);
            for (let i = 0; i < near.length; i++) {
                const n = near[i];
                if (isLocked[n] === 1 || pieces[n] !== n) continue;
                isLocked[n] = 1;
                queue[tail++] = n;
            }
        }
        lockedCount = tail;
    }

    /** Swaps two tiles' pieces, keeping count of the pieces off their own tiles, and of which are locked. */
    function exchange(a: number, b: number): void {
        const before = (pieces[a] !== a ? 1 : 0) + (pieces[b] !== b ? 1 : 0);
        const piece = pieces[a];
        pieces[a] = pieces[b];
        pieces[b] = piece;
        misplaced += (pieces[a] !== a ? 1 : 0) + (pieces[b] !== b ? 1 : 0) - before;
        findLocks();
        lastTileA = a;
        lastTileB = b;
        changes++;
    }
}
