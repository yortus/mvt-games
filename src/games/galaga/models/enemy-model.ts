import gsap from 'gsap';
import type { EnemyKind, EnemyPhase } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EnemyModel {
    /** Visual x position in pixels. */
    readonly x: number;
    /** Visual y position in pixels. */
    readonly y: number;
    readonly kind: EnemyKind;
    readonly phase: EnemyPhase;
    readonly alive: boolean;
    readonly formationRow: number;
    readonly formationCol: number;
    /** True when the enemy wants to fire during a dive (polled by game model). */
    readonly wantsToFire: boolean;
    /** Clear the fire request after the game model has handled it. */
    consumeFire(): void;
    /** Begin a dive toward targetX, curving in curveDir direction (-1 or 1). */
    startDive(targetX: number, curveDir: number): void;
    /** Destroy the enemy. */
    kill(): void;
    update(deltaMs: number): void;
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
}

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
        get alive() {
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
            const curveX = fromX + curveDir * 50;
            const midY = fromY + 100;

            const d1 = 0.4 / diveSpeedFactor;
            const d2 = 0.6 / diveSpeedFactor;
            const d3 = 0.5;

            diveTimeline.clear().time(0);

            let t = 0;
            // Phase 1 - curve to one side
            diveTimeline.to(state, { x: curveX, y: midY, duration: d1, ease: 'power1.in' }, t);
            t += d1;

            // Phase 2 - dive toward player, exit bottom
            diveTimeline.to(state, { x: targetX, y: playHeight + 30, duration: d2, ease: 'none' }, t);

            // Maybe fire during the dive
            if (Math.random() < fireChance) {
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
                return;
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
