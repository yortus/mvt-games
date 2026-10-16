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
    // Wave 1 - easy: 2 carriers, 2×4 strikers, 1×10 scouts = 20 total
    {
        slots: buildFormation(2, 2, 4, 1),
        diveInterval: 3000,
        diveSpeedFactor: 0.8,
        enemyFireChance: 0.2,
    },
    // Wave 2 - 4 carriers, 2×6 strikers, 1×10 scouts = 26 total
    {
        slots: buildFormation(4, 2, 6, 1),
        diveInterval: 2500,
        diveSpeedFactor: 1.0,
        enemyFireChance: 0.35,
    },
    // Wave 3 - 4 carriers, 2×8 strikers, 2×10 scouts = 40 total
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

type EnemyKind = 'carrier' | 'striker' | 'scout';

function buildFormation(
    carrierCount: number,
    strikerRows: number,
    strikerCols: number,
    scoutRows: number,
): FormationSlot[] {
    const slots: FormationSlot[] = [];

    // Carriers - centred in row 0
    const carrierStart = Math.floor((FORMATION_COLS - carrierCount) / 2);
    for (let c = 0; c < carrierCount; c++) {
        slots.push({ row: 0, col: carrierStart + c, kind: 'carrier' });
    }

    // Strikers - centred rows starting at row 1
    const strikerStart = Math.floor((FORMATION_COLS - strikerCols) / 2);
    for (let r = 0; r < strikerRows; r++) {
        for (let c = 0; c < strikerCols; c++) {
            slots.push({ row: 1 + r, col: strikerStart + c, kind: 'striker' });
        }
    }

    // Scouts - full-width rows at the bottom
    const scoutRowStart = 1 + strikerRows;
    for (let r = 0; r < scoutRows; r++) {
        for (let c = 0; c < FORMATION_COLS; c++) {
            slots.push({ row: scoutRowStart + r, col: c, kind: 'scout' });
        }
    }

    return slots;
}
