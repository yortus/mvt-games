import type { SongOrderEntry } from './song-core';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Parses a song's order: pattern names, each of which may add a
 * transposition in semitones, as in `'verse+5'`. Throws if the order is
 * empty, or names a pattern that is not in `patternNames`.
 */
export function parseOrder(order: readonly string[], patternNames: readonly string[]): SongOrderEntry[] {
    if (order.length === 0) throw new Error('song: order is empty');
    return order.map((entry) => {
        // Match a whole pattern name first, so 'part-2' finds a pattern named 'part-2', not 'part' transposed down two
        const whole = patternNames.indexOf(entry);
        if (whole >= 0) return { pattern: whole, transpose: 0 };
        const match = /^(.*?)([+-]\d+)?$/.exec(entry);
        const index = match === null ? -1 : patternNames.indexOf(match[1]);
        if (match === null || index < 0) throw new Error(`song: order names '${entry}', which is not a pattern`);
        return { pattern: index, transpose: match[2] === undefined ? 0 : Number(match[2]) };
    });
}
