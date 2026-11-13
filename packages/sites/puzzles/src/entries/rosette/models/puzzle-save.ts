import type { GlassWindow } from './glass-window';

// A puzzle's arrangement, kept as plain values for storage, and read back.
// What is read back comes from the visitor's browser, so it is checked
// first: anything that is not a whole save of the same puzzle is ignored.

/** A puzzle as it stood, kept as plain values for storage. */
export interface PuzzleSave {
    /** The puzzle it is of, as its `description` writes it. */
    readonly puzzle: string;
    /** The piece on each tile, in base 36, with dots between. */
    readonly pieces: string;
    /** How many swaps the player had made. */
    readonly swaps: number;
}

/** Returns the save of `puzzle` with `pieces` on its tiles, after `swaps` swaps. */
export function writePuzzleSave(puzzle: GlassWindow, pieces: Readonly<Uint16Array>, swaps: number): PuzzleSave {
    let text = '';
    for (let t = 0; t < pieces.length; t++) text += (t === 0 ? '' : '.') + pieces[t].toString(36);
    return { puzzle: puzzle.description, pieces: text, swaps };
}

/**
 * What a save holds, if `saved` is a whole save of `puzzle`, with every
 * locked piece in place and every piece on a tile of its shape, or undefined
 * if not.
 */
export function readPuzzleSave(saved: unknown, puzzle: GlassWindow): { readonly pieces: Uint16Array; readonly swaps: number } | undefined {
    if (typeof saved !== 'object' || saved === null) return undefined;
    const { puzzle: description, pieces, swaps } = saved as Record<string, unknown>;
    if (description !== puzzle.description || typeof pieces !== 'string' || typeof swaps !== 'number' || !Number.isInteger(swaps) || swaps < 0) return undefined;
    const parts = pieces.split('.');
    const count = puzzle.patch.count;
    if (parts.length !== count) return undefined;
    const read = new Uint16Array(count);
    const seen = new Uint8Array(count);
    for (let t = 0; t < count; t++) {
        const piece = parseInt(parts[t], 36);
        if (!Number.isInteger(piece) || piece < 0 || piece >= count || seen[piece] === 1) return undefined;
        if ((puzzle.locked[t] === 1 && piece !== t) || puzzle.patch.shapes[piece] !== puzzle.patch.shapes[t]) return undefined;
        seen[piece] = 1;
        read[t] = piece;
    }
    return { pieces: read, swaps };
}
