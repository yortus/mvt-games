import { ARENA_HEIGHT, ARENA_WIDTH } from '../data';
import type { BulletField } from './bullet-field';
import type { ShotKind } from './common';
import {
    FOCUSED_SHOT_SPACING,
    FOCUSED_SHOT_SPEED,
    MAX_POWER,
    SHIP_EDGE_MARGIN,
    SHIP_FOCUSED_SPEED,
    SHIP_HIT_RADIUS,
    SHIP_SPEED,
    SHIP_START_Y,
    SHOT_INTERVAL_MS,
    SHOT_SPEED,
    SHOT_SPREAD_DEG,
} from './model-constants';
import type { PlayerInput } from './player-input';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The player's interceptor. It flies as the input says, and fires on its own
 * while alive: a wide spread normally, a narrow column while focused.
 */
export interface ShipModel {
    /** Position in world-units, at the cockpit. */
    readonly x: number;
    readonly y: number;
    /** The hitbox's radius: far smaller than the sprite. */
    readonly hitRadius: number;
    readonly isAlive: boolean;
    /** Flying slowly, with the hitbox shown and the narrow column firing. */
    readonly isFocused: boolean;
    /** From 1 to `MAX_POWER`: how many streams the ship fires. */
    readonly power: number;
    readonly isInvulnerable: boolean;
    readonly invulnerableMs: number;
    /** Raise the power by one; false if it was already at most. */
    powerUp: () => boolean;
    /** Make the ship immune to bullets for `durationMs`, as while a bomb goes off; never shortens a shield it has. */
    shieldFor: (durationMs: number) => void;
    /** The ship is hit and explodes: it loses a power level, and is not alive until `respawn`. */
    explode: () => void;
    respawn: (invulnerableMs: number) => void;
    /** Back to the start of a new game. */
    reset: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    readonly input: PlayerInput;
    /** Where the ship's shots go. */
    readonly shots: BulletField<ShotKind>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipModel(options: ShipModelOptions): ShipModel {
    const { input, shots } = options;

    let x = START_X;
    let y = SHIP_START_Y;
    let isAlive = true;
    let power = 1;
    let invulnerableMs = 0;
    let untilShotMs = 0;

    const model: ShipModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        hitRadius: SHIP_HIT_RADIUS,
        get isAlive() {
            return isAlive;
        },
        get isFocused() {
            return isAlive && input.focusPressed;
        },
        get power() {
            return power;
        },
        get isInvulnerable() {
            return invulnerableMs > 0;
        },
        get invulnerableMs() {
            return invulnerableMs;
        },

        powerUp() {
            if (power === MAX_POWER) return false;
            power++;
            return true;
        },

        shieldFor(durationMs) {
            invulnerableMs = Math.max(invulnerableMs, durationMs);
        },

        explode() {
            isAlive = false;
            power = Math.max(1, power - 1);
            invulnerableMs = 0;
        },

        respawn(respawnInvulnerableMs) {
            isAlive = true;
            x = START_X;
            y = SHIP_START_Y;
            invulnerableMs = respawnInvulnerableMs;
            untilShotMs = 0;
        },

        reset() {
            model.respawn(0);
            power = 1;
        },

        update(deltaMs) {
            if (!isAlive) return;
            invulnerableMs = Math.max(0, invulnerableMs - deltaMs);
            move(deltaMs);
            fireWhenDue(deltaMs);
        },
    };

    return model;

    function move(deltaMs: number): void {
        const dx = input.xDirection === 'left' ? -1 : input.xDirection === 'right' ? 1 : 0;
        const dy = input.yDirection === 'up' ? -1 : input.yDirection === 'down' ? 1 : 0;
        if (dx === 0 && dy === 0) return;

        // Diagonals are no faster than straight lines.
        const speed = model.isFocused ? SHIP_FOCUSED_SPEED : SHIP_SPEED;
        const scale = (dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1) * speed * deltaMs * 0.001;
        x = clamp(x + dx * scale, SHIP_EDGE_MARGIN, ARENA_WIDTH - SHIP_EDGE_MARGIN);
        y = clamp(y + dy * scale, SHIP_EDGE_MARGIN, ARENA_HEIGHT - SHIP_EDGE_MARGIN);
    }

    function fireWhenDue(deltaMs: number): void {
        untilShotMs -= deltaMs;
        while (untilShotMs <= 0) {
            if (model.isFocused) fireColumn();
            else fireSpread();
            untilShotMs += SHOT_INTERVAL_MS;
        }
    }

    /** Streams fanned out from the nose: 3 at power 1, up to 9 at full power. */
    function fireSpread(): void {
        const streams = 1 + power * 2;
        const step = SHOT_SPREAD_DEG * DEG_TO_RAD;
        for (let i = 0; i < streams; i++) {
            const angle = UP + (i - (streams - 1) / 2) * step;
            shots.fire(x, y - NOSE_OFFSET, angle, 'shot', SPREAD_MOTION);
        }
    }

    /** Parallel shots straight ahead: 2 at power 1, up to 5 at full power. */
    function fireColumn(): void {
        const columns = 1 + power;
        for (let i = 0; i < columns; i++) {
            const offset = (i - (columns - 1) / 2) * FOCUSED_SHOT_SPACING;
            shots.fire(x + offset, y - NOSE_OFFSET, UP, 'shot-focused', COLUMN_MOTION);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const START_X = ARENA_WIDTH / 2;
const DEG_TO_RAD = Math.PI / 180;
const UP = -Math.PI / 2;
/** Shots leave from the ship's nose, ahead of its centre. */
const NOSE_OFFSET = 8;
const SPREAD_MOTION = { speed: SHOT_SPEED };
const COLUMN_MOTION = { speed: FOCUSED_SHOT_SPEED };

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
