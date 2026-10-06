import {
    BARGE_RING,
    BARGE_SPIRAL,
    GUNSHIP_FAN,
    GUNSHIP_SPIRAL_LEFT,
    GUNSHIP_SPIRAL_RIGHT,
    KITE_SHOT,
    LANCER_STREAM,
    TURRET_FAN,
    type PatternDef,
} from './pattern-data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Every enemy but the boss. Kites are small flyers, lancers dive, turrets sit
 * on the rooftops and scroll with the city, barges are slow carriers, and the
 * gunship is the mid-boss.
 */
export type EnemyKind = 'kite' | 'lancer' | 'turret' | 'barge' | 'gunship';

/** What an enemy can leave behind: a power level or a bomb. */
export type ItemKind = 'power' | 'bomb';

/** One thing the stage does at a moment in stage time. */
export type StageEvent = SpawnEvent | WarningEvent | BossEvent;

export interface SpawnEvent {
    readonly kind: 'spawn';
    readonly atMs: number;
    readonly enemy: EnemyKind;
    /** Where it enters. `y` defaults to just above the top edge. */
    readonly x: number;
    readonly y?: number;
    readonly path: PathDef;
    readonly patterns: readonly PatternDef[];
    readonly drop?: ItemKind;
}

/** The warning banner before the boss. */
export interface WarningEvent {
    readonly kind: 'warning';
    readonly atMs: number;
}

/** The boss arrives, and the scroll stops. */
export interface BossEvent {
    readonly kind: 'boss';
    readonly atMs: number;
}

/**
 * How an enemy moves, in world-units per second. Each enemy leaves when it
 * has flown off the arena.
 */
export type PathDef = StraightPath | SwoopPath | HoverPath | DivePath | GroundPath | StrafePath;

/** Flies in a straight line. */
export interface StraightPath {
    readonly kind: 'straight';
    readonly speed: number;
    /** Defaults to 90 (down). */
    readonly angleDeg?: number;
}

/** Flies down, then turns, by `turnDegPerSec` for `turnMs`, and flies on. */
export interface SwoopPath {
    readonly kind: 'swoop';
    readonly speed: number;
    readonly turnAfterMs: number;
    readonly turnDegPerSec: number;
    readonly turnMs: number;
}

/** Flies down to `stopY`, holds there, then leaves upward. */
export interface HoverPath {
    readonly kind: 'hover';
    readonly speed: number;
    readonly stopY: number;
    readonly holdMs: number;
}

/** Flies down to `stopY`, holds, then dives at where the ship was. */
export interface DivePath {
    readonly kind: 'dive';
    readonly speed: number;
    readonly stopY: number;
    readonly holdMs: number;
    readonly diveSpeed: number;
}

/** Fixed to the city, so it moves down the arena as the city scrolls. */
export interface GroundPath {
    readonly kind: 'ground';
}

/** Flies down to `stopY`, sways from side to side while it holds, then leaves upward. */
export interface StrafePath {
    readonly kind: 'strafe';
    readonly speed: number;
    readonly stopY: number;
    readonly holdMs: number;
    readonly swayX: number;
    readonly swayPeriodMs: number;
}

// ---------------------------------------------------------------------------
// Shared paths
// ---------------------------------------------------------------------------

// Declared before the stage, which is built from them as this module loads.

/** Time between kites in a column. */
const KITE_GAP_MS = 330;

const STRAIGHT_DOWN: PathDef = { kind: 'straight', speed: 70 };
// A swoop turns a quarter circle: from heading down to heading across.
const SWOOP_RIGHT: PathDef = { kind: 'swoop', speed: 85, turnAfterMs: 1200, turnDegPerSec: -70, turnMs: 1300 };
const SWOOP_LEFT: PathDef = { kind: 'swoop', speed: 85, turnAfterMs: 1200, turnDegPerSec: 70, turnMs: 1300 };

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

/**
 * The whole stage, about two minutes of it before the boss. The first few
 * seconds are quiet; the gunship arrives at 0:45, the barges at 1:17, and the
 * boss at 2:01. Sorted by `atMs`, as the stage model requires.
 */
