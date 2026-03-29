import { FORMATION_COLS } from './constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FormationSlot {
    readonly row: number;
    readonly col: number;
    readonly kind: EnemyKind;
}

export interface WaveConfig {
    readonly slots: readonly FormationSlot[];
    /** Milliseconds between dive attacks. */
    readonly diveInterval: number;
    /** Multiplier for dive animation speed (1 = normal, 2 = double). */
    readonly diveSpeedFactor: number;
    /** Probability (0–1) that a diving enemy fires a bullet. */
    readonly enemyFireChance: number;
}

// ---------------------------------------------------------------------------
// Wave Definitions
// ---------------------------------------------------------------------------

export const WAVES: readonly WaveConfig[] = [
    // Wave 1 - easy: 2 bosses, 2×4 butterflies, 1×10 bees = 20 total
    {
        slots: buildFormation(2, 2, 4, 1),
        diveInterval: 3000,
        diveSpeedFactor: 0.8,
        enemyFireChance: 0.2,
    },
    // Wave 2 - 4 bosses, 2×6 butterflies, 1×10 bees = 26 total
    {
        slots: buildFormation(4, 2, 6, 1),
        diveInterval: 2500,
        diveSpeedFactor: 1.0,
        enemyFireChance: 0.35,
    },
    // Wave 3 - 4 bosses, 2×8 butterflies, 2×10 bees = 40 total
    {
        slots: buildFormation(4, 2, 8, 2),
        diveInterval: 2000,
        diveSpeedFactor: 1.2,
        enemyFireChance: 0.45,
    },
    // Wave 4 - faster dives
    {
        slots: buildFormation(4, 2, 8, 2),
        diveInterval: 1600,
        diveSpeedFactor: 1.5,
        enemyFireChance: 0.55,
    },
    // Wave 5 - intense
    {
        slots: buildFormation(4, 2, 8, 2),
        diveInterval: 1200,
        diveSpeedFactor: 1.8,
        enemyFireChance: 0.65,
    },
];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type EnemyKind = 'boss' | 'butterfly' | 'bee';

function buildFormation(
    bossCount: number,
    butterflyRows: number,
    butterflyCols: number,
    beeRows: number,
): FormationSlot[] {
    const slots: FormationSlot[] = [];

    // Bosses - centred in row 0
    const bossStart = Math.floor((FORMATION_COLS - bossCount) / 2);
    for (let c = 0; c < bossCount; c++) {
        slots.push({ row: 0, col: bossStart + c, kind: 'boss' });
    }

    // Butterflies - centred rows starting at row 1
    const bfStart = Math.floor((FORMATION_COLS - butterflyCols) / 2);
    for (let r = 0; r < butterflyRows; r++) {
        for (let c = 0; c < butterflyCols; c++) {
            slots.push({ row: 1 + r, col: bfStart + c, kind: 'butterfly' });
        }
    }

    // Bees - full-width rows at the bottom
    const beeRowStart = 1 + butterflyRows;
    for (let r = 0; r < beeRows; r++) {
        for (let c = 0; c < FORMATION_COLS; c++) {
            slots.push({ row: beeRowStart + r, col: c, kind: 'bee' });
        }
    }

    return slots;
}
