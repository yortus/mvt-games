import type { MoveKind } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MoveData {
    /** Total duration of the move animation in ms. */
    readonly durationMs: number;
    /** 0-based texture indices per segment. Defines the number of
     *  equal-duration segments and the texture index for each. */
    readonly frameSequence: readonly number[];
    /** Ms after move start when hitbox becomes active (omit if no hitbox). */
    readonly hitboxActiveFromMs?: number;
    /** Ms after move start when hitbox deactivates (omit if no hitbox). */
    readonly hitboxActiveToMs?: number;
    /** Points scored on hit. */
    readonly damage: number;
    /** Hitbox offset and size relative to fighter centre, in metres.
     *  dx is in the fighter's forward direction (model flips for facing). */
    readonly hitbox: { readonly dx: number; readonly dy: number; readonly w: number; readonly h: number };
    /** Lunge distance in metres. Positive = forward, negative = backward. */
    readonly lunge: number;
    /** Whether this attack can be passively blocked. */
    readonly isBlockable: boolean;
    /** Pushback applied to the defender on hit, in metres. */
    readonly knockback: number;
    /** Whether the fighter is airborne during this move. */
    readonly isAirborne: boolean;
    /** Whether the fighter auto-turns before executing (moves 8, 13, 14). */
    readonly hasAutoTurn: boolean;
}

// ---------------------------------------------------------------------------
// Constants - shared defaults
// ---------------------------------------------------------------------------

const FRAME_MS = 80;

// ---------------------------------------------------------------------------
// Move Data
// ---------------------------------------------------------------------------

export const MOVE_DATA: Record<MoveKind, MoveData> = {
    // --- Jump (non-attacking airborne) ---
    'jump': {
        durationMs: 500,
        frameSequence: [0],
        damage: 0,
        hitbox: { dx: 0, dy: 0, w: 0, h: 0 },
        lunge: 0,
        isBlockable: false,
        knockback: 0,
        isAirborne: true,
        hasAutoTurn: false,
    },

    // --- High punch: punch frames 1,3 (0-based: [0, 2]) ---
    'high-punch': {
        durationMs: 2 * FRAME_MS,
        frameSequence: [0, 2],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.3, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Back lunge punch (auto-turns, punch frames 1,3) ---
    'back-lunge-punch': {
        durationMs: 2 * FRAME_MS,
        frameSequence: [0, 2],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.3, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: true,
    },

    // --- High kick: kick frames 1,6,7 (0-based: [0, 5, 6]) ---
    'high-kick': {
        durationMs: 3 * FRAME_MS,
        frameSequence: [0, 5, 6],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.3, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Mid kick: kick frames 1,2,3 (0-based: [0, 1, 2]) ---
    'mid-kick': {
        durationMs: 3 * FRAME_MS,
        frameSequence: [0, 1, 2],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.3, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Low kick: kick frames 1,4,5 (0-based: [0, 3, 4]) ---
    'low-kick': {
        durationMs: 3 * FRAME_MS,
        frameSequence: [0, 3, 4],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.3, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Foot sweep (4 frames) ---
    'foot-sweep': {
        durationMs: 4 * FRAME_MS,
        frameSequence: [0, 1, 2, 3],
        hitboxActiveFromMs: 2 * FRAME_MS,
        hitboxActiveToMs: 4 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.4, dy: 0.15, w: 0.4, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Crouch punch (4-segment sequence: strike out then retract) ---
    'crouch-punch': {
        durationMs: 4 * FRAME_MS,
        frameSequence: [0, 1, 0, 0],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.3, dy: 0.3, w: 0.2, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Back crouch punch (auto-turns, same animation as crouch-punch) ---
    'back-crouch-punch': {
        durationMs: 4 * FRAME_MS,
        frameSequence: [0, 1, 0, 0],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.3, dy: 0.3, w: 0.2, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: true,
    },

    // --- Back low kick (auto-turns, kick frames 1,4,5) ---
    'back-low-kick': {
        durationMs: 3 * FRAME_MS,
        frameSequence: [0, 3, 4],
        hitboxActiveFromMs: FRAME_MS,
        hitboxActiveToMs: 2 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.3, h: 0.3 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: true,
    },

    // --- Roundhouse (4 frames) ---
    'roundhouse': {
        durationMs: 4 * FRAME_MS,
        frameSequence: [0, 1, 2, 3],
        hitboxActiveFromMs: 2 * FRAME_MS,
        hitboxActiveToMs: 3 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.4, h: 0.4 },
        lunge: 0.3,
        isBlockable: true,
        knockback: 0.5,
        isAirborne: false,
        hasAutoTurn: false,
    },

    // --- Flying kick (5 frames, low airborne forward kick) ---
    'flying-kick': {
        durationMs: 5 * FRAME_MS,
        frameSequence: [2, 3, 4, 4, 4, 3],
        hitboxActiveFromMs: 2 * FRAME_MS,
        hitboxActiveToMs: 5 * FRAME_MS,
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.4, h: 0.3 },
        lunge: 1.0,
        isBlockable: false,
        knockback: 0.5,
        isAirborne: true,
        hasAutoTurn: false,
    },

    // --- Front somersault (6 frames, airborne, moves forward) ---
    'front-somersault': {
        durationMs: 6 * FRAME_MS,
        frameSequence: [0, 1, 2, 3, 4, 5],
        damage: 1,
        hitbox: { dx: 0.3, dy: 0, w: 0.4, h: 0.4 },
        lunge: 2.0,
        isBlockable: false,
        knockback: 0.5,
        isAirborne: true,
        hasAutoTurn: false,
    },

    // --- Back somersault (6 frames, airborne, moves backward) ---
    'back-somersault': {
        durationMs: 6 * FRAME_MS,
        frameSequence: [0, 1, 2, 3, 4, 5],
        damage: 1,
        hitbox: { dx: 0.3, dy: 0, w: 0.4, h: 0.4 },
        lunge: -2.0,
        isBlockable: false,
        knockback: 0.5,
        isAirborne: true,
        hasAutoTurn: false,
    },
};
