// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** A point on the ground, in metres. */
export interface GroundPoint {
    readonly x: number;
    readonly z: number;
}

/**
 * The track's centre line, as points a smooth curve passes through, in
 * order round the loop. The race starts at the first point, heading for the
 * second. The layout is the game's own: a start straight, a long sweeper, a
 * tight left and right through the chicane, a fast back section, a hairpin,
 * and a kink back onto the straight.
 */
export const TRACK_POINTS: readonly GroundPoint[] = [
    { x: 0, z: 0 },
    { x: 60, z: 0 },
    { x: 115, z: 4 },
    { x: 150, z: 25 },
    { x: 160, z: 60 },
    { x: 140, z: 90 },
    { x: 108, z: 96 },
    { x: 92, z: 118 },
    { x: 108, z: 140 },
    { x: 96, z: 164 },
    { x: 60, z: 172 },
    { x: 15, z: 160 },
    { x: -30, z: 172 },
    { x: -70, z: 158 },
    { x: -86, z: 126 },
    { x: -66, z: 100 },
    { x: -36, z: 104 },
    { x: -22, z: 80 },
    { x: -48, z: 52 },
    { x: -52, z: 22 },
    { x: -32, z: 2 },
];
