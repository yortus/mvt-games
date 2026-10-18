import { CAVE_HEIGHT, SUB_X } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type GamePhase = 'ready' | 'cruising' | 'crashed';

/**
 * The whole game. The submarine cruises on through a winding sea cave, faster
 * and with the cave narrowing the further it goes. Holding rise blows its
 * tanks and lifts it, and letting go lets it sink.
 */
export interface GameModel {
    readonly phase: GamePhase;
    /** How far the submarine has gone, in cave units. It is the score. */
    readonly distance: number;
    /** The furthest run this session. */
    readonly best: number;
    /** The submarine's depth, in cave units down from the top, and its speed downward. */
    readonly y: number;
    readonly ySpeed: number;
    /** The cave's roof and floor, `x` cave units from its mouth, in cave units down from the top. */
    ceilingAt: (x: number) => number;
    floorAt: (x: number) => number;
    /** Whether the submarine's tanks are being blown, which lifts it. The first time they are, the run starts. */
    isBlowingTanks: boolean;
    /** Asks for a new run. It starts at the next update, if the last run is over. */
    startNewRun: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Starts a game with the submarine at the cave's mouth, waiting for the first rise. */
export function createGameModel(): GameModel {
    let phase: GamePhase;
    let distance: number;
    let best = 0;
    let y: number;
    let ySpeed: number;
    let bendA: number;
    let bendB: number;
    let isNewRunRequested = false;
    restart();

    const model: GameModel = {
        get phase() { return phase; },
        get distance() { return distance; },
        get best() { return best; },
        get y() { return y; },
        get ySpeed() { return ySpeed; },
        ceilingAt: (x) => middleAt(x) - gapAt(x) / 2,
        floorAt: (x) => middleAt(x) + gapAt(x) / 2,
        isBlowingTanks: false,
        startNewRun: () => { isNewRunRequested = true; },
        update(deltaMs) {
            // A new run asked for while one is under way is dropped, not kept for later
            if (isNewRunRequested && phase === 'crashed') restart();
            isNewRunRequested = false;
            if (phase === 'ready' && model.isBlowingTanks) phase = 'cruising';
            if (phase !== 'cruising') return;

            const deltaSec = deltaMs / 1000;
            ySpeed += (model.isBlowingTanks ? -SINKING : SINKING) * deltaSec;
            ySpeed = Math.min(Math.max(ySpeed, -MAX_Y_SPEED), MAX_Y_SPEED);
            y += ySpeed * deltaSec;
            distance += (START_SPEED + distance * SPEED_GAIN) * deltaSec;
            best = Math.max(best, distance);

            const x = distance + SUB_X;
            if (y - SUB_RADIUS < model.ceilingAt(x) || y + SUB_RADIUS > model.floorAt(x)) phase = 'crashed';
        },
    };
    return model;

    function restart(): void {
        phase = 'ready';
        distance = 0;
        y = CAVE_HEIGHT / 2;
        ySpeed = 0;
        // A new cave each run: its two bends start at new points in their waves
        bendA = Math.random() * Math.PI * 2;
        bendB = Math.random() * Math.PI * 2;
    }

    /** The middle of the cave: two waves added, swinging wider as the gap narrows. */
    function middleAt(x: number): number {
        const wave = 0.6 * Math.sin(x * 0.35 + bendA) + 0.4 * Math.sin(x * 0.13 + bendB);
        return CAVE_HEIGHT / 2 + wave * (CAVE_HEIGHT - gapAt(x)) / 2;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How fast the submarine goes at the mouth, in cave units per second, and how much faster for each unit further in. */
const START_SPEED = 5;
const SPEED_GAIN = 0.04;
/** In cave units per second. Rising lifts as hard as sinking pulls, so a steady half-and-half holds level. */
const SINKING = 22;
const MAX_Y_SPEED = 10;
/** The submarine's size, in cave units from its centre. */
const SUB_RADIUS = 0.35;

/** The gap between roof and floor: wide at the mouth, narrowing to its tightest a hundred units in. */
function gapAt(x: number): number {
    return Math.max(3, 8 - x * 0.05);
}
