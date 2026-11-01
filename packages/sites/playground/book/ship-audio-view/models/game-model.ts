// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the ship moves, in world units a ms. */
const SHIP_SPEED = 0.5;
/** How fast a shot rises, in world units a ms. */
const SHOT_SPEED = 0.6;
/** The least time between shots, in ms. */
const FIRE_COOLDOWN_MS = 150;
/** How fast the rock falls, in world units a ms. */
const ROCK_SPEED = 0.1;
/** How long a lost ship takes to come back, in ms. */
const RESPAWN_MS = 1500;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A shot, rising from the ship. */
export interface Shot {
    readonly x: number;
    readonly y: number;
}

/**
 * A ship at the bottom of the screen, and a rock falling toward it. The ship
 * moves left and right, and fires shots straight up. A shot that hits the
 * rock breaks it, and a rock that reaches the ship destroys it. A lost ship
 * comes back after a moment. Positions are in world units, with the top
 * left corner at 0, 0. The model plays no sounds. It only keeps the state
 * an audio view needs, such as how many shots have been fired.
 */
export interface GameModel {
    readonly shipX: number;
    readonly shipY: number;
    readonly isAlive: boolean;
    /** Shots fired this game. Each rise is a shot. */
    readonly shotsFired: number;
    readonly shots: readonly Shot[];
    readonly rockX: number;
    readonly rockY: number;
    readonly rockRadius: number;
    /** Sets where the ship heads, along the bottom of the screen. */
    readonly moveTo: (x: number) => void;
    /** Fires a shot, unless the ship is lost or has only just fired. */
    readonly fire: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    /** The size of the play area, in world units. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ship in the middle of the bottom of the screen, and a rock starting to fall. */
export function createGameModel({ width, height }: GameModelOptions): GameModel {
    const shipY = height - 40;
    let shipX = width / 2;
    let targetX = shipX;
    let isAlive = true;
    // How long until a lost ship comes back, in ms
    let respawnMs = 0;
    let cooldownMs = 0;
    let shotsFired = 0;
    const shots: { x: number; y: number }[] = [];
    // The rock falls in each lane in turn
    let laneIndex = 0;
    let rockX = 0;
    let rockY = 0;
    dropRock();

    const model: GameModel = {
        get shipX() { return shipX; },
        shipY,
        get isAlive() { return isAlive; },
        get shotsFired() { return shotsFired; },
        shots,
        get rockX() { return rockX; },
        get rockY() { return rockY; },
        rockRadius: ROCK_RADIUS,

        moveTo(x) {
            targetX = Math.min(Math.max(x, SHIP_HALF_WIDTH), width - SHIP_HALF_WIDTH);
        },

        fire() {
            if (!isAlive || cooldownMs > 0) return;
            cooldownMs = FIRE_COOLDOWN_MS;
            shots.push({ x: shipX, y: shipY - SHIP_HALF_WIDTH });
            shotsFired += 1;
        },

        update(deltaMs) {
            cooldownMs = Math.max(0, cooldownMs - deltaMs);

            // The ship heads for its target at a steady speed
            const step = SHIP_SPEED * deltaMs;
            shipX += Math.min(Math.max(targetX - shipX, -step), step);

            // Shots rise, and leave at the top
            for (let i = shots.length - 1; i >= 0; i--) {
                shots[i].y -= SHOT_SPEED * deltaMs;
                if (shots[i].y < -SHOT_RADIUS) shots.splice(i, 1);
            }

            rockY += ROCK_SPEED * deltaMs;

            // A shot that reaches the rock breaks it, and a new one falls
            for (let i = shots.length - 1; i >= 0; i--) {
                if (isTouching(shots[i].x, shots[i].y, SHOT_RADIUS)) {
                    shots.splice(i, 1);
                    dropRock();
                    break;
                }
            }

            if (!isAlive) {
                respawnMs -= deltaMs;
                if (respawnMs <= 0) isAlive = true;
            }
            else if (isTouching(shipX, shipY, SHIP_HALF_WIDTH)) {
                isAlive = false;
                respawnMs = RESPAWN_MS;
                dropRock();
            }

            if (rockY > height + ROCK_RADIUS) dropRock();
        },
    };

    return model;

    function dropRock(): void {
        rockX = LANES[laneIndex] * width;
        rockY = -ROCK_RADIUS;
        laneIndex = (laneIndex + 1) % LANES.length;
    }

    function isTouching(x: number, y: number, radius: number): boolean {
        const reach = radius + ROCK_RADIUS;
        return (x - rockX) ** 2 + (y - rockY) ** 2 < reach * reach;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHIP_HALF_WIDTH = 18;
const SHOT_RADIUS = 4;
const ROCK_RADIUS = 22;

/** Where each rock falls, as a share of the width, in turn. */
const LANES: readonly number[] = [0.4, 0.5, 0.65, 0.3, 0.5, 0.75, 0.2];
