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
// Fighter Move (voluntary action the fighter can attempt)
// ---------------------------------------------------------------------------

/** A voluntary action the fighter can attempt via tryMove(). */
export type FighterMove = MoveKind | 'walk-forward' | 'walk-backward' | 'idle';

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

/**
 * Maps a relative InputDirection + attack-button state to a FighterMove.
 * Encodes the full control scheme table from the design doc.
 */
export function resolveMove(inputDir: InputDirection, attackPressed: boolean): FighterMove {
    if (inputDir === 'none') return 'idle';

    if (!attackPressed) {
        // prettier-ignore
        switch (inputDir) {
            case 'up':            return 'jump';
            case 'up-forward':    return 'high-punch';
            case 'forward':       return 'walk-forward';
            case 'down-forward':  return 'high-kick';
            case 'down':          return 'foot-sweep';
            case 'down-backward': return 'crouch-punch';
            case 'backward':      return 'walk-backward';
            case 'up-backward':   return 'back-lunge-punch';
        }
    } else {
        // prettier-ignore
        switch (inputDir) {
            case 'up':            return 'flying-kick';
            case 'up-forward':    return 'front-somersault';
            case 'forward':       return 'mid-kick';
            case 'down-forward':  return 'low-kick';
            case 'down':          return 'back-crouch-punch';
            case 'down-backward': return 'back-low-kick';
            case 'backward':      return 'roundhouse';
            case 'up-backward':   return 'back-somersault';
        }
    }

    return 'idle';
}
