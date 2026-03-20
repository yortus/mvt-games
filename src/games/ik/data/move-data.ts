import type { MoveKind } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MoveData {
    /** Duration in ms for each frame in the sequence. */
    readonly frameDurationMs: readonly number[];
    /** Explicit 0-based texture indices for each frame (when non-sequential).
     *  Length must match frameDurationMs. When omitted, uses [0, 1, 2, ...]. */
    readonly frameSequence?: readonly number[];
    /** Which entries in the frame sequence have an active hitbox (0-based). */
    readonly hitFrameIndices: readonly number[];
    /** Points scored on hit. */
    readonly damage: number;
    /** Hitbox offset and size relative to fighter centre, in world units.
     *  dx is in the fighter's forward direction (model flips for facing). */
    readonly hitbox: { readonly dx: number; readonly dy: number; readonly w: number; readonly h: number };
    /** Lunge distance during the move (world units).
     *  Positive = forward (toward facing), negative = backward. */
    readonly lunge: number;
    /** Whether this attack can be passively blocked. */
    readonly blockable: boolean;
    /** Pushback applied to the defender on hit (world units). */
    readonly knockback: number;
    /** Whether the fighter is airborne during this move. */
    readonly airborne: boolean;
    /** Whether the fighter auto-turns before executing (moves 8, 13, 14). */
    readonly autoTurn: boolean;
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
    jump: {
        frameDurationMs: [500],
        hitFrameIndices: [],
        damage: 0,
        hitbox: { dx: 0, dy: 0, w: 0, h: 0 },
        lunge: 0,
        blockable: false,
        knockback: 0,
        airborne: true,
        autoTurn: false,
    },

    // --- High punch: punch frames 1,3 (0-based: [0, 2]) ---
    'high-punch': {
        frameDurationMs: [FRAME_MS, FRAME_MS],
        frameSequence: [0, 2],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Back lunge punch (auto-turns, punch frames 1,3) ---
    'back-lunge-punch': {
        frameDurationMs: [FRAME_MS, FRAME_MS],
        frameSequence: [0, 2],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: true,
    },

    // --- High kick: kick frames 1,6,7 (0-based: [0, 5, 6]) ---
    'high-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        frameSequence: [0, 5, 6],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Mid kick: kick frames 1,2,3 (0-based: [0, 1, 2]) ---
    'mid-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        frameSequence: [0, 1, 2],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Low kick: kick frames 1,4,5 (0-based: [0, 3, 4]) ---
    'low-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        frameSequence: [0, 3, 4],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Foot sweep (4 frames) ---
    'foot-sweep': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [2, 3],
        damage: 1,
        hitbox: { dx: 0.5, dy: -0.3, w: 0.5, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Crouch punch (4-frame sequence: [0,1,0,0]) ---
    'crouch-punch': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.4, dy: -0.2, w: 0.3, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Back crouch punch (auto-turns, same animation as crouch-punch) ---
    'back-crouch-punch': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.4, dy: -0.2, w: 0.3, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: true,
    },

    // --- Back low kick (auto-turns, kick frames 1,4,5) ---
    'back-low-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        frameSequence: [0, 3, 4],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: true,
    },

    // --- Roundhouse (4 frames) ---
    roundhouse: {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [2],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.5, h: 0.4 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Flying kick (5 frames, low airborne forward kick) ---
    'flying-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [2, 3],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.5, h: 0.3 },
        lunge: 1.0,
        blockable: false,
        knockback: 0.5,
        airborne: true,
        autoTurn: false,
    },

    // --- Front somersault (6 frames, airborne, moves forward) ---
    'front-somersault': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [3, 4],
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.5, h: 0.4 },
        lunge: 2.0,
        blockable: false,
        knockback: 0.5,
        airborne: true,
        autoTurn: false,
    },

    // --- Back somersault (6 frames, airborne, moves backward) ---
    'back-somersault': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [3, 4],
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.5, h: 0.4 },
        lunge: -2.0,
        blockable: false,
        knockback: 0.5,
        airborne: true,
        autoTurn: false,
    },
};

// ---------------------------------------------------------------------------
// Crouch Punch Frame Sequence
// ---------------------------------------------------------------------------

/**
 * The crouch punch uses only 2 source frames but plays as a 4-frame sequence:
 * strike out then retract. Shared by 'crouch-punch' and 'back-crouch-punch'.
 * Indices are 0-based into the crouch-punch texture array.
 */
export const CROUCH_PUNCH_FRAME_SEQUENCE: readonly number[] = [0, 1, 0, 0];
