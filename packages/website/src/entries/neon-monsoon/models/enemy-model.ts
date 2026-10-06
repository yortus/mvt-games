import { ARENA_HEIGHT, ARENA_WIDTH, type BulletKind, type EnemyKind, type ItemKind, type PathDef, type PatternDef } from '../data';
import type { BulletField } from './bullet-field';
import type { Point } from './common';
import { createEmitterModel, type EmitterModel } from './emitter-model';
import { ENEMY_HEALTH, ENEMY_LEAVE_MARGIN, ENEMY_RADII } from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One enemy: where it is, how much health it has left, and the patterns it
 * fires. It flies its path and fires its emitters by itself; the game model
 * damages it, and removes it once it is dead or has left.
 */
export interface EnemyModel {
    readonly kind: EnemyKind;
    /** Position in world-units. */
    readonly x: number;
    readonly y: number;
    /** Hit radius in world-units. */
    readonly radius: number;
    readonly health: number;
    readonly isAlive: boolean;
    /** Milliseconds since it last took damage; Infinity if it never has. */
    readonly msSinceHit: number;
    /** On the city, not in the air: it scrolls with the ground, and the ship flies over it. */
    readonly isGrounded: boolean;
    /** Inside the arena, where it fires and can be shot. */
    readonly isOnScreen: boolean;
    /** True once it has flown off the arena after being on it. */
    readonly hasLeft: boolean;
    /** What it leaves behind when killed. */
    readonly drop: ItemKind | undefined;
    /** Lose `amount` health. At none left it is dead, and fires its death volleys, once. */
    takeDamage: (amount: number) => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EnemyModelOptions {
    readonly kind: EnemyKind;
    readonly x: number;
    readonly y: number;
    readonly path: PathDef;
    readonly patterns: readonly PatternDef[];
    /** Fired once, as a single volley each, when the enemy is killed. */
    readonly deathPatterns?: readonly PatternDef[];
    readonly drop?: ItemKind;
    readonly bullets: BulletField<BulletKind>;
    /** The ship: what aimed patterns and dives aim at. */
    readonly target: Point;
    /** How fast the city is scrolling, for enemies on the ground. Read every step. */
    readonly ground: { readonly scrollSpeed: number };
    readonly speedScale?: number;
    readonly densityScale?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEnemyModel(options: EnemyModelOptions): EnemyModel {
    const { kind, path, bullets, target, ground, speedScale, densityScale } = options;
    const radius = ENEMY_RADII[kind];

    let x = options.x;
    let y = options.y;
    let health = ENEMY_HEALTH[kind];
    let msSinceHit = Infinity;
    let ageMs = 0;
    let hasEntered = false;
    let hasLeft = false;

    // Where the path is, for paths that arrive, hold and leave.
    let pathPhase: PathPhase = 'arriving';
    let holdMs = 0;
    let heading = path.kind === 'straight' ? (path.angleDeg ?? 90) * DEG_TO_RAD : DOWN;
    let speed = path.kind === 'ground' ? 0 : path.speed;
    const anchorX = x;

    const model: EnemyModel = {
        kind,
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        radius,
        get health() {
            return health;
        },
        get isAlive() {
            return health > 0;
        },
        get msSinceHit() {
            return msSinceHit;
        },
        isGrounded: path.kind === 'ground',
        get isOnScreen() {
            return isInside(0);
        },
        get hasLeft() {
            return hasLeft;
        },
        drop: options.drop,

        takeDamage(amount) {
            if (health <= 0 || amount <= 0) return;
            health = Math.max(0, health - amount);
            msSinceHit = 0;
            if (health === 0) fireDeathVolleys();
        },

        update(deltaMs) {
            ageMs += deltaMs;
            msSinceHit += deltaMs;
            followPath(deltaMs);

            const isOnScreen = isInside(0);
            if (isOnScreen) hasEntered = true;
            else if (hasEntered && !isInside(ENEMY_LEAVE_MARGIN)) hasLeft = true;

            if (health > 0 && isOnScreen) {
                for (let i = 0; i < emitters.length; i++) emitters[i].update(deltaMs);
            }
        },
    };

    // Built once the record exists, since they fire from wherever it is.
    const emitters = buildEmitters(options.patterns);

    return model;

    // ---- Construction ------------------------------------------------------

    function buildEmitters(patterns: readonly PatternDef[]): EmitterModel[] {
        const built: EmitterModel[] = [];
        for (let i = 0; i < patterns.length; i++) {
            built.push(createEmitterModel({ pattern: patterns[i], bullets, origin: model, target, speedScale, densityScale }));
        }
        return built;
    }

    function fireDeathVolleys(): void {
        const deathPatterns = options.deathPatterns ?? [];
        for (let i = 0; i < deathPatterns.length; i++) {
            createEmitterModel({ pattern: deathPatterns[i], bullets, origin: model, target, speedScale }).fireVolley();
        }
    }

    // ---- Paths -------------------------------------------------------------

    function followPath(deltaMs: number): void {
        const dt = deltaMs * 0.001;
        switch (path.kind) {
            case 'straight':
                break;
            case 'swoop': {
                // Turn for the part of this step that falls inside the turn.
                const turnStart = path.turnAfterMs;
                const turningMs = overlapMs(ageMs - deltaMs, ageMs, turnStart, turnStart + path.turnMs);
                heading += path.turnDegPerSec * DEG_TO_RAD * turningMs * 0.001;
                break;
            }
            case 'ground':
                y += ground.scrollSpeed * dt;
                return;
            case 'hover':
            case 'dive':
            case 'strafe':
                arriveHoldAndLeave(path, deltaMs);
                if (pathPhase === 'holding') return;
                break;
        }
        x += Math.cos(heading) * speed * dt;
        y += Math.sin(heading) * speed * dt;
    }

    /** Fly down to the path's `stopY`, hold there, then leave. */
    function arriveHoldAndLeave(holdingPath: HoldingPath, deltaMs: number): void {
        if (pathPhase === 'arriving' && y >= holdingPath.stopY) {
            y = holdingPath.stopY;
            pathPhase = 'holding';
            holdMs = 0;
        }
        if (pathPhase !== 'holding') return;

        holdMs += deltaMs;
        if (holdingPath.kind === 'strafe') {
            x = anchorX + Math.sin((holdMs / holdingPath.swayPeriodMs) * Math.PI * 2) * holdingPath.swayX;
        }
        if (holdMs < holdingPath.holdMs) return;

        pathPhase = 'leaving';
        if (holdingPath.kind === 'dive') {
            heading = Math.atan2(target.y - y, target.x - x);
            speed = holdingPath.diveSpeed;
        }
        else {
            heading = UP;
        }
    }

    function isInside(margin: number): boolean {
        return x >= -margin && x <= ARENA_WIDTH + margin && y >= -margin && y <= ARENA_HEIGHT + margin;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type PathPhase = 'arriving' | 'holding' | 'leaving';

type HoldingPath = Extract<PathDef, { readonly stopY: number }>;

const DEG_TO_RAD = Math.PI / 180;
const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;

/** How much of the span from `from` to `to` lies between `start` and `end`. */
function overlapMs(from: number, to: number, start: number, end: number): number {
    return Math.max(0, Math.min(to, end) - Math.max(from, start));
}
