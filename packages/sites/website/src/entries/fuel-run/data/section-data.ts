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
// Open sky, rolling mountainous floor terrain. Rockets in tight clumps with
// gaps, multiple fuel tanks, and waves of UFOs.
// ---------------------------------------------------------------------------

const SECTION_1: SectionProfile = {
    floor: [
        2, 2, 3, 3, 3, 4, 4, 3, 3, 2,
        2, 1, 1, 2, 2, 3, 4, 5, 5, 5,
        4, 4, 3, 3, 2, 2, 1, 1, 2, 3,
        3, 4, 5, 6, 5, 4, 3, 2, 2, 1,
        1, 2, 3, 3, 4, 5, 6, 6, 5, 4,
        3, 2, 2, 1, 1, 2, 2, 3, 4, 5,
        6, 6, 5, 4, 3, 2, 1, 1, 2, 3,
        4, 4, 5, 6, 5, 4, 3, 2, 1, 1,
        2, 2, 3, 4, 5, 6, 5, 4, 3, 2,
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
        // Rocket cluster 1 - hilltop group
        { col: 12, row: 8, kind: 'rocket' },
        { col: 14, row: 8, kind: 'rocket' },
        { col: 16, row: 8, kind: 'rocket' },
        // Fuel group 1
        { col: 20, row: 10, kind: 'fuel-tank' },
        { col: 22, row: 10, kind: 'fuel-tank' },
        // UFO pair
        { col: 24, row: 4, kind: 'ufo' },
        { col: 26, row: 5, kind: 'ufo' },
        // Rocket cluster 2 - tall peak group
        { col: 32, row: 8, kind: 'rocket' },
        { col: 34, row: 8, kind: 'rocket' },
        { col: 36, row: 8, kind: 'rocket' },
        { col: 38, row: 8, kind: 'rocket' },
        // UFO
        { col: 42, row: 3, kind: 'ufo' },
        // Rocket cluster 3 - mid-section
        { col: 46, row: 8, kind: 'rocket' },
        { col: 48, row: 8, kind: 'rocket' },
        { col: 50, row: 8, kind: 'rocket' },
        // Fuel group 2
        { col: 54, row: 9, kind: 'fuel-tank' },
        { col: 56, row: 9, kind: 'fuel-tank' },
        // UFO pair
        { col: 58, row: 4, kind: 'ufo' },
        { col: 60, row: 6, kind: 'ufo' },
        // Rocket cluster 4 - valley approach
        { col: 68, row: 8, kind: 'rocket' },
        { col: 70, row: 8, kind: 'rocket' },
        { col: 72, row: 8, kind: 'rocket' },
        // UFO
        { col: 76, row: 5, kind: 'ufo' },
        // Rocket cluster 5 - end stretch
        { col: 82, row: 8, kind: 'rocket' },
        { col: 84, row: 8, kind: 'rocket' },
        { col: 86, row: 8, kind: 'rocket' },
        // Fuel group 3
        { col: 90, row: 10, kind: 'fuel-tank' },
        { col: 92, row: 10, kind: 'fuel-tank' },
        // UFO pair - end
        { col: 94, row: 3, kind: 'ufo' },
        { col: 96, row: 5, kind: 'ufo' },
    ],
};

// ---------------------------------------------------------------------------
// Section 2 - Caves (100 columns)
// Both ceiling and floor create enclosed cave passages. Narrow maze-like gaps
// force careful navigation. Heavy rocket and UFO presence.
// ---------------------------------------------------------------------------

const SECTION_2: SectionProfile = {
    // Gap = 14 - floor - ceiling. Tightest spots: 14 - 7 - 4 = 3 tiles.
    floor: [
        3, 3, 4, 4, 5, 5, 4, 3, 3, 2,
        3, 4, 5, 6, 6, 5, 4, 3, 3, 4,
        5, 6, 6, 7, 6, 5, 4, 3, 3, 4,
        5, 6, 7, 6, 5, 4, 3, 3, 4, 5,
        6, 7, 6, 5, 4, 3, 3, 4, 5, 6,
        7, 7, 6, 5, 4, 3, 3, 4, 5, 6,
        7, 7, 6, 5, 4, 3, 3, 4, 5, 6,
        7, 6, 5, 4, 3, 3, 4, 5, 6, 7,
        7, 6, 5, 4, 3, 3, 4, 5, 6, 7,
        6, 5, 4, 3, 3, 4, 5, 6, 5, 4,
    ],
    ceiling: [
        0, 0, 1, 1, 2, 2, 1, 0, 0, 0,
        1, 2, 3, 3, 3, 2, 1, 0, 0, 1,
        2, 3, 3, 4, 3, 2, 1, 0, 0, 1,
        2, 3, 4, 3, 2, 1, 0, 0, 1, 2,
        3, 4, 3, 2, 1, 0, 0, 1, 2, 3,
        4, 4, 3, 2, 1, 0, 0, 1, 2, 3,
        4, 4, 3, 2, 1, 0, 0, 1, 2, 3,
        4, 3, 2, 1, 0, 0, 1, 2, 3, 4,
        4, 3, 2, 1, 0, 0, 1, 2, 3, 4,
        3, 2, 1, 0, 0, 1, 2, 3, 2, 1,
    ],
    spawns: [
        // Rocket cluster 1 - cave entrance
        { col: 8, row: 7, kind: 'rocket' },
        { col: 10, row: 7, kind: 'rocket' },
        { col: 12, row: 7, kind: 'rocket' },
        // UFO pair in cave opening
        { col: 16, row: 5, kind: 'ufo' },
        { col: 18, row: 6, kind: 'ufo' },
        // Fuel group 1
        { col: 21, row: 8, kind: 'fuel-tank' },
        { col: 23, row: 8, kind: 'fuel-tank' },
        // Rocket cluster 2 - narrow section
        { col: 28, row: 6, kind: 'rocket' },
        { col: 30, row: 6, kind: 'rocket' },
        { col: 32, row: 6, kind: 'rocket' },
        { col: 34, row: 6, kind: 'rocket' },
        // UFO in tight passage
        { col: 38, row: 5, kind: 'ufo' },
        // Rocket cluster 3
        { col: 42, row: 7, kind: 'rocket' },
        { col: 44, row: 7, kind: 'rocket' },
        { col: 46, row: 7, kind: 'rocket' },
        // Fuel group 2
        { col: 50, row: 7, kind: 'fuel-tank' },
        { col: 52, row: 7, kind: 'fuel-tank' },
        // UFO pair
        { col: 55, row: 5, kind: 'ufo' },
        { col: 57, row: 6, kind: 'ufo' },
        // Rocket cluster 4 - deep cave
        { col: 62, row: 6, kind: 'rocket' },
        { col: 64, row: 6, kind: 'rocket' },
        { col: 66, row: 6, kind: 'rocket' },
        // Fuel
        { col: 70, row: 8, kind: 'fuel-tank' },
        // UFO
        { col: 73, row: 5, kind: 'ufo' },
        // Rocket cluster 5 - exit gauntlet
        { col: 78, row: 7, kind: 'rocket' },
        { col: 80, row: 7, kind: 'rocket' },
        { col: 82, row: 7, kind: 'rocket' },
        { col: 84, row: 7, kind: 'rocket' },
        // UFO pair
        { col: 87, row: 5, kind: 'ufo' },
        { col: 89, row: 6, kind: 'ufo' },
        // Fuel group 3
        { col: 93, row: 7, kind: 'fuel-tank' },
        { col: 95, row: 7, kind: 'fuel-tank' },
    ],
};

