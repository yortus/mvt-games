// ---------------------------------------------------------------------------
// Facing
// ---------------------------------------------------------------------------

export type Facing = 'left' | 'right';

// ---------------------------------------------------------------------------
// Fighter Phase
// ---------------------------------------------------------------------------

export type FighterPhase =
    | 'idle'
    | 'walking'
    | 'turning'
    | 'attacking'
    | 'blocking'
    | 'airborne'
    | 'hit-reacting'
    | 'defeated'
    | 'won'
    | 'lost';

// ---------------------------------------------------------------------------
// Move Kind
// ---------------------------------------------------------------------------

export type MoveKind =
    | 'high-punch'
    | 'high-kick'
    | 'foot-sweep'
    | 'crouch-punch'
    | 'back-lunge-punch'
    | 'flying-kick'
    | 'front-somersault'
    | 'mid-kick'
    | 'low-kick'
    | 'back-crouch-punch'
    | 'back-low-kick'
    | 'roundhouse'
    | 'back-somersault'
    | 'jump';

// ---------------------------------------------------------------------------
// Defeat Variant
// ---------------------------------------------------------------------------

export type DefeatVariant = 'a' | 'b' | 'c' | 'd';

// ---------------------------------------------------------------------------
// Game Phase
// ---------------------------------------------------------------------------

export type GamePhase = 'round-intro' | 'fighting' | 'point-scored' | 'round-over' | 'match-over';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type InputDirection =
    | 'none'
    | 'forward'
    | 'backward'
    | 'up'
    | 'down'
    | 'up-forward'
    | 'up-backward'
    | 'down-forward'
    | 'down-backward';

export type XDirection = 'left' | 'none' | 'right';

export type YDirection = 'up' | 'none' | 'down';

// ---------------------------------------------------------------------------
// Move Resolution
// ---------------------------------------------------------------------------

export type MoveResolution =
    | { action: 'move'; moveKind: MoveKind }
    | { action: 'walk'; direction: 'forward' | 'backward' }
    | { action: 'jump' }
    | { action: 'idle' };

// ---------------------------------------------------------------------------
// Helper: resolveInputDirection
// ---------------------------------------------------------------------------

/**
 * Converts raw axis directions + current facing into a relative InputDirection.
 * "Forward" = toward the direction the fighter faces.
 */
export function resolveInputDirection(xDir: XDirection, yDir: YDirection, facing: Facing): InputDirection {
    // Determine forward/backward from raw left/right relative to facing
    let relX: 'forward' | 'backward' | 'none' = 'none';
    if (xDir === 'left') {
        relX = facing === 'left' ? 'forward' : 'backward';
    } else if (xDir === 'right') {
        relX = facing === 'right' ? 'forward' : 'backward';
    }

    if (yDir === 'none') {
        if (relX === 'forward') return 'forward';
        if (relX === 'backward') return 'backward';
        return 'none';
    }

    if (yDir === 'up') {
        if (relX === 'forward') return 'up-forward';
        if (relX === 'backward') return 'up-backward';
        return 'up';
    }

    // yDir === 'down'
    if (relX === 'forward') return 'down-forward';
    if (relX === 'backward') return 'down-backward';
    return 'down';
}

// ---------------------------------------------------------------------------
// Helper: resolveMove
// ---------------------------------------------------------------------------

// Pre-allocated result objects to avoid per-call allocations (hot path)
const RESULT_IDLE: MoveResolution = { action: 'idle' };
const RESULT_JUMP: MoveResolution = { action: 'jump' };
const RESULT_WALK_FWD: MoveResolution = { action: 'walk', direction: 'forward' };
const RESULT_WALK_BWD: MoveResolution = { action: 'walk', direction: 'backward' };
const RESULT_HIGH_PUNCH: MoveResolution = { action: 'move', moveKind: 'high-punch' };
const RESULT_HIGH_KICK: MoveResolution = { action: 'move', moveKind: 'high-kick' };
const RESULT_FOOT_SWEEP: MoveResolution = { action: 'move', moveKind: 'foot-sweep' };
const RESULT_CROUCH_PUNCH: MoveResolution = { action: 'move', moveKind: 'crouch-punch' };
const RESULT_BACK_LUNGE_PUNCH: MoveResolution = { action: 'move', moveKind: 'back-lunge-punch' };
const RESULT_FLYING_KICK: MoveResolution = { action: 'move', moveKind: 'flying-kick' };
const RESULT_FRONT_SOMERSAULT: MoveResolution = { action: 'move', moveKind: 'front-somersault' };
const RESULT_MID_KICK: MoveResolution = { action: 'move', moveKind: 'mid-kick' };
const RESULT_LOW_KICK: MoveResolution = { action: 'move', moveKind: 'low-kick' };
const RESULT_BACK_CROUCH_PUNCH: MoveResolution = { action: 'move', moveKind: 'back-crouch-punch' };
const RESULT_BACK_LOW_KICK: MoveResolution = { action: 'move', moveKind: 'back-low-kick' };
const RESULT_ROUNDHOUSE: MoveResolution = { action: 'move', moveKind: 'roundhouse' };
const RESULT_BACK_SOMERSAULT: MoveResolution = { action: 'move', moveKind: 'back-somersault' };

/**
 * Maps a relative InputDirection + attack-button state to a MoveResolution.
 * Encodes the full control scheme table from the design doc.
 */
export function resolveMove(inputDir: InputDirection, attackPressed: boolean): MoveResolution {
    if (inputDir === 'none') return RESULT_IDLE;

    if (!attackPressed) {
        // Without attack button
        switch (inputDir) {
            case 'up':
                return RESULT_JUMP;
            case 'up-forward':
                return RESULT_HIGH_PUNCH;
            case 'forward':
                return RESULT_WALK_FWD;
            case 'down-forward':
                return RESULT_HIGH_KICK;
            case 'down':
                return RESULT_FOOT_SWEEP;
            case 'down-backward':
                return RESULT_CROUCH_PUNCH;
            case 'backward':
                return RESULT_WALK_BWD;
            case 'up-backward':
                return RESULT_BACK_LUNGE_PUNCH;
        }
    } else {
        // With attack button
        switch (inputDir) {
            case 'up':
                return RESULT_FLYING_KICK;
            case 'up-forward':
                return RESULT_FRONT_SOMERSAULT;
            case 'forward':
                return RESULT_MID_KICK;
            case 'down-forward':
                return RESULT_LOW_KICK;
            case 'down':
                return RESULT_BACK_CROUCH_PUNCH;
            case 'down-backward':
                return RESULT_BACK_LOW_KICK;
            case 'backward':
                return RESULT_ROUNDHOUSE;
            case 'up-backward':
                return RESULT_BACK_SOMERSAULT;
        }
    }

    return RESULT_IDLE;
}
