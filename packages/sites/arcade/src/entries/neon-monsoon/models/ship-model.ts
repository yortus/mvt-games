import { ARENA_HEIGHT, ARENA_WIDTH } from '../data';
import type { BulletField } from './bullet-field';
import type { ShotKind, XDirection, YDirection } from './common';
import {
    FOCUSED_SHOT_SPACING,
    FOCUSED_SHOT_SPEED,
    MAX_POWER,
    SHIP_EDGE_MARGIN,
    SHIP_FOCUSED_SPEED,
    SHIP_HIT_RADIUS,
    SHIP_SPEED,
    SHIP_START_Y,
    SHIP_TARGET_SPEED_SCALE,
    SHOT_INTERVAL_MS,
    SHOT_SPEED,
    SHOT_SPREAD_DEG,
} from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The player's interceptor. It flies as the game tells it, and fires on its own
 * while alive: a wide spread normally, a narrow column while focused.
 */
export interface ShipModel {
    /** Position in world-units, at the cockpit. */
    readonly x: number;
    readonly y: number;
    /** The hitbox's radius: far smaller than the sprite. */
    readonly hitRadius: number;
    /** How far the ship can fly across and up or down the arena. */
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
    readonly isAlive: boolean;
    /** Flying slowly, with the hitbox shown and the narrow column firing: alive, with the player focusing. */
    readonly isFocused: boolean;
    /** From 1 to `MAX_POWER`: how many streams the ship fires. */
    readonly power: number;
    readonly isInvulnerable: boolean;
    readonly invulnerableMs: number;
    /**
     * Sets the way the ship flies, across and up or down the arena. `'none'`
     * on both holds it still. A diagonal is no faster than a straight line.
     */
    setHeading: (x: XDirection, y: YDirection) => void;
    /**
     * Sets where the ship flies to, in a straight line, rather than the way
     * it is headed, or undefined for none. It flies there faster than it
     * flies the way it is headed, by `SHIP_TARGET_SPEED_SCALE`, and stops.
     */
    setTarget: (x: number | undefined, y: number | undefined) => void;
    /** Sets whether the player is focusing, which makes the ship `isFocused` while it is alive. */
    setFocusing: (isFocusing: boolean) => void;
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
    /** Where the ship's shots go. */
    readonly shots: BulletField<ShotKind>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipModel(options: ShipModelOptions): ShipModel {
    const { shots } = options;

    let x = START_X;
    let y = SHIP_START_Y;
    let isAlive = true;
    let power = 1;
    let invulnerableMs = 0;
    let untilShotMs = 0;
    let headingX: XDirection = 'none';
    let headingY: YDirection = 'none';
    let targetX: number | undefined;
    let targetY: number | undefined;
    let isFocusing = false;

    const model: ShipModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        hitRadius: SHIP_HIT_RADIUS,
        minX: MIN_X,
        maxX: MAX_X,
        minY: MIN_Y,
        maxY: MAX_Y,
        get isAlive() {
            return isAlive;
        },
        get isFocused() {
            return isAlive && isFocusing;
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

        setHeading(x, y) {
            headingX = x;
            headingY = y;
        },

        setTarget(toX, toY) {
            targetX = toX;
            targetY = toY;
        },

        setFocusing(focusing) {
            isFocusing = focusing;
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
        const speed = model.isFocused ? SHIP_FOCUSED_SPEED : SHIP_SPEED;
        const step = speed * deltaMs * 0.001;
        if (targetX !== undefined && targetY !== undefined) {
            moveToTarget(targetX, targetY, step * SHIP_TARGET_SPEED_SCALE);
            return;
        }

        const dx = headingX === 'left' ? -1 : headingX === 'right' ? 1 : 0;
        const dy = headingY === 'up' ? -1 : headingY === 'down' ? 1 : 0;
        if (dx === 0 && dy === 0) return;

        // Diagonals are no faster than straight lines.
        const scale = (dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1) * step;
        x = clamp(x + dx * scale, MIN_X, MAX_X);
        y = clamp(y + dy * scale, MIN_Y, MAX_Y);
    }

    /** Flies straight toward (`toX`, `toY`), as far as `step` goes, stopping there. */
    function moveToTarget(toX: number, toY: number, step: number): void {
        const dx = clamp(toX, MIN_X, MAX_X) - x;
        const dy = clamp(toY, MIN_Y, MAX_Y) - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const share = distance <= step ? 1 : step / distance;
        x += dx * share;
        y += dy * share;
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
const MIN_X = SHIP_EDGE_MARGIN;
const MAX_X = ARENA_WIDTH - SHIP_EDGE_MARGIN;
const MIN_Y = SHIP_EDGE_MARGIN;
const MAX_Y = ARENA_HEIGHT - SHIP_EDGE_MARGIN;
const DEG_TO_RAD = Math.PI / 180;
const UP = -Math.PI / 2;
/** Shots leave from the ship's nose, ahead of its centre. */
const NOSE_OFFSET = 8;
const SPREAD_MOTION = { speed: SHOT_SPEED };
const COLUMN_MOTION = { speed: FOCUSED_SHOT_SPEED };

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