// ---------------------------------------------------------------------------
// Section 3 - Base (80 columns)
// Extremely tight passages leading to the enemy base. Dense enemy placement.
// Player must bomb the base at the end to complete the loop.
// ---------------------------------------------------------------------------

const SECTION_3: SectionProfile = {
    // Gap = 14 - floor - ceiling. Tightest spots: 14 - 7 - 4 = 3 tiles.
    // Cols 62+ open into a base chamber (low floor, no ceiling) so the
    // player can fly over and bomb the base.
    floor: [
        3, 4, 5, 5, 6, 6, 5, 4, 4, 5,
        6, 7, 7, 6, 5, 5, 6, 7, 7, 6,
        5, 5, 6, 7, 7, 7, 6, 5, 5, 6,
        7, 7, 7, 6, 5, 5, 6, 7, 7, 6,
        5, 5, 6, 7, 7, 7, 7, 6, 5, 5,
        6, 7, 7, 7, 6, 5, 5, 6, 7, 7,
        6, 5, 4, 3, 3, 3, 3, 3, 3, 3,
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    ],
    ceiling: [
        0, 1, 2, 2, 3, 3, 2, 1, 1, 2,
        3, 4, 4, 3, 2, 2, 3, 4, 4, 3,
        2, 2, 3, 4, 4, 4, 3, 2, 2, 3,
        4, 4, 4, 3, 2, 2, 3, 4, 4, 3,
        2, 2, 3, 4, 4, 4, 4, 3, 2, 2,
        3, 4, 4, 4, 3, 2, 2, 3, 4, 4,
        3, 2, 1, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    spawns: [
        // Rocket cluster 1 - entrance gauntlet
        { col: 5, row: 6, kind: 'rocket' },
        { col: 7, row: 6, kind: 'rocket' },
        { col: 9, row: 6, kind: 'rocket' },
        // UFO pair
        { col: 12, row: 5, kind: 'ufo' },
        { col: 14, row: 4, kind: 'ufo' },
        // Rocket cluster 2 - narrow squeeze
        { col: 18, row: 6, kind: 'rocket' },
        { col: 20, row: 6, kind: 'rocket' },
        { col: 22, row: 6, kind: 'rocket' },
        { col: 24, row: 6, kind: 'rocket' },
        // Fuel - scarce
        { col: 27, row: 7, kind: 'fuel-tank' },
        // UFO
        { col: 30, row: 5, kind: 'ufo' },
        // Rocket cluster 3
        { col: 33, row: 6, kind: 'rocket' },
        { col: 35, row: 6, kind: 'rocket' },
        { col: 37, row: 6, kind: 'rocket' },
        // UFO pair
        { col: 40, row: 4, kind: 'ufo' },
        { col: 42, row: 5, kind: 'ufo' },
        // Rocket cluster 4 - deep passage
        { col: 46, row: 6, kind: 'rocket' },
        { col: 48, row: 6, kind: 'rocket' },
        { col: 50, row: 6, kind: 'rocket' },
        // Fuel
        { col: 53, row: 7, kind: 'fuel-tank' },
        // Rocket cluster 5 - final approach before base
        { col: 56, row: 6, kind: 'rocket' },
        { col: 58, row: 6, kind: 'rocket' },
        { col: 60, row: 6, kind: 'rocket' },
        // Base target in the open chamber - bomb it to complete the loop
        { col: 66, row: 8, kind: 'base' },
    ],
};

// ---------------------------------------------------------------------------
// Sections Array
// ---------------------------------------------------------------------------

export const SECTIONS: readonly SectionProfile[] = [SECTION_1, SECTION_2, SECTION_3];
