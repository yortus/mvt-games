// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

/** A pond or a rock in the meadow from the start, as an ellipse of cells. */
export interface ObstacleSpec {
    readonly kind: 'pond' | 'rock';
    /** Its centre, in cells. A half cell puts it on a grid line. */
    readonly row: number;
    readonly col: number;
    /** Its half-height and half-width, in cells. */
    readonly rowRadius: number;
    readonly colRadius: number;
}

/** How one round plays. */
export interface RoundConfig {
    /** How many dust devils whirl in the meadow. */
    readonly devilCount: number;
    /** How fast they whirl along, in cells per second. */
    readonly devilSpeed: number;
    /**
     * How strongly a dust devil turns towards the farmhand while wire is out,
     * from 0 (not at all) to 1 (straight at them), each time it turns.
     */
    readonly devilChase: number;
    /** How fast the beetles crawl along the fences, in grid steps per second. */
    readonly beetleSpeed: number;
    /** Beetles on the fences as the round starts. */
    readonly startBeetles: number;
    /** The most beetles there can be. */
    readonly maxBeetles: number;
    /** How often another beetle hatches, until there are `maxBeetles`. */
    readonly hatchIntervalMs: number;
    /** Sheep grazing in the meadow as the round starts. */
    readonly sheepCount: number;
    /** The share of the meadow to fence off, from 0 to 1, to clear the round. */
    readonly targetShare: number;
    readonly obstacles: readonly ObstacleSpec[];
    /** Where the dust devils start, in cells. Left out, each starts somewhere open, at random. */
    readonly devilStarts?: readonly CellPosition[];
    /** Where the sheep start, in cells. Left out, each starts somewhere open, at random. */
    readonly sheepStarts?: readonly CellPosition[];
}

/** A place in the meadow, in cells. */
export interface CellPosition {
    readonly row: number;
    readonly col: number;
}

/**
 * The rounds, in order. After the last, it repeats with everything a little
 * faster. The ponds and rocks were placed on a blank grid for this game.
 */
export const ROUNDS: readonly RoundConfig[] = [
    // One dust devil in an open meadow
    {
        devilCount: 1,
        devilSpeed: 6,
        devilChase: 0,
        beetleSpeed: 5,
        startBeetles: 2,
        maxBeetles: 3,
        hatchIntervalMs: 25_000,
        sheepCount: 4,
        targetShare: 0.7,
        obstacles: [],
    },
    // A pond to tie a fence to, and a dust devil that leans towards the wire
    {
        devilCount: 1,
        devilSpeed: 7,
        devilChase: 0.15,
        beetleSpeed: 5.5,
        startBeetles: 2,
        maxBeetles: 4,
        hatchIntervalMs: 20_000,
        sheepCount: 5,
        targetShare: 0.72,
        obstacles: [
            { kind: 'pond', row: 21, col: 40, rowRadius: 5, colRadius: 7 },
        ],
    },
    // Two dust devils. Corner one in a small paddock and it blows itself out
    {
        devilCount: 2,
        devilSpeed: 7,
        devilChase: 0.15,
        beetleSpeed: 6,
        startBeetles: 2,
        maxBeetles: 4,
        hatchIntervalMs: 18_000,
        sheepCount: 5,
        targetShare: 0.75,
        obstacles: [
            { kind: 'rock', row: 12, col: 15, rowRadius: 2, colRadius: 2.5 },
            { kind: 'rock', row: 30, col: 44, rowRadius: 2.5, colRadius: 2 },
        ],
    },
    // A long pond and a rock
    {
        devilCount: 2,
        devilSpeed: 8,
        devilChase: 0.25,
        beetleSpeed: 6.5,
        startBeetles: 3,
        maxBeetles: 5,
        hatchIntervalMs: 15_000,
        sheepCount: 6,
        targetShare: 0.75,
        obstacles: [
            { kind: 'pond', row: 14, col: 30, rowRadius: 3.5, colRadius: 11 },
            { kind: 'rock', row: 31, col: 12, rowRadius: 2, colRadius: 3 },
        ],
    },
    // Two small ponds and a rock between them
    {
        devilCount: 2,
        devilSpeed: 9,
        devilChase: 0.3,
        beetleSpeed: 7,
        startBeetles: 3,
        maxBeetles: 6,
        hatchIntervalMs: 12_000,
        sheepCount: 6,
        targetShare: 0.75,
        obstacles: [
            { kind: 'pond', row: 13, col: 16, rowRadius: 4, colRadius: 5 },
            { kind: 'pond', row: 29, col: 44, rowRadius: 4, colRadius: 5 },
            { kind: 'rock', row: 21, col: 30, rowRadius: 2, colRadius: 2 },
        ],
    },
];

/** How much faster each lap through the rounds is than the last. */
export const LAP_SPEED_UP = 0.1;
