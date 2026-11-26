import gsap from 'gsap';
import type { Random } from '@mvtjs/site-kit/random';
import type { EnemyKind, EnemyPhase } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EnemyModel {
    /** Visual x position in world-units. */
    readonly x: number;
    /** Visual y position in world-units. */
    readonly y: number;
    readonly kind: EnemyKind;
    readonly phase: EnemyPhase;
    readonly isAlive: boolean;
    readonly formationRow: number;
    readonly formationCol: number;
    /** True when the enemy wants to fire during a dive (polled by game model). */
    readonly wantsToFire: boolean;
    /** Clear the fire request after the game model has handled it. */
    consumeFire: () => void;
    /** Begin a dive toward targetX, curving in curveDir direction (-1 or 1). */
    startDive: (targetX: number, curveDir: number) => void;
    /** Destroy the enemy. */
    kill: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EnemyModelOptions {
    readonly slotX: number;
    readonly slotY: number;
    readonly formationRow: number;
    readonly formationCol: number;
    readonly kind: EnemyKind;
    /** Seconds to wait before the enemy appears. */
    readonly enterDelay: number;
    /** Multiplier for dive speed (higher = faster). */
    readonly diveSpeedFactor: number;
    /** Probability of firing during a dive (0–1). */
    readonly fireChance: number;
    /** Height of the play area (for off-screen detection). */
    readonly playHeight: number;
    readonly getFormationOffsetX: () => number;
    readonly getFormationOffsetY: () => number;
    /** How the raider dives, read as each dive starts, so a change takes effect on the next dive. */
    readonly tuning: EnemyTuning;
    /** Decides whether a dive fires. The game's own, so a game with the same seed plays the same way. */
    readonly random: Random;
}

/** How a raider dives, as `ENEMY_TUNING` sets it out. */
export type EnemyTuning = Readonly<typeof ENEMY_TUNING>;

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/** How the raiders dive in Galaxy Raiders, which the game passes as each raider's `tuning`. Distances are in world units. */
export const ENEMY_TUNING = {
    /** How far a diving raider swings out to one side before it strikes. */
    diveSwingWidth: 50,
    /** How far a diving raider drops while it swings out. */
    diveSwingDrop: 100,
    /** How long the swing lasts, at a wave's dive speed of 1. */
    diveSwingMs: 400,
    /** How long the strike down past the ship lasts, at a wave's dive speed of 1. */
    diveStrikeMs: 600,
    /** How long a raider flies to get back down into its slot, after it leaves the bottom. */
    diveReturnMs: 500,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEnemyModel(options: EnemyModelOptions): EnemyModel {
    const {
        slotX,
        slotY,
        formationRow,
        formationCol,
        kind,
        enterDelay,
        diveSpeedFactor,
        fireChance,
        playHeight,
        getFormationOffsetX,
        getFormationOffsetY,
        tuning,
        random,
    } = options;

    const state: {
        x: number;
        y: number;
        phase: EnemyPhase;
        alive: boolean;
        wantsToFire: boolean;
        enterTimer: number;
    } = {
        x: slotX,
        y: -30,
        phase: 'entering',
        alive: true,
        wantsToFire: false,
        enterTimer: enterDelay,
    };

    const diveTimeline = gsap.timeline({ paused: true });

    // ---- Public record -----------------------------------------------------

    const model: EnemyModel = {
        get x() {
            return state.x;
        },
        get y() {
            return state.y;
        },
        get kind() {
            return kind;
        },
        get phase() {
            return state.phase;
        },
        get isAlive() {
            return state.alive;
        },
        get formationRow() {
            return formationRow;
        },
        get formationCol() {
            return formationCol;
        },
        get wantsToFire() {
            return state.wantsToFire;
        },

        consumeFire(): void {
            state.wantsToFire = false;
        },

        startDive(targetX: number, curveDir: number): void {
            if (state.phase !== 'formation') return;
            state.phase = 'diving';
            state.wantsToFire = false;

            const fromX = state.x;
            const fromY = state.y;
            const curveX = fromX + curveDir * tuning.diveSwingWidth;
            const midY = fromY + tuning.diveSwingDrop;

            const d1 = tuning.diveSwingMs * 0.001 / diveSpeedFactor;
            const d2 = tuning.diveStrikeMs * 0.001 / diveSpeedFactor;
            const d3 = tuning.diveReturnMs * 0.001;

            diveTimeline.clear().time(0);

            let t = 0;
            // Phase 1 - curve to one side
            diveTimeline.to(state, { x: curveX, y: midY, duration: d1, ease: 'power1.in' }, t);
            t += d1;

            // Phase 2 - dive toward player, exit bottom
            diveTimeline.to(state, { x: targetX, y: playHeight + 30, duration: d2, ease: 'none' }, t);

            // Maybe fire during the dive
            if (random.next() < fireChance) {
                diveTimeline.call(
                    () => {
                        state.wantsToFire = true;
                    },
                    undefined,
                    t + d2 * 0.4,
                );
            }
            t += d2;

            // Phase 3 - teleport above screen
            diveTimeline.set(state, { x: slotX, y: -20 }, t);

            // Phase 4 - return to formation slot
            diveTimeline.to(state, { y: slotY, duration: d3, ease: 'power2.out' }, t);
            t += d3;

            // Done - back in formation
            diveTimeline.call(
                () => {
                    state.phase = 'formation';
                },
                undefined,
                t,
            );
        },

        kill(): void {
            state.alive = false;
            state.phase = 'dead';
            diveTimeline.clear();
        },

        update(deltaMs: number): void {
            if (!state.alive) return;

            if (state.phase === 'entering') {
                state.enterTimer -= deltaMs * 0.001;
                if (state.enterTimer <= 0) {
                    state.phase = 'formation';
                }
                else {
                    return;
                }
            }

            if (state.phase === 'formation') {
                state.x = slotX + getFormationOffsetX();
                state.y = slotY + getFormationOffsetY();
                return;
            }

            if (state.phase === 'diving') {
                diveTimeline.time(diveTimeline.time() + 0.001 * deltaMs);
            }
        },
    };

    return model;
}
