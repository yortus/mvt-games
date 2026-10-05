import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// The city's layout, shared by the views that draw on it
// ---------------------------------------------------------------------------

// The ground is scenery, not part of the game, so it lives in the views. It is
// laid out in chunks: bands of ground, CHUNK_HEIGHT world-units tall, counted
// from where the stage starts. Ground y counts up from there, ahead of the
// ship; a view turns it into screen y with `groundToScreenY`. Every chunk is
// made up from its index alone, so the same chunk always looks the same.

/** The height of one chunk of ground: a cross street and a row of blocks. */
export const CHUNK_HEIGHT = 72;

/** The height of the cross street along the top of each city chunk. */
export const CROSS_STREET_HEIGHT = 8;

/** Chunks of open water, before the coast. */
export const SEA_CHUNKS = 5;

/** Where the city starts, in ground y: past the sea and the coast. */
export const CITY_START_Y = (SEA_CHUNKS + 1) * CHUNK_HEIGHT;

/** A street running the length of the city, with a neon trace along each kerb. */
export interface Avenue {
    readonly x: number;
    readonly width: number;
    readonly neon: number;
}

export const AVENUES: readonly Avenue[] = [
    { x: 54, width: 10, neon: NEON.cyan },
    { x: 128, width: 16, neon: NEON.magenta },
    { x: 200, width: 10, neon: NEON.violet },
];

/** What a chunk of ground is. */
export type ChunkKind = 'sea' | 'coast' | 'blocks' | 'hub';

export function chunkKindAt(index: number): ChunkKind {
    if (index < SEA_CHUNKS) return 'sea';
    if (index === SEA_CHUNKS) return 'coast';
    // Every so often, a hub: a plaza around a great glowing chip.
    return hash(index, 7) % 5 === 0 ? 'hub' : 'blocks';
}

/** The screen y of a ground y, given how far the city has scrolled. */
export function groundToScreenY(groundY: number, scrollY: number, screenHeight: number): number {
    return screenHeight - (groundY - scrollY);
}

/** A small, stable hash of two integers, so the same place is always made the same way. */
export function hash(a: number, b: number): number {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}