export const STAGE_EVENTS: readonly StageEvent[] = sortByTime([
    // 0:00 - kites in lines, holding fire
    ...kiteColumn(1500, 60, 5, STRAIGHT_DOWN, []),
    ...kiteColumn(4500, 180, 5, STRAIGHT_DOWN, []),

    // 0:08 - swooping kites, now firing
    ...kiteColumn(8000, 40, 6, SWOOP_RIGHT, [KITE_SHOT], 'power'),
    ...kiteColumn(11_000, 200, 6, SWOOP_LEFT, [KITE_SHOT]),
    ...kiteV(14_000, 120, [KITE_SHOT]),

    // 0:16 - the first rooftop turrets
    turret(16_000, 50),
    turret(17_500, 190),
    ...kiteColumn(20_000, 120, 6, STRAIGHT_DOWN, [KITE_SHOT], 'power'),

    // 0:24 - lancers
    lancer(24_000, 70),
    lancer(24_600, 170),
    turret(27_000, 120),
    ...kiteColumn(28_000, 30, 5, SWOOP_RIGHT, [KITE_SHOT]),
    lancer(31_000, 50),
    lancer(31_400, 120),
    lancer(31_800, 190),
    turret(34_000, 40),
    turret(34_000, 80),
    turret(35_500, 160),
    turret(35_500, 200),
    ...kiteColumn(38_000, 40, 6, SWOOP_RIGHT, [KITE_SHOT]),
    ...kiteColumn(38_000, 200, 6, SWOOP_LEFT, [KITE_SHOT]),
    lancer(42_000, 90),
    lancer(42_400, 150),

    // 0:45 - the gunship, for half a minute
    {
        kind: 'spawn', atMs: 45_000, enemy: 'gunship', x: 120, y: -30,
        path: { kind: 'strafe', speed: 45, stopY: 72, holdMs: 30_000, swayX: 70, swayPeriodMs: 5200 },
        patterns: [GUNSHIP_FAN, GUNSHIP_SPIRAL_LEFT, GUNSHIP_SPIRAL_RIGHT],
        drop: 'bomb',
    },

    // 1:17 - barges with escorts
    barge(77_000, 80, 'power'),
    ...kiteV(79_000, 170, [KITE_SHOT]),
    barge(83_000, 170, 'power'),
    ...kiteV(85_000, 70, [KITE_SHOT]),
    turret(87_000, 30),
    turret(87_000, 90),
    turret(88_000, 150),
    turret(88_000, 210),
    lancer(91_000, 60),
    lancer(91_300, 120),
    lancer(91_600, 180),
    ...kiteColumn(94_000, 40, 6, SWOOP_RIGHT, [KITE_SHOT]),
    ...kiteColumn(95_000, 200, 6, SWOOP_LEFT, [KITE_SHOT]),
    barge(98_000, 120, 'bomb'),
    turret(100_000, 60),
    turret(100_000, 180),
    lancer(104_000, 40),
    lancer(104_300, 100),
    lancer(104_600, 140),
    lancer(104_900, 200),
    ...kiteV(108_000, 80, [KITE_SHOT]),
    ...kiteV(109_000, 160, [KITE_SHOT]),
    turret(111_000, 120),

    // 1:56 - a quiet stretch, the warning, then the Stormcore
    { kind: 'warning', atMs: 116_000 },
    { kind: 'boss', atMs: 121_000 },
]);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Kites entering one after another at the same x; the last one carries `drop`. */
function kiteColumn(
    atMs: number, x: number, count: number, path: PathDef, patterns: readonly PatternDef[], drop?: ItemKind,
): SpawnEvent[] {
    const events: SpawnEvent[] = [];
    for (let i = 0; i < count; i++) {
        const isLast = i === count - 1;
        events.push({
            kind: 'spawn', atMs: atMs + i * KITE_GAP_MS, enemy: 'kite', x, path, patterns,
            ...(isLast && drop !== undefined ? { drop } : {}),
        });
    }
    return events;
}

/** Five kites in a V, flying straight down, the point first. */
function kiteV(atMs: number, centreX: number, patterns: readonly PatternDef[]): SpawnEvent[] {
    const events: SpawnEvent[] = [];
    for (let i = -2; i <= 2; i++) {
        events.push({
            kind: 'spawn', atMs: atMs + Math.abs(i) * 250, enemy: 'kite', x: centreX + i * 22,
            path: { kind: 'straight', speed: 55 }, patterns,
        });
    }
    return events;
}

function lancer(atMs: number, x: number): SpawnEvent {
    return {
        kind: 'spawn', atMs, enemy: 'lancer', x,
        path: { kind: 'dive', speed: 90, stopY: 70, holdMs: 1900, diveSpeed: 210 },
        patterns: [LANCER_STREAM],
    };
}

function turret(atMs: number, x: number): SpawnEvent {
    return { kind: 'spawn', atMs, enemy: 'turret', x, path: { kind: 'ground' }, patterns: [TURRET_FAN] };
}

function barge(atMs: number, x: number, drop: ItemKind): SpawnEvent {
    return {
        kind: 'spawn', atMs, enemy: 'barge', x, y: -24,
        path: { kind: 'straight', speed: 16 },
        patterns: [BARGE_RING, BARGE_SPIRAL],
        drop,
    };
}

function sortByTime(events: StageEvent[]): StageEvent[] {
    return events.sort((a, b) => a.atMs - b.atMs);
}
