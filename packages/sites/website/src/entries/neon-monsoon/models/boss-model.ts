import { ARENA_WIDTH, type BossAttackDef, type BossAttackKind, type BulletKind } from '../data';
import type { BulletField } from './bullet-field';
import type { Point } from './common';
import { createEmitterModel, type EmitterModel } from './emitter-model';
import {
    BOSS_BREAK_MS,
    BOSS_ENTER_MS,
    BOSS_EXPLODE_MS,
    BOSS_HOLD_Y,
    BOSS_RADIUS,
    BOSS_START_Y,
} from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Stormcore, the stage's boss: a run of attacks, each with its own
 * health and time limit.
 *
 * - `'absent'`: not in the stage yet.
 * - `'entering'`: flying in; it cannot be hurt.
 * - `'attacking'`: firing the current attack's patterns.
 * - `'breaking'`: an attack has ended, by damage or by time; a pause before the next.
 * - `'exploding'`: the last attack is over.
 * - `'defeated'`: gone, until the next loop.
 */
export type BossPhase = 'absent' | 'entering' | 'attacking' | 'breaking' | 'exploding' | 'defeated';

/** How the last attack ended: its health ran out, or its time did. */
export type AttackOutcome = 'broken' | 'timed-out';

export interface BossModel {
    readonly phase: BossPhase;
    /** Position in world-units, at the centre of the hull. */
    readonly x: number;
    readonly y: number;
    /** Hit radius in world-units. */
    readonly radius: number;
    /** Can be hit by shots and bombs. */
    readonly isVulnerable: boolean;
    /** Which attack it is on, from 0. */
    readonly attackIndex: number;
    readonly attackCount: number;
    readonly attackKind: BossAttackKind;
    /** The current attack's health, from 1 down to 0. */
    readonly healthFraction: number;
    readonly attackTimeLeftMs: number;
    /** Milliseconds since it last took damage; Infinity if it never has. */
    readonly msSinceHit: number;
    /** How the last attack to end ended, or undefined before any has. */
    readonly lastOutcome: AttackOutcome | undefined;
    /** Milliseconds spent in the current phase. */
    readonly phaseMs: number;
    /** Fly in and start attacking, at the given loop's difficulty. */
    arrive: (difficulty: { readonly speedScale: number; readonly densityScale: number }) => void;
    /** Lose `amount` of the current attack's health. Ignored unless attacking: it cannot be hurt while entering or between attacks. */
    takeDamage: (amount: number) => void;
    /** Back to absent, for the next loop. */
    reset: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BossModelOptions {
    readonly attacks: readonly BossAttackDef[];
    readonly bullets: BulletField<BulletKind>;
    /** The ship, which aimed patterns aim at. */
    readonly target: Point;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBossModel(options: BossModelOptions): BossModel {
    const { attacks, bullets, target } = options;

    let phase: BossPhase = 'absent';
    let phaseMs = 0;
    let x = CENTRE_X;
    let y = BOSS_START_Y;
    let attackIndex = 0;
    let health = 0;
    let attackTimeLeftMs = 0;
    let msSinceHit = Infinity;
    let lastOutcome: AttackOutcome | undefined;
    let speedScale = 1;
    let densityScale = 1;
    let emitters: EmitterModel[] = [];

    const model: BossModel = {
        get phase() {
            return phase;
        },
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        radius: BOSS_RADIUS,
        get isVulnerable() {
            return phase === 'attacking';
        },
        get attackIndex() {
            return attackIndex;
        },
        attackCount: attacks.length,
        get attackKind() {
            return currentAttack().kind;
        },
        get healthFraction() {
            return phase === 'attacking' ? health / currentAttack().health : 0;
        },
        get attackTimeLeftMs() {
            return attackTimeLeftMs;
        },
        get msSinceHit() {
            return msSinceHit;
        },
        get lastOutcome() {
            return lastOutcome;
        },
        get phaseMs() {
            return phaseMs;
        },

        arrive(difficulty) {
            speedScale = difficulty.speedScale;
            densityScale = difficulty.densityScale;
            attackIndex = 0;
            lastOutcome = undefined;
            x = CENTRE_X;
            y = BOSS_START_Y;
            enterPhase('entering');
        },

        takeDamage(amount) {
            if (phase !== 'attacking' || amount <= 0) return;
            health = Math.max(0, health - amount);
            msSinceHit = 0;
        },

        reset() {
            emitters = [];
            enterPhase('absent');
        },

        update(deltaMs) {
            phaseMs += deltaMs;
            msSinceHit += deltaMs;
            switch (phase) {
                case 'entering':
                    y = BOSS_START_Y + (BOSS_HOLD_Y - BOSS_START_Y) * Math.min(1, phaseMs / BOSS_ENTER_MS);
                    if (phaseMs >= BOSS_ENTER_MS) startAttack(0);
                    break;
                case 'attacking':
                    attack(deltaMs);
                    break;
                case 'breaking':
                    if (phaseMs >= BOSS_BREAK_MS) startAttack(attackIndex + 1);
                    break;
                case 'exploding':
                    if (phaseMs >= BOSS_EXPLODE_MS) enterPhase('defeated');
                    break;
                case 'absent':
                case 'defeated':
                    break;
            }
        },
    };

    return model;

    // ---- Attacks -----------------------------------------------------------

    function startAttack(index: number): void {
        attackIndex = index;
        const def = currentAttack();
        health = def.health;
        attackTimeLeftMs = def.timeLimitMs;
        emitters = [];
        for (let i = 0; i < def.patterns.length; i++) {
            emitters.push(createEmitterModel({ pattern: def.patterns[i], bullets, origin: model, target, speedScale, densityScale }));
        }
        enterPhase('attacking');
    }

    function attack(deltaMs: number): void {
        const def = currentAttack();
        x = CENTRE_X + Math.sin((phaseMs / def.swayPeriodMs) * Math.PI * 2) * def.swayX;
        for (let i = 0; i < emitters.length; i++) emitters[i].update(deltaMs);

        attackTimeLeftMs = Math.max(0, attackTimeLeftMs - deltaMs);
        if (health === 0) endAttack('broken');
        else if (attackTimeLeftMs === 0) endAttack('timed-out');
    }

    function endAttack(outcome: AttackOutcome): void {
        lastOutcome = outcome;
        emitters = [];
        enterPhase(attackIndex === attacks.length - 1 ? 'exploding' : 'breaking');
    }

    // ---- Helpers -----------------------------------------------------------

    function enterPhase(next: BossPhase): void {
        phase = next;
        phaseMs = 0;
    }

    function currentAttack(): BossAttackDef {
        return attacks[attackIndex];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CENTRE_X = ARENA_WIDTH / 2;
