import gsap from 'gsap';
import {
    type DefeatVariant,
    type Facing,
    type FighterPhase,
    type InputDirection,
    type MoveKind,
    resolveMove,
    MOVE_DATA,
    MOVE_VARIANTS,
    CROUCH_PUNCH_FRAME_SEQUENCE,
    WALK_SPEED,
    JUMP_DURATION_MS,
    JUMP_HEIGHT,
    HIT_REACTION_MS,
    BLOCK_REACTION_MS,
    FIGHTER_BODY_WIDTH,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FighterModel {
    /** Horizontal position in world units. */
    readonly x: number;
    /** Vertical offset above ground in world units (0 = grounded). */
    readonly jumpHeight: number;
    /** Which direction the fighter faces. */
    readonly facing: Facing;
    /** Current high-level phase. */
    readonly phase: FighterPhase;
    /** Current move being executed (undefined when idle/walking). */
    readonly moveKind: MoveKind | undefined;
    /** Current frame index within the active animation sequence (0-based). */
    readonly frameIndex: number;
    /** Whether the move's hitbox is currently active this frame. */
    readonly hitboxActive: boolean;
    /** World-space hitbox rectangle (only meaningful when hitboxActive). */
    readonly hitbox: { x: number; y: number; w: number; h: number };
    /** World-space body box (always valid; used for receiving hits). */
    readonly bodyBox: { x: number; y: number; w: number; h: number };
    /** The defeat variant currently being played (only meaningful in 'defeated' phase). */
    readonly defeatVariant: DefeatVariant;
    /** Whether this fighter is facing the given x position. */
    isFacing(targetX: number): boolean;
    /** Apply a directional input + attack state. Called by game model each tick. */
    applyInput(inputDir: InputDirection, attackPressed: boolean): void;
    /** External command: take a hit with the given knockback direction. */
    applyHit(knockback: number): void;
    /** External command: passively block an incoming attack. */
    applyBlock(): void;
    /** External command: play a defeat animation. */
    applyDefeat(variant: DefeatVariant): void;
    /** External command: play the round-won pose. */
    applyWon(): void;
    /** External command: play the round-lost pose. */
    applyLost(): void;
    /** Reset to starting position and idle state. */
    reset(startX: number, facing: Facing): void;
    /** Advance timelines by deltaMs. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FighterModelOptions {
    startX: number;
    startFacing: Facing;
    arenaMinX: number;
    arenaMaxX: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TURN_FRAME_COUNT = 5;
const TURN_FRAME_MS = 80;
const BODY_HEIGHT = 1.5;
const WON_FRAME_TOGGLE_MS = 300;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFighterModel(options: FighterModelOptions): FighterModel {
    const { arenaMinX, arenaMaxX } = options;

    // --- Private mutable state ---
    const state = {
        x: options.startX,
        jumpHeight: 0,
        facing: options.startFacing as Facing,
        phase: 'idle' as FighterPhase,
        moveKind: undefined as MoveKind | undefined,
        frameIndex: 0,
        hitboxActive: false,
        defeatVariant: 'a' as DefeatVariant,
        walkDirection: 0, // +1 forward, -1 backward, 0 none
        walkDistAccum: 0, // accumulated walk distance for frame cycling
    };

    // Variant cycling indices (persist across moves, wrap around)
    let kickVariantIndex = 0;
    let punchVariantIndex = 0;

    // Pre-allocated hitbox and bodyBox objects (avoid per-tick allocation)
    const hitboxRect = { x: 0, y: 0, w: 0, h: 0 };
    const bodyBoxRect = { x: 0, y: 0, w: 0, h: 0 };

    // GSAP timeline for sequenced moves
    const timeline = gsap.timeline({ paused: true });

    // --- Public model record ---
    const model: FighterModel = {
        get x() { return state.x; },
        get jumpHeight() { return state.jumpHeight; },
        get facing() { return state.facing; },
        get phase() { return state.phase; },
        get moveKind() { return state.moveKind; },
        get frameIndex() { return state.frameIndex; },
        get hitboxActive() { return state.hitboxActive; },
        get defeatVariant() { return state.defeatVariant; },

        get hitbox() {
            if (!state.hitboxActive || state.moveKind === undefined) {
                hitboxRect.x = 0;
                hitboxRect.y = 0;
                hitboxRect.w = 0;
                hitboxRect.h = 0;
                return hitboxRect;
            }
            const md = MOVE_DATA[state.moveKind];
            const sign = state.facing === 'right' ? 1 : -1;
            hitboxRect.x = state.x + md.hitbox.dx * sign - md.hitbox.w * 0.5;
            hitboxRect.y = state.jumpHeight + md.hitbox.dy - md.hitbox.h * 0.5;
            hitboxRect.w = md.hitbox.w;
            hitboxRect.h = md.hitbox.h;
            return hitboxRect;
        },

        get bodyBox() {
            bodyBoxRect.x = state.x - FIGHTER_BODY_WIDTH * 0.5;
            bodyBoxRect.y = state.jumpHeight;
            bodyBoxRect.w = FIGHTER_BODY_WIDTH;
            bodyBoxRect.h = BODY_HEIGHT;
            return bodyBoxRect;
        },

        isFacing(targetX: number): boolean {
            if (state.facing === 'right') return targetX >= state.x;
            return targetX <= state.x;
        },

        applyInput(inputDir: InputDirection, attackPressed: boolean): void {
            // Only accept input when idle or walking
            if (state.phase !== 'idle' && state.phase !== 'walking') return;

            const resolution = resolveMove(inputDir, attackPressed);

            switch (resolution.action) {
                case 'idle':
                    if (state.phase !== 'idle') {
                        enterIdle();
                    }
                    break;

                case 'walk': {
                    const dir = resolution.direction === 'forward' ? 1 : -1;
                    if (state.phase !== 'walking' || state.walkDirection !== dir) {
                        enterWalk(dir);
                    }
                    break;
                }

                case 'jump':
                    scheduleJump();
                    break;

                case 'move': {
                    const moveData = MOVE_DATA[resolution.moveKind];
                    if (moveData.autoTurn) {
                        scheduleAutoTurnAttack(resolution.moveKind);
                    } else {
                        scheduleAttack(resolution.moveKind);
                    }
                    break;
                }
            }
        },

        applyHit(knockback: number): void {
            scheduleHitReaction(knockback);
        },

        applyBlock(): void {
            scheduleBlock();
        },

        applyDefeat(variant: DefeatVariant): void {
            scheduleDefeat(variant);
        },

        applyWon(): void {
            scheduleWon();
        },

        applyLost(): void {
            scheduleLost();
        },

        reset(startX: number, facing: Facing): void {
            timeline.clear().time(0);
            state.x = startX;
            state.jumpHeight = 0;
            state.facing = facing;
            state.phase = 'idle';
            state.moveKind = undefined;
            state.frameIndex = 0;
            state.hitboxActive = false;
            state.defeatVariant = 'a';
            state.walkDirection = 0;
            state.walkDistAccum = 0;
        },

        update(deltaMs: number): void {
            // 1. Advance timeline
            const dt = 0.001 * deltaMs;
            timeline.time(timeline.time() + dt);

            // 2. Handle walking position update (not timeline-driven)
            if (state.phase === 'walking') {
                const sign = state.facing === 'right' ? 1 : -1;
                const worldDir = sign * state.walkDirection;
                const dx = worldDir * WALK_SPEED * dt;
                state.x += dx;

                // Accumulate distance for frame cycling
                const absDx = dx < 0 ? -dx : dx;
                state.walkDistAccum += absDx;

                // Cycle walk frames based on distance (one full cycle per ~WALK_CYCLE_DIST)
                const WALK_CYCLE_DIST = 0.25; // world units per frame
                if (state.walkDistAccum >= WALK_CYCLE_DIST) {
                    state.walkDistAccum -= WALK_CYCLE_DIST;
                    state.frameIndex = (state.frameIndex + 1) % 8;
                }
            }

            // 3. Clamp position
            if (state.x < arenaMinX) state.x = arenaMinX;
            if (state.x > arenaMaxX) state.x = arenaMaxX;
        },
    };

    return model;

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    function enterIdle(): void {
        timeline.clear().time(0);
        state.phase = 'idle';
        state.moveKind = undefined;
        state.frameIndex = 0;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.jumpHeight = 0;
    }

    function enterWalk(direction: number): void {
        timeline.clear().time(0);
        state.phase = 'walking';
        state.moveKind = undefined;
        state.hitboxActive = false;
        state.walkDirection = direction;
        // Keep existing walk frame if already walking, otherwise start at 0
        if (state.phase !== 'walking') {
            state.frameIndex = 0;
            state.walkDistAccum = 0;
        }
    }

    function scheduleAttack(moveKind: MoveKind): void {
        const moveData = MOVE_DATA[moveKind];
        const frameSequence = resolveFrameSequence(moveKind);
        const frameCount = frameSequence.length;

        timeline.clear().time(0);
        state.phase = moveData.airborne ? 'airborne' : 'attacking';
        state.moveKind = moveKind;
        state.frameIndex = frameSequence[0];
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;

        // Build the timeline
        let t = 0;
        for (let i = 0; i < frameCount; i++) {
            const fi = frameSequence[i];
            const isHitFrame = isInHitFrames(moveData.hitFrameIndices, i);

            timeline.call(setFrameState, [fi, isHitFrame], t);
            t += moveData.frameDurationMs[i] * 0.001;
        }

        // Lunge: tween x forwards over the move duration
        if (moveData.lunge > 0) {
            const sign = state.facing === 'right' ? 1 : -1;
            const targetX = state.x + moveData.lunge * sign;
            timeline.to(state, { x: targetX, duration: t, ease: 'none' }, 0);
        }

        // Airborne arc: parabolic jump height
        if (moveData.airborne) {
            const halfDuration = t * 0.5;
            timeline.to(state, { jumpHeight: JUMP_HEIGHT, duration: halfDuration, ease: 'power1.out' }, 0);
            timeline.to(state, { jumpHeight: 0, duration: halfDuration, ease: 'power1.in' }, halfDuration);
        }

        // On completion: return to idle
        timeline.call(enterIdle, undefined, t);
    }

    function scheduleAutoTurnAttack(moveKind: MoveKind): void {
        timeline.clear().time(0);
        state.phase = 'turning';
        state.moveKind = undefined;
        state.frameIndex = 0;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;

        // Step through 5 turn frames
        let t = 0;
        for (let i = 0; i < TURN_FRAME_COUNT; i++) {
            timeline.call(setTurnFrame, [i], t);
            t += TURN_FRAME_MS * 0.001;
        }

        // Flip facing at the end of the turn
        timeline.call(flipFacing, undefined, t);

        // Then chain the attack sequence
        const moveData = MOVE_DATA[moveKind];
        const frameSequence = resolveFrameSequence(moveKind);
        const frameCount = frameSequence.length;

        const attackStart = t;
        for (let i = 0; i < frameCount; i++) {
            const fi = frameSequence[i];
            const isHitFrame = isInHitFrames(moveData.hitFrameIndices, i);

            timeline.call(setAttackFrame, [moveKind, fi, isHitFrame, moveData.airborne], t);
            t += moveData.frameDurationMs[i] * 0.001;
        }

        // Lunge during attack portion
        if (moveData.lunge > 0) {
            // Note: facing has been flipped by this point, so we need the NEW facing
            // We schedule a call to compute and apply the lunge at attackStart
            timeline.call(applyLunge, [moveKind, attackStart, t - attackStart], attackStart);
        }

        // On completion: return to idle
        timeline.call(enterIdle, undefined, t);
    }

    function scheduleJump(): void {
        timeline.clear().time(0);
        state.phase = 'airborne';
        state.moveKind = 'jump';
        state.frameIndex = 0;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;

        const halfDuration = JUMP_DURATION_MS * 0.001 * 0.5;
        timeline.to(state, { jumpHeight: JUMP_HEIGHT, duration: halfDuration, ease: 'power1.out' }, 0);
        timeline.to(state, { jumpHeight: 0, duration: halfDuration, ease: 'power1.in' }, halfDuration);
        timeline.call(enterIdle, undefined, JUMP_DURATION_MS * 0.001);
    }

    function scheduleBlock(): void {
        timeline.clear().time(0);
        state.phase = 'blocking';
        state.moveKind = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;

        const frameDuration = BLOCK_REACTION_MS * 0.001 / 3;
        for (let i = 0; i < 3; i++) {
            timeline.call(setBlockFrame, [i], i * frameDuration);
        }
        timeline.call(enterIdle, undefined, BLOCK_REACTION_MS * 0.001);
    }

    function scheduleHitReaction(knockback: number): void {
        timeline.clear().time(0);
        state.phase = 'hit-reacting';
        state.moveKind = undefined;
        state.frameIndex = 0;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.jumpHeight = 0;

        // Knockback direction: pushed away from attacker (opposite of facing)
        const sign = state.facing === 'right' ? -1 : 1;
        const targetX = state.x + knockback * sign;
        timeline.to(state, { x: targetX, duration: HIT_REACTION_MS * 0.001, ease: 'power2.out' }, 0);
        timeline.call(enterIdle, undefined, HIT_REACTION_MS * 0.001);
    }

    function scheduleDefeat(variant: DefeatVariant): void {
        timeline.clear().time(0);
        state.phase = 'defeated';
        state.moveKind = undefined;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.jumpHeight = 0;
        state.defeatVariant = variant;

        const frameDuration = 0.12; // 120ms per defeat frame
        for (let i = 0; i < 3; i++) {
            timeline.call(setDefeatFrame, [i], i * frameDuration);
        }
        // Remains in 'defeated' phase - does not auto-return
    }

    function scheduleWon(): void {
        timeline.clear().time(0);
        state.phase = 'won';
        state.moveKind = undefined;
        state.frameIndex = 0;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.jumpHeight = 0;

        // Toggle between won-1 and won-2
        const toggleSec = WON_FRAME_TOGGLE_MS * 0.001;
        timeline.call(setWonFrame, [0], 0);
        timeline.call(setWonFrame, [1], toggleSec);
        timeline.call(setWonFrame, [0], toggleSec * 2);
        timeline.call(setWonFrame, [1], toggleSec * 3);
        // Remains in 'won' phase
    }

    function scheduleLost(): void {
        timeline.clear().time(0);
        state.phase = 'lost';
        state.moveKind = undefined;
        state.frameIndex = 0;
        state.hitboxActive = false;
        state.walkDirection = 0;
        state.walkDistAccum = 0;
        state.jumpHeight = 0;
        // Remains in 'lost' phase - single frame
    }

    // -----------------------------------------------------------------------
    // Timeline callback helpers
    // -----------------------------------------------------------------------

    function setFrameState(fi: number, isHit: boolean): void {
        state.frameIndex = fi;
        state.hitboxActive = isHit;
    }

    function setTurnFrame(i: number): void {
        state.frameIndex = i;
    }

    function setBlockFrame(i: number): void {
        state.frameIndex = i;
    }

    function setDefeatFrame(i: number): void {
        state.frameIndex = i;
    }

    function setWonFrame(i: number): void {
        state.frameIndex = i;
    }

    function setAttackFrame(moveKind: MoveKind, fi: number, isHit: boolean, airborne: boolean): void {
        state.phase = airborne ? 'airborne' : 'attacking';
        state.moveKind = moveKind;
        state.frameIndex = fi;
        state.hitboxActive = isHit;
    }

    function flipFacing(): void {
        state.facing = state.facing === 'right' ? 'left' : 'right';
    }

    function applyLunge(moveKind: MoveKind, _attackStart: number, attackDuration: number): void {
        const md = MOVE_DATA[moveKind];
        const sign = state.facing === 'right' ? 1 : -1;
        const targetX = state.x + md.lunge * sign;
        // Add a tween to the timeline from the current position
        timeline.to(state, { x: targetX, duration: attackDuration, ease: 'none' }, timeline.time());
    }

    // -----------------------------------------------------------------------
    // Frame sequence resolution
    // -----------------------------------------------------------------------

    function resolveFrameSequence(moveKind: MoveKind): readonly number[] {
        // Crouch punch (and back-crouch-punch) use a special hardcoded sequence
        if (moveKind === 'crouch-punch' || moveKind === 'back-crouch-punch') {
            return CROUCH_PUNCH_FRAME_SEQUENCE;
        }

        // Check for variant cycling
        const variants = MOVE_VARIANTS[moveKind];
        if (variants !== undefined) {
            // The move has variants - resolve which one to use
            const isKick = moveKind === 'chest-kick' || moveKind === 'front-kick';
            const isPunch = moveKind === 'front-lunge-punch' || moveKind === 'back-lunge-punch';

            if (isKick) {
                const idx = kickVariantIndex % variants.sequences.length;
                kickVariantIndex++;
                return variants.sequences[idx];
            }
            if (isPunch) {
                const idx = punchVariantIndex % variants.sequences.length;
                punchVariantIndex++;
                return variants.sequences[idx];
            }
        }

        // Non-cycling moves: use sequential indices [0, 1, 2, ...]
        const moveData = MOVE_DATA[moveKind];
        return buildSequentialIndices(moveData.frameDurationMs.length);
    }

    function isInHitFrames(hitFrameIndices: readonly number[], sequenceIndex: number): boolean {
        for (let i = 0; i < hitFrameIndices.length; i++) {
            if (hitFrameIndices[i] === sequenceIndex) return true;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

// Pre-built sequential index arrays for common sizes (avoid per-call allocation)
const SEQUENTIAL_CACHE: readonly number[][] = [];
for (let n = 0; n <= 8; n++) {
    const arr: number[] = [];
    for (let i = 0; i < n; i++) arr.push(i);
    (SEQUENTIAL_CACHE as number[][]).push(arr);
}

function buildSequentialIndices(count: number): readonly number[] {
    if (count < SEQUENTIAL_CACHE.length) return SEQUENTIAL_CACHE[count];
    const arr: number[] = [];
    for (let i = 0; i < count; i++) arr.push(i);
    return arr;
}
