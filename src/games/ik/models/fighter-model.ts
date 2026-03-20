import gsap from 'gsap';
import {
    type DefeatVariant,
    type Facing,
    type FighterMove,
    type FighterPhase,
    type MoveKind,
    MOVE_DATA,
    WALK_SPEED,
    WALK_CYCLE_METRES,
    JUMP_HEIGHT,
    HIT_REACTION_MS,
    BLOCK_REACTION_MS,
    FIGHTER_BODY_WIDTH,
    TURN_TOTAL_MS,
    DEFEAT_TOTAL_MS,
    WON_TOTAL_MS,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Simulates a single fighter's state: position, phase, active move, and
 * collision boxes. All distances are in **metres** (the arena is 10 m wide).
 *
 * The model knows nothing about textures or animation frames. It exposes
 * `phase` and `progress` (0..1) so the view can derive which visual frame
 * to display.
 */
export interface FighterModel {
    /** Horizontal position in metres. */
    readonly x: number;
    /** Vertical offset above ground in metres (0 = grounded). */
    readonly height: number;
    /** Which direction the fighter faces. */
    readonly facing: Facing;
    /** Current high-level phase. */
    readonly phase: FighterPhase;
    /** Active move kind (undefined when idle, walking, turning, or reacting). */
    readonly move: MoveKind | undefined;
    /**
     * Progress through the current phase, 0..1.
     * - Idle / lost: always 0.
     * - Walking: cycles 0..1 based on distance covered per walk cycle.
     * - Attacks / airborne / turning / blocking / reactions / won / defeated:
     *   0 at phase start, 1 at phase end.
     */
    readonly progress: number;
    /** Whether the move's hitbox is currently active. */
    readonly hitboxActive: boolean;
    /** World-space hitbox rectangle in metres (zeroed when inactive). */
    readonly hitbox: { x: number; y: number; w: number; h: number };
    /** World-space body box in metres (always valid; used for receiving hits). */
    readonly bodyBox: { x: number; y: number; w: number; h: number };
    /** The defeat variant (only meaningful in 'defeated' phase). */
    readonly defeatVariant: DefeatVariant;
    /** Whether this fighter is facing the given x position. */
    isFacing(targetX: number): boolean;
    /**
     * Attempt a voluntary move. Returns true if the model accepted it.
     * Moves are rejected while an attack, reaction, or other non-interruptible
     * phase is in progress. The same move is rejected (held) after completion.
     */
    tryMove(move: FighterMove): boolean;
    /** External: take a hit with the given knockback in metres. */
    hit(knockbackMetres: number): void;
    /** External: passively block an incoming attack. */
    block(): void;
    /** External: play a defeat animation. */
    defeat(variant: DefeatVariant): void;
    /** External: play the round-won pose. */
    won(): void;
    /** External: play the round-lost pose. */
    lost(): void;
    /** Reset to starting position and idle state. */
    reset(startX: number, facing: Facing): void;
    /** Advance state by deltaMs. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FighterModelOptions {
    /** Starting x position in metres. */
    startX: number;
    startFacing: Facing;
    /** Left arena boundary in metres. */
    arenaMinX: number;
    /** Right arena boundary in metres. */
    arenaMaxX: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fighter body height in metres (for bodyBox). */
const BODY_HEIGHT = 1.5;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFighterModel(options: FighterModelOptions): FighterModel {
    const { arenaMinX, arenaMaxX } = options;

    // --- Private mutable state ---
    const state = {
        x: options.startX,
        height: 0,
        facing: options.startFacing as Facing,
        phase: 'idle' as FighterPhase,
        move: undefined as MoveKind | undefined,
        hitboxActive: false,
        defeatVariant: 'a' as DefeatVariant,
        walkDirection: 0, // +1 forward, -1 backward, 0 none
        walkDistAccum: 0, // accumulated walk distance for progress cycling
        moveComplete: false, // true when attack anim finished but input held
        // Phase progress tracking (independent of GSAP timeline)
        phaseElapsedMs: 0, // ms elapsed since current phase started
        phaseDurationMs: 0, // total duration of current phase in ms
    };

    // Pre-allocated hitbox and bodyBox objects (avoid per-tick allocation)
    const hitboxRect = { x: 0, y: 0, w: 0, h: 0 };
    const bodyBoxRect = { x: 0, y: 0, w: 0, h: 0 };

    // GSAP timeline for sequenced moves (tweens + phase transition callbacks)
    const timeline = gsap.timeline({ paused: true });

    // --- Public model record ---
    const model: FighterModel = {
        get x() {
            return state.x;
        },
        get height() {
            return state.height;
        },
        get facing() {
            return state.facing;
        },
        get phase() {
            return state.phase;
        },
        get move() {
            return state.move;
        },
        get defeatVariant() {
            return state.defeatVariant;
        },

        get progress() {
            if (state.phase === 'walking') {
                return state.walkDistAccum / WALK_CYCLE_METRES;
            }
            if (state.phaseDurationMs <= 0) return 0;
            const p = state.phaseElapsedMs / state.phaseDurationMs;
            return p < 0 ? 0 : p > 1 ? 1 : p;
        },

        get hitboxActive() {
            return state.hitboxActive;
        },

        get hitbox() {
            if (!state.hitboxActive || !state.move) {
                hitboxRect.x = 0;
                hitboxRect.y = 0;
                hitboxRect.w = 0;
                hitboxRect.h = 0;
                return hitboxRect;
            }
            const md = MOVE_DATA[state.move];
            const sign = state.facing === 'right' ? 1 : -1;
            hitboxRect.x = state.x + md.hitbox.dx * sign - md.hitbox.w * 0.5;
            hitboxRect.y = state.height + md.hitbox.dy - md.hitbox.h * 0.5;
            hitboxRect.w = md.hitbox.w;
            hitboxRect.h = md.hitbox.h;
            return hitboxRect;
        },

        get bodyBox() {
            bodyBoxRect.x = state.x - FIGHTER_BODY_WIDTH * 0.5;
            bodyBoxRect.y = state.height;
            bodyBoxRect.w = FIGHTER_BODY_WIDTH;
            bodyBoxRect.h = BODY_HEIGHT;
            return bodyBoxRect;
        },

        isFacing(targetX: number): boolean {
            if (state.facing === 'right') return targetX >= state.x;
            return targetX <= state.x;
        },

        tryMove(move: FighterMove): boolean {
            const canAccept = state.phase === 'idle' || state.phase === 'walking' || state.moveComplete;
            if (!canAccept) return false;

            // When holding at end of a completed move, reject the same move (hold)
            if (state.moveComplete) {
                if (move === state.move) return false;
                enterIdle();
            }

            if (move === 'idle') {
                if (state.phase !== 'idle') enterIdle();
                return true;
            }

            if (move === 'walk-forward') {
                if (state.phase === 'walking' && state.walkDirection === 1) return true;
                enterWalk(1);
                return true;
            }

            if (move === 'walk-backward') {
                if (state.phase === 'walking' && state.walkDirection === -1) return true;
                enterWalk(-1);
                return true;
            }

            // Remaining values are MoveKind
            const moveData = MOVE_DATA[move];
            if (moveData.autoTurn) {
                scheduleAutoTurnAttack(move);
            }
            else {
                scheduleAttack(move);
            }
            return true;
        },

        hit(knockbackMetres: number): void {
            scheduleHitReaction(knockbackMetres);
        },

        block(): void {
            scheduleBlock();
        },

        defeat(variant: DefeatVariant): void {
            scheduleDefeat(variant);
        },

        won(): void {
            scheduleWon();
        },

        lost(): void {
            scheduleLost();
        },

        reset(startX: number, facing: Facing): void {
            timeline.clear().time(0);
            state.x = startX;
            state.height = 0;
            state.facing = facing;
            state.phase = 'idle';
            state.move = undefined;
            state.hitboxActive = false;
            state.defeatVariant = 'a';
            state.walkDirection = 0;
            state.walkDistAccum = 0;
            state.moveComplete = false;
            state.phaseElapsedMs = 0;
            state.phaseDurationMs = 0;
        },

        update(deltaMs: number): void {
            // 1. Accumulate phase elapsed time
            state.phaseElapsedMs += deltaMs;

            // 2. Advance timeline (triggers callbacks/tweens)
            const dt = deltaMs * 0.001;
            timeline.time(timeline.time() + dt);

            // 3. Handle walking position update (not timeline-driven)
            if (state.phase === 'walking') {
                const sign = state.facing === 'right' ? 1 : -1;
                const worldDir = sign * state.walkDirection;
                const dx = worldDir * WALK_SPEED * dt;
                state.x += dx;

                // Cycle walk distance accumulator
                const absDx = dx < 0 ? -dx : dx;
                state.walkDistAccum += absDx;
                if (state.walkDistAccum >= WALK_CYCLE_METRES) {
                    state.walkDistAccum -= WALK_CYCLE_METRES;
                }
            }

            // 4. Clamp position
            if (state.x < arenaMinX) state.x = arenaMinX;
            if (state.x > arenaMaxX) state.x = arenaMaxX;

            // 5. Derive hitbox active from progress + move data
            updateHitboxActive();
        },
    };

    return model;

    // -----------------------------------------------------------------------
    // Hitbox derivation
    // -----------------------------------------------------------------------

    function updateHitboxActive(): void {
        if (!state.move || (state.phase !== 'attacking' && state.phase !== 'airborne')) {
            state.hitboxActive = false;
            return;
        }
        if (state.moveComplete) {
            state.hitboxActive = false;
            return;
        }
        const md = MOVE_DATA[state.move];
        if (md.hitboxActiveFromMs === undefined || md.hitboxActiveToMs === undefined) {
            state.hitboxActive = false;
            return;
        }
        const elapsed = state.phaseElapsedMs;
        state.hitboxActive = elapsed >= md.hitboxActiveFromMs && elapsed < md.hitboxActiveToMs;
    }

    // -----------------------------------------------------------------------
    // Phase transitions
    // -----------------------------------------------------------------------

    function enterIdle(): void {
        timeline.clear().time(0);
        state.phase = 'idle';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.height = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = 0;
    }

    function enterWalk(direction: number): void {
        timeline.clear().time(0);
        state.phase = 'walking';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = direction;
        state.walkDistAccum = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = 0;
    }

    function scheduleAttack(moveKind: MoveKind): void {
        const moveData = MOVE_DATA[moveKind];
        const totalMs = moveData.durationMs;
        const totalSec = totalMs * 0.001;

        timeline.clear().time(0);
        state.phase = moveData.airborne ? 'airborne' : 'attacking';
        state.move = moveKind;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = totalMs;

        // Lunge tween
        if (moveData.lunge !== 0) {
            const sign = state.facing === 'right' ? 1 : -1;
            const targetX = state.x + moveData.lunge * sign;
            timeline.to(state, { x: targetX, duration: totalSec, ease: 'none' }, 0);
        }

        // Airborne arc
        if (moveData.airborne) {
            const halfDuration = totalSec * 0.5;
            timeline.to(state, { height: JUMP_HEIGHT, duration: halfDuration, ease: 'power1.out' }, 0);
            timeline.to(state, { height: 0, duration: halfDuration, ease: 'power1.in' }, halfDuration);
        }

        // End-of-move callback
        if (moveData.airborne) {
            timeline.call(enterIdle, undefined, totalSec);
        }
        else {
            timeline.call(setMoveComplete, undefined, totalSec);
        }
    }

    function scheduleAutoTurnAttack(moveKind: MoveKind): void {
        const turnSec = TURN_TOTAL_MS * 0.001;

        timeline.clear().time(0);
        state.phase = 'turning';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = TURN_TOTAL_MS;

        // Flip facing at end of turn
        timeline.call(flipFacing, undefined, turnSec);

        // Compute attack duration
        const moveData = MOVE_DATA[moveKind];
        const attackMs = moveData.durationMs;
        const attackSec = attackMs * 0.001;
        const endSec = turnSec + attackSec;

        // Transition to attack phase at the boundary
        timeline.call(transitionToAttack, [moveKind, moveData.airborne, attackMs], turnSec);

        // Lunge during attack portion
        if (moveData.lunge !== 0) {
            timeline.call(applyLunge, [moveKind, attackSec], turnSec);
        }

        // Airborne arc during attack portion
        if (moveData.airborne) {
            const halfDuration = attackSec * 0.5;
            timeline.to(state, { height: JUMP_HEIGHT, duration: halfDuration, ease: 'power1.out' }, turnSec);
            timeline.to(state, { height: 0, duration: halfDuration, ease: 'power1.in' }, turnSec + halfDuration);
        }

        // End of move
        if (moveData.airborne) {
            timeline.call(enterIdle, undefined, endSec);
        }
        else {
            timeline.call(setMoveComplete, undefined, endSec);
        }
    }

    function scheduleHitReaction(knockbackMetres: number): void {
        const totalSec = HIT_REACTION_MS * 0.001;

        timeline.clear().time(0);
        state.phase = 'hit-reacting';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.height = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = HIT_REACTION_MS;

        // Knockback pushes away from the attacker (opposite of facing)
        const sign = state.facing === 'right' ? -1 : 1;
        const targetX = state.x + knockbackMetres * sign;
        timeline.to(state, { x: targetX, duration: totalSec, ease: 'power2.out' }, 0);
        timeline.call(enterIdle, undefined, totalSec);
    }

    function scheduleBlock(): void {
        const totalSec = BLOCK_REACTION_MS * 0.001;

        timeline.clear().time(0);
        state.phase = 'blocking';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = BLOCK_REACTION_MS;

        timeline.call(enterIdle, undefined, totalSec);
    }

    function scheduleDefeat(variant: DefeatVariant): void {
        timeline.clear().time(0);
        state.phase = 'defeated';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.height = 0;
        state.defeatVariant = variant;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = DEFEAT_TOTAL_MS;
        // Remains in 'defeated' phase - does not auto-return
    }

    function scheduleWon(): void {
        timeline.clear().time(0);
        state.phase = 'won';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.height = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = WON_TOTAL_MS;
    }

    function scheduleLost(): void {
        timeline.clear().time(0);
        state.phase = 'lost';
        state.move = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.height = 0;
        state.moveComplete = false;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = 0;
        // Remains in 'lost' phase - single static pose
    }

    // -----------------------------------------------------------------------
    // Timeline callback helpers
    // -----------------------------------------------------------------------

    function flipFacing(): void {
        state.facing = state.facing === 'right' ? 'left' : 'right';
    }

    function setMoveComplete(): void {
        state.hitboxActive = false;
        state.moveComplete = true;
    }

    function transitionToAttack(moveKind: MoveKind, airborne: boolean, attackDurationMs: number): void {
        state.phase = airborne ? 'airborne' : 'attacking';
        state.move = moveKind;
        state.phaseElapsedMs = 0;
        state.phaseDurationMs = attackDurationMs;
    }

    function applyLunge(moveKind: MoveKind, attackDuration: number): void {
        const md = MOVE_DATA[moveKind];
        const sign = state.facing === 'right' ? 1 : -1;
        const targetX = state.x + md.lunge * sign;
        timeline.to(state, { x: targetX, duration: attackDuration, ease: 'none' }, timeline.time());
    }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
