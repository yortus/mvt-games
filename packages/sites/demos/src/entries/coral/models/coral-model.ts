import { COLS, ROWS } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The patterns the growth moves through, one after another. */
export type CoralPattern = 'coral' | 'spots' | 'maze' | 'holes' | 'worms';

/**
 * Two chemicals spreading across a grid and reacting: a reaction-diffusion
 * system (the Gray-Scott model). The first, the food, is topped up
 * everywhere. The second, the growth, feeds on it and slowly dies away. How
 * fast the food comes and the growth dies decides the pattern the growth
 * makes, so moving those two rates moves it from one pattern to the next.
 * The grid's edges wrap round.
 */
export interface CoralModel {
    /** How much of the growth is in the cell at `index` (`row * COLS + col`), from 0 to about 0.5. */
    growthAt: (index: number) => number;
    /** The pattern the growth is making, or moving toward. */
    readonly pattern: CoralPattern;
    /** Drops a little growth round a cell, to grow out from. */
    seedAt: (col: number, row: number) => void;
    /** Starts moving toward the next pattern at once, without waiting for this one's time to be up. */
    nextPattern: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Starts making coral, with food everywhere and a few seeds of growth scattered about. */
export function createCoralModel(): CoralModel {
    // Each chemical twice over: this step's amounts, and the next step's, written from them
    let food = new Float32Array(COLS * ROWS).fill(1);
    let growth = new Float32Array(COLS * ROWS);
    let nextFood = new Float32Array(COLS * ROWS);
    let nextGrowth = new Float32Array(COLS * ROWS);
    // Each column's neighbours to the left and right, and each row's above and below, as offsets, wrapping round
    const lefts = Int32Array.from({ length: COLS }, (_, col) => (col + COLS - 1) % COLS);
    const rights = Int32Array.from({ length: COLS }, (_, col) => (col + 1) % COLS);
    const ups = Int32Array.from({ length: ROWS }, (_, row) => ((row + ROWS - 1) % ROWS) * COLS);
    const downs = Int32Array.from({ length: ROWS }, (_, row) => ((row + 1) % ROWS) * COLS);
    let patternIndex = 0;
    // The rates the growth is moving away from, and how many steps into the current pattern it is
    let fromFeed = PATTERNS[0].feed;
    let fromKill = PATTERNS[0].kill;
    let stepsInPattern = BLEND_STEPS;
    let steps = 0;
    let msToRun = 0;

    for (let i = 0; i < FIRST_SEEDS; i++) seedAtRandom();

    return {
        growthAt: (index) => growth[index],
        get pattern() { return PATTERNS[patternIndex].name; },
        seedAt,
        nextPattern,
        update(deltaMs) {
            msToRun += deltaMs;
            while (msToRun >= STEP_MS) {
                msToRun -= STEP_MS;
                step();
                // A new seed every so often keeps the growth alive if a pattern starves it
                if (steps % STEPS_PER_SEED === 0) seedAtRandom();
                if (++stepsInPattern === STEPS_PER_PATTERN) nextPattern();
            }
        },
    };

    function seedAt(col: number, row: number): void {
        for (let r = -SEED_RADIUS; r <= SEED_RADIUS; r++) {
            for (let c = -SEED_RADIUS; c <= SEED_RADIUS; c++) {
                if (r * r + c * c > SEED_RADIUS * SEED_RADIUS) continue;
                const i = wrap(row + r, ROWS) * COLS + wrap(col + c, COLS);
                food[i] = 0.5;
                growth[i] = 0.25 + Math.random() * 0.1;
            }
        }
    }

    function seedAtRandom(): void {
        seedAt(Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS));
    }

    function nextPattern(): void {
        const feed = feedNow();
        const kill = killNow();
        fromFeed = feed;
        fromKill = kill;
        patternIndex = (patternIndex + 1) % PATTERNS.length;
        stepsInPattern = 0;
    }

    /** The food and death rates now: moving from the last pattern's toward this one's, then holding there. */
    function feedNow(): number {
        return fromFeed + (PATTERNS[patternIndex].feed - fromFeed) * blendNow();
    }

    function killNow(): number {
        return fromKill + (PATTERNS[patternIndex].kill - fromKill) * blendNow();
    }

    /** How far the rates have moved from the last pattern's to this one's, from 0 to 1, easing in and out. */
    function blendNow(): number {
        const t = Math.min(1, stepsInPattern / BLEND_STEPS);
        return t * t * (3 - 2 * t);
    }

    /** One step of the reaction and the spreading, everywhere at once. */
    function step(): void {
        const feed = feedNow();
        const kill = killNow();
        for (let row = 0; row < ROWS; row++) {
            const up = ups[row];
            const here = row * COLS;
            const down = downs[row];
            for (let col = 0; col < COLS; col++) {
                const left = lefts[col];
                const right = rights[col];
                const i = here + col;
                const a = food[i];
                const b = growth[i];
                // How much each chemical differs from its neighbours: a fifth from each side, a twentieth from each corner
                const spreadA = 0.2 * (food[up + col] + food[down + col] + food[here + left] + food[here + right])
                    + 0.05 * (food[up + left] + food[up + right] + food[down + left] + food[down + right]) - a;
                const spreadB = 0.2 * (growth[up + col] + growth[down + col] + growth[here + left] + growth[here + right])
                    + 0.05 * (growth[up + left] + growth[up + right] + growth[down + left] + growth[down + right]) - b;
                const reaction = a * b * b;
                nextFood[i] = a + FOOD_SPREAD * spreadA - reaction + feed * (1 - a);
                nextGrowth[i] = b + GROWTH_SPREAD * spreadB + reaction - (kill + feed) * b;
            }
        }
        const oldFood = food;
        food = nextFood;
        nextFood = oldFood;
        const oldGrowth = growth;
        growth = nextGrowth;
        nextGrowth = oldGrowth;
        steps++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The food and death rates that make each pattern, in the order they come. */
const PATTERNS: readonly { name: CoralPattern; feed: number; kill: number }[] = [
    { name: 'coral', feed: 0.0545, kill: 0.062 },
    { name: 'spots', feed: 0.0367, kill: 0.0649 },
    { name: 'maze', feed: 0.029, kill: 0.057 },
    { name: 'holes', feed: 0.039, kill: 0.058 },
    { name: 'worms', feed: 0.078, kill: 0.061 },
];

/** The time each step stands for: about twenty-seven steps a frame. */
const STEP_MS = 0.6;
/** How fast each chemical spreads to its neighbours. */
const FOOD_SPREAD = 1;
const GROWTH_SPREAD = 0.5;
/** How long each pattern lasts, about twenty-five seconds, and how much of that is spent moving into it. */
const STEPS_PER_PATTERN = 42_000;
const BLEND_STEPS = 10_000;
const STEPS_PER_SEED = 8000;
const FIRST_SEEDS = 8;
/** How far a seed reaches from its middle cell, in cells. */
const SEED_RADIUS = 3;

/** `n` wrapped into `0` to `size` - 1. */
function wrap(n: number, size: number): number {
    return (n + size) % size;
}
