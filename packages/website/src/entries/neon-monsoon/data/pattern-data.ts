// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

/**
 * Every kind of enemy bullet: a shape and a colour. Pellets and orbs are
 * round; needles and rain are long, and fly pointing along their path.
 *
 * Every bullet is a warm colour, red to gold. The city and the craft glow in
 * cool neon, cyan to magenta, so a bullet never blends into the scenery.
 */
export type BulletKind =
    | 'pellet-red'
    | 'pellet-amber'
    | 'pellet-orange'
    | 'pellet-gold'
    | 'orb-red'
    | 'orb-amber'
    | 'needle-orange'
    | 'needle-gold'
    | 'rain';

/**
 * How a bullet moves once fired. Most bullets fly straight at one speed;
 * these fields bend and ease them, which is where most of a pattern's
 * character comes from.
 */
export interface BulletMotion {
    /** Launch speed in world-units per second. */
    readonly speed: number;
    /** The speed the bullet eases toward, at `accel`. Defaults to `speed`. */
    readonly endSpeed?: number;
    /** World-units per second, per second, toward `endSpeed`. Without it, the bullet takes `endSpeed` at once. */
    readonly accel?: number;
    /** Degrees per second; positive turns clockwise on screen. */
    readonly turnDegPerSec?: number;
    /** How long the bullet turns before it flies straight. Defaults to forever. */
    readonly turnMs?: number;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * A bullet pattern: what an emitter fires, and when. `kind` selects the shape
 * of each volley; the rest is shared.
 */
export type PatternDef = RingPattern | FanPattern | StreamPattern | RainPattern;

/** Fields every pattern has. */
export interface PatternTiming {
    readonly bullet: BulletKind;
    readonly motion: BulletMotion;
    /** Time between volleys. */
    readonly intervalMs: number;
    /** Wait before the first volley. Defaults to 0. */
    readonly delayMs?: number;
    /** Stop this long after the first volley. Defaults to firing for as long as the owner lives. */
    readonly durationMs?: number;
    /** Where the pattern fires from, relative to its owner. */
    readonly offsetX?: number;
    readonly offsetY?: number;
}

/**
 * `count` bullets spread evenly around a circle, the circle turning by
 * `spinPerVolleyDeg` each volley. A ring of two or three bullets, fired often
 * while spinning, is a spiral.
 */
export interface RingPattern extends PatternTiming {
    readonly kind: 'ring';
    readonly count: number;
    /** Direction of the first bullet of the first volley. Defaults to 90 (down). */
    readonly angleDeg?: number;
    readonly spinPerVolleyDeg?: number;
}

/** `count` bullets spread across `spreadDeg`, centred on the ship when aimed. */
export interface FanPattern extends PatternTiming {
    readonly kind: 'fan';
    readonly count: number;
    readonly spreadDeg: number;
    readonly isAimed: boolean;
    /** The fan's centre when not aimed. Defaults to 90 (down). */
    readonly angleDeg?: number;
}

/** A burst of `burst` bullets one after another, each `burstGapMs` apart. */
export interface StreamPattern extends PatternTiming {
    readonly kind: 'stream';
    readonly burst: number;
    readonly burstGapMs: number;
    /** Each bullet aims at the ship when it is fired, so a stream follows a moving ship. */
    readonly isAimed: boolean;
}

/**
 * A row of bullets falling from the top edge across the whole arena, ignoring
 * the owner's position, with a gap of `gapLanes` lanes the player can stand
 * in. The gap drifts by `gapDriftPerVolley` lanes a volley, turning back at
 * the edges.
 */
export interface RainPattern extends PatternTiming {
    readonly kind: 'rain';
    readonly lanes: number;
    readonly gapLanes: number;
    readonly gapDriftPerVolley: number;
}

// ---------------------------------------------------------------------------
// The game's patterns
// ---------------------------------------------------------------------------

/** A kite's single shot at the ship. */
export const KITE_SHOT: PatternDef = {
    kind: 'fan', count: 1, spreadDeg: 0, isAimed: true,
    bullet: 'pellet-red', motion: { speed: 85 },
    intervalMs: 2400, delayMs: 700,
};

/** On the second loop, every kite leaves this ring behind when it dies. */
export const REVENGE_RING: PatternDef = {
    kind: 'ring', count: 8, spinPerVolleyDeg: 0,
    bullet: 'pellet-gold', motion: { speed: 40, endSpeed: 80, accel: 60 },
    intervalMs: 1000,
};

/** A lancer's aimed burst while it hovers. */
export const LANCER_STREAM: PatternDef = {
    kind: 'stream', burst: 4, burstGapMs: 90, isAimed: true,
    bullet: 'needle-orange', motion: { speed: 150 },
    intervalMs: 1500, delayMs: 300,
};

/** A rooftop turret's fan. */
export const TURRET_FAN: PatternDef = {
    kind: 'fan', count: 5, spreadDeg: 44, isAimed: true,
    bullet: 'pellet-amber', motion: { speed: 75 },
    intervalMs: 1700, delayMs: 500,
};

/** A barge's slow ring, interleaving each volley with the last. */
export const BARGE_RING: PatternDef = {
    kind: 'ring', count: 18, spinPerVolleyDeg: 10,
    bullet: 'orb-amber', motion: { speed: 55 },
    intervalMs: 1300, delayMs: 800,
};

/** A barge's spiral, which starts once it has been on screen a while. */
export const BARGE_SPIRAL: PatternDef = {
    kind: 'ring', count: 3, spinPerVolleyDeg: 13,
    bullet: 'pellet-gold', motion: { speed: 70 },
    intervalMs: 110, delayMs: 4000,
};

/** The gunship's aimed needle fans. */
export const GUNSHIP_FAN: PatternDef = {
    kind: 'fan', count: 7, spreadDeg: 60, isAimed: true,
    bullet: 'needle-gold', motion: { speed: 125 },
    intervalMs: 950, delayMs: 1500,
};

/** The gunship's spirals, one from each wing, turning opposite ways. */
export const GUNSHIP_SPIRAL_LEFT: PatternDef = {
    kind: 'ring', count: 4, spinPerVolleyDeg: 9,
    bullet: 'pellet-red', motion: { speed: 70 },
    intervalMs: 140, delayMs: 6000, offsetX: -18,
};

export const GUNSHIP_SPIRAL_RIGHT: PatternDef = {
    kind: 'ring', count: 4, spinPerVolleyDeg: -9,
    bullet: 'pellet-red', motion: { speed: 70 },
    intervalMs: 140, delayMs: 6000, offsetX: 18,
};
