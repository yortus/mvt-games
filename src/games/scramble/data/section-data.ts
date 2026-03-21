// ---------------------------------------------------------------------------
// Spawn Kinds
// ---------------------------------------------------------------------------

export type SpawnKind = 'rocket' | 'ufo' | 'fuel-tank' | 'base';

// ---------------------------------------------------------------------------
// Spawn Entry
// ---------------------------------------------------------------------------

export interface SpawnEntry {
    /** Column within this section where the entity spawns. */
    readonly col: number;
    /** Row position for the entity. */
    readonly row: number;
    /** Kind of entity to spawn. */
    readonly kind: SpawnKind;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SectionProfile {
    /** Floor heights - tiles of solid ground from the bottom, one per column. */
    readonly floor: readonly number[];
    /** Ceiling heights - tiles of solid from the top, one per column. 0 = open. */
    readonly ceiling: readonly number[];
    /** Entity spawn list for this section. */
    readonly spawns: readonly SpawnEntry[];
}

// ---------------------------------------------------------------------------
// Section 1 - Mountains (100 columns)
// Open sky, rolling mountainous floor terrain.
// ---------------------------------------------------------------------------

const SECTION_1: SectionProfile = {
    floor: [
        2, 2, 3, 3, 3, 4, 4, 3, 3, 2,
        2, 1, 1, 2, 2, 3, 4, 5, 5, 5,
        4, 4, 3, 3, 2, 2, 1, 1, 2, 3,
        3, 4, 5, 5, 4, 4, 3, 2, 2, 1,
        1, 2, 3, 3, 4, 5, 5, 5, 4, 3,
        3, 2, 2, 1, 1, 2, 2, 3, 4, 5,
        5, 5, 4, 3, 2, 2, 1, 1, 2, 3,
        4, 4, 5, 5, 4, 3, 3, 2, 1, 1,
        2, 2, 3, 4, 5, 5, 4, 3, 2, 1,
        1, 2, 3, 4, 5, 5, 4, 3, 2, 2,
    ],
    ceiling: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    spawns: [
        // Rockets on hilltops
        { col: 15, row: 8, kind: 'rocket' },
        { col: 32, row: 8, kind: 'rocket' },
        { col: 45, row: 8, kind: 'rocket' },
        { col: 72, row: 8, kind: 'rocket' },
        { col: 85, row: 8, kind: 'rocket' },
        // UFOs cruising over mountains
        { col: 20, row: 4, kind: 'ufo' },
        { col: 50, row: 3, kind: 'ufo' },
        { col: 75, row: 5, kind: 'ufo' },
        // Fuel tanks on the ground
        { col: 25, row: 10, kind: 'fuel-tank' },
        { col: 55, row: 9, kind: 'fuel-tank' },
        { col: 90, row: 10, kind: 'fuel-tank' },
    ],
};

// ---------------------------------------------------------------------------
// Section 2 - Caves (100 columns)
// Both ceiling and floor terrain create enclosed cave passages.
// ---------------------------------------------------------------------------

const SECTION_2: SectionProfile = {
    floor: [
        3, 3, 4, 4, 5, 5, 4, 3, 3, 2,
        2, 3, 3, 4, 5, 5, 4, 3, 2, 2,
        3, 4, 4, 5, 5, 4, 3, 3, 2, 3,
        3, 4, 5, 5, 4, 3, 2, 2, 3, 4,
        5, 5, 4, 3, 2, 2, 3, 3, 4, 5,
        5, 4, 3, 2, 2, 3, 4, 5, 5, 4,
        3, 3, 2, 3, 3, 4, 5, 5, 4, 3,
        2, 2, 3, 4, 4, 5, 5, 4, 3, 2,
        2, 3, 4, 5, 5, 4, 3, 2, 2, 3,
        3, 4, 5, 5, 4, 3, 3, 2, 2, 3,
    ],
    ceiling: [
        0, 0, 0, 1, 1, 2, 2, 1, 1, 0,
        0, 0, 1, 1, 2, 3, 3, 2, 1, 0,
        0, 1, 1, 2, 2, 3, 3, 2, 1, 0,
        0, 0, 1, 2, 3, 3, 2, 1, 0, 0,
        1, 1, 2, 2, 3, 3, 2, 1, 1, 0,
        0, 1, 2, 3, 3, 2, 1, 0, 0, 1,
        1, 2, 2, 3, 3, 2, 1, 1, 0, 0,
        1, 2, 3, 3, 2, 1, 0, 0, 1, 1,
        2, 2, 3, 3, 2, 1, 1, 0, 0, 1,
        2, 3, 3, 2, 1, 0, 0, 1, 1, 2,
    ],
    spawns: [
        // Rockets in cave openings
        { col: 10, row: 7, kind: 'rocket' },
        { col: 30, row: 6, kind: 'rocket' },
        { col: 55, row: 7, kind: 'rocket' },
        { col: 75, row: 6, kind: 'rocket' },
        { col: 90, row: 7, kind: 'rocket' },
        // UFOs navigating caves
        { col: 18, row: 5, kind: 'ufo' },
        { col: 40, row: 6, kind: 'ufo' },
        { col: 65, row: 5, kind: 'ufo' },
        { col: 85, row: 6, kind: 'ufo' },
        // Fuel tanks on cave floor
        { col: 22, row: 8, kind: 'fuel-tank' },
        { col: 48, row: 7, kind: 'fuel-tank' },
        { col: 70, row: 8, kind: 'fuel-tank' },
        { col: 95, row: 7, kind: 'fuel-tank' },
    ],
};

// ---------------------------------------------------------------------------
// Section 3 - Base (80 columns)
// Tight passages approaching the enemy base.
// ---------------------------------------------------------------------------

const SECTION_3: SectionProfile = {
    floor: [
        3, 3, 4, 4, 5, 5, 4, 3, 3, 4,
        4, 5, 5, 4, 3, 3, 4, 5, 5, 4,
        3, 3, 4, 5, 5, 5, 4, 3, 3, 4,
        5, 5, 5, 4, 3, 3, 4, 5, 5, 4,
        3, 3, 4, 4, 5, 5, 5, 4, 3, 3,
        4, 5, 5, 5, 4, 3, 3, 4, 5, 5,
        4, 3, 3, 4, 5, 5, 5, 4, 3, 3,
        4, 5, 5, 5, 4, 4, 3, 3, 4, 5,
    ],
    ceiling: [
        0, 0, 1, 1, 2, 3, 3, 2, 1, 1,
        2, 2, 3, 3, 2, 1, 1, 2, 3, 3,
        2, 1, 1, 2, 3, 3, 3, 2, 1, 1,
        2, 3, 3, 3, 2, 1, 1, 2, 3, 3,
        2, 1, 1, 2, 3, 3, 3, 3, 2, 1,
        1, 2, 3, 3, 3, 2, 1, 1, 2, 3,
        3, 2, 1, 1, 2, 3, 3, 3, 2, 1,
        1, 2, 3, 3, 3, 3, 2, 1, 1, 2,
    ],
    spawns: [
        // Dense rockets in tight passages
        { col: 8, row: 6, kind: 'rocket' },
        { col: 18, row: 7, kind: 'rocket' },
        { col: 28, row: 6, kind: 'rocket' },
        { col: 38, row: 7, kind: 'rocket' },
        { col: 50, row: 6, kind: 'rocket' },
        { col: 60, row: 7, kind: 'rocket' },
        // UFOs in the approach
        { col: 15, row: 5, kind: 'ufo' },
        { col: 35, row: 4, kind: 'ufo' },
        { col: 55, row: 5, kind: 'ufo' },
        // Fuel tanks - scarce near the base
        { col: 20, row: 7, kind: 'fuel-tank' },
        { col: 45, row: 8, kind: 'fuel-tank' },
        // Base target - must be bombed to complete the loop
        { col: 76, row: 8, kind: 'base' },
    ],
};

// ---------------------------------------------------------------------------
// Sections Array
// ---------------------------------------------------------------------------

export const SECTIONS: readonly SectionProfile[] = [SECTION_1, SECTION_2, SECTION_3];
