import type { MoveKind } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MoveData {
    /** Duration in ms for each frame in the sequence. */
    readonly frameDurationMs: readonly number[];
    /** Which entries in the frame sequence have an active hitbox (0-based). */
    readonly hitFrameIndices: readonly number[];
    /** Points scored on hit. */
    readonly damage: number;
    /** Hitbox offset and size relative to fighter centre, in world units.
     *  dx is in the fighter's forward direction (model flips for facing). */
    readonly hitbox: { readonly dx: number; readonly dy: number; readonly w: number; readonly h: number };
    /** Forward lunge distance during the move (world units). */
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

export interface MoveVariants {
    /** One frame-index sequence per variant. Indices are 0-based into the
     *  animation source's texture array (e.g. kick-1 through kick-7). */
    readonly sequences: readonly (readonly number[])[];
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

    // --- Punches (variant cycling, 2 frames per variant) ---
    'front-lunge-punch': {
        frameDurationMs: [FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },
    'back-lunge-punch': {
        frameDurationMs: [FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: true,
    },

    // --- Kicks (variant cycling, 3 frames per variant) ---
    'chest-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },
    'front-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Foot sweep (6 frames) ---
    'foot-sweep': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
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

    // --- Front side kick (3 frames, back-kick sprites) ---
    'front-side-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [1],
        damage: 1,
        hitbox: { dx: 0.6, dy: 0, w: 0.4, h: 0.3 },
        lunge: 0.3,
        blockable: true,
        knockback: 0.5,
        airborne: false,
        autoTurn: false,
    },

    // --- Back side kick (auto-turns, 3 frames, back-kick sprites) ---
    'back-side-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS],
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
    'roundhouse': {
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

    // --- Flying kick (5 frames, airborne) ---
    'flying-kick': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [2, 3],
        damage: 1,
        hitbox: { dx: 0.5, dy: 0, w: 0.5, h: 0.3 },
        lunge: 0,
        blockable: false,
        knockback: 0.5,
        airborne: true,
        autoTurn: false,
    },

    // --- Front somersault (6 frames, airborne) ---
    'front-somersault': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [3, 4],
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.5, h: 0.4 },
        lunge: 0,
        blockable: false,
        knockback: 0.5,
        airborne: true,
        autoTurn: false,
    },

    // --- Back somersault (6 frames, airborne) ---
    'back-somersault': {
        frameDurationMs: [FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS, FRAME_MS],
        hitFrameIndices: [3, 4],
        damage: 1,
        hitbox: { dx: 0.4, dy: 0, w: 0.5, h: 0.4 },
        lunge: 0,
        blockable: false,
        knockback: 0.5,
        airborne: true,
        autoTurn: false,
    },
};

// ---------------------------------------------------------------------------
// Variant Cycling
// ---------------------------------------------------------------------------

/**
 * Kick variants (row 3, 7 total frames).
 * Shared by 'chest-kick' and 'front-kick'.
 */
const KICK_VARIANTS: MoveVariants = {
    sequences: [
        [0, 1, 2],  // Variant A: windup, strike A, follow-through A
        [0, 3, 4],  // Variant B: windup, strike B, follow-through B
        [0, 5, 6],  // Variant C: windup, strike C, follow-through C
    ],
};

/**
 * Punch variants (row 4, 6 total frames).
 * Shared by 'front-lunge-punch' and 'back-lunge-punch'.
 */
const PUNCH_VARIANTS: MoveVariants = {
    sequences: [
        [0, 1],  // Variant A: windup-high, strike A
        [0, 2],  // Variant B: windup-high, strike B
        [3, 4],  // Variant C: windup-low, strike C
        [3, 5],  // Variant D: windup-low, strike D
    ],
};

/**
 * Variant data for moves that cycle through multiple frame sequences.
 * Only moves with variant cycling have entries here. Other moves use their
 * full frame list in order.
 */
export const MOVE_VARIANTS: Partial<Record<MoveKind, MoveVariants>> = {
    'chest-kick': KICK_VARIANTS,
    'front-kick': KICK_VARIANTS,
    'front-lunge-punch': PUNCH_VARIANTS,
    'back-lunge-punch': PUNCH_VARIANTS,
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
