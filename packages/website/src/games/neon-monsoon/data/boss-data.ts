import type { PatternDef } from './pattern-data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The Stormcore's three attacks, in order. */
export type BossAttackKind = 'squall' | 'cyclone' | 'downpour';

/**
 * One of the boss's attacks. Each has its own health and time limit: the
 * attack is broken when its health runs out, and ends without its bonus when
 * its time does.
 */
export interface BossAttackDef {
    readonly kind: BossAttackKind;
    readonly health: number;
    readonly timeLimitMs: number;
    /** How far the boss sways either side of the centre while attacking. */
    readonly swayX: number;
    readonly swayPeriodMs: number;
    /** Every pattern fires at once, for the whole attack. */
    readonly patterns: readonly PatternDef[];
}

// ---------------------------------------------------------------------------
// The Stormcore
// ---------------------------------------------------------------------------

export const BOSS_ATTACKS: readonly BossAttackDef[] = [
    {
        // Rings of orbs, with aimed needle fans fired between them.
        kind: 'squall',
        health: 900,
        timeLimitMs: 40_000,
        swayX: 40,
        swayPeriodMs: 6000,
        patterns: [
            {
                kind: 'ring', count: 28, spinPerVolleyDeg: 6.4,
                bullet: 'orb-red', motion: { speed: 62 },
                intervalMs: 900,
            },
            {
                kind: 'fan', count: 5, spreadDeg: 32, isAimed: true,
                bullet: 'needle-orange', motion: { speed: 140 },
                intervalMs: 900, delayMs: 450, offsetY: 14,
            },
        ],
    },
    {
        // Two spirals turning opposite ways, and aimed streams from the side cannons.
        kind: 'cyclone',
        health: 1100,
        timeLimitMs: 45_000,
        swayX: 20,
        swayPeriodMs: 9000,
        patterns: [
            {
                kind: 'ring', count: 4, spinPerVolleyDeg: 11,
                bullet: 'pellet-red', motion: { speed: 78 },
                intervalMs: 70,
            },
            {
                kind: 'ring', count: 4, spinPerVolleyDeg: -7,
                bullet: 'pellet-gold', motion: { speed: 64 },
                intervalMs: 90,
            },
            {
                kind: 'stream', burst: 5, burstGapMs: 80, isAimed: true,
                bullet: 'needle-orange', motion: { speed: 160 },
                intervalMs: 1800, delayMs: 1200, offsetX: -40, offsetY: 10,
            },
            {
                kind: 'stream', burst: 5, burstGapMs: 80, isAimed: true,
                bullet: 'needle-orange', motion: { speed: 160 },
                intervalMs: 1800, delayMs: 2100, offsetX: 40, offsetY: 10,
            },
        ],
    },
    {
        // Curving rain with a drifting gap to stand in, under a fast spiral.
        kind: 'downpour',
        health: 1300,
        timeLimitMs: 50_000,
        swayX: 60,
        swayPeriodMs: 12_000,
        patterns: [
            {
                kind: 'rain', lanes: 22, gapLanes: 4, gapDriftPerVolley: 1,
                bullet: 'rain', motion: { speed: 30, endSpeed: 105, accel: 70, turnDegPerSec: 14, turnMs: 1800 },
                intervalMs: 300,
            },
            {
                kind: 'ring', count: 3, spinPerVolleyDeg: 23,
                bullet: 'pellet-red', motion: { speed: 105 },
                intervalMs: 60, delayMs: 2000,
            },
            {
                kind: 'ring', count: 20, spinPerVolleyDeg: 9,
                bullet: 'orb-amber', motion: { speed: 45 },
                intervalMs: 2600, delayMs: 3000,
            },
        ],
    },
];
