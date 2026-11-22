// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * One world, and the pair of gears that turns it. Lengths are in the scene's
 * units, about a decimetre each, so the orrery would fit on a table.
 */
export interface WorldData {
    /** The length of its arm, from the central spindle to the rod it stands on. */
    readonly orbitRadius: number;
    /** Its own radius. */
    readonly radius: number;
    /** The teeth on its gear on the drive arbor, which turns its gear on the central spindle. */
    readonly driverTeeth: number;
    /** The teeth on its gear on the central spindle, which turns its tube and arm. */
    readonly tubeTeeth: number;
    /** How many times its moon goes round it in one of its years, if it has a moon. */
    readonly moonOrbitsPerYear?: number;
    /** Whether it wears a ring. */
    readonly hasRing?: boolean;
}

/**
 * How many teeth the two gears of every pair have between them. When all the
 * teeth are the same size, two gears that mesh sit as far apart as their
 * teeth add up to. So every pair fits the same gap between the drive arbor
 * and the central spindle.
 */
export const WORLD_PAIR_TEETH = 60;

/**
 * The worlds, nearest first. The system is made up. Each world's year comes
 * from its pair of gears alone. A small gear on the drive arbor turning a
 * large one on the world's tube makes a slow world.
 */
export const WORLDS: readonly WorldData[] = [
    { orbitRadius: 1.0, radius: 0.08, driverTeeth: 40, tubeTeeth: 20 },
    { orbitRadius: 1.45, radius: 0.12, driverTeeth: 33, tubeTeeth: 27 },
    { orbitRadius: 1.95, radius: 0.13, driverTeeth: 26, tubeTeeth: 34, moonOrbitsPerYear: 8 },
    { orbitRadius: 2.55, radius: 0.2, driverTeeth: 18, tubeTeeth: 42, hasRing: true },
    { orbitRadius: 3.2, radius: 0.16, driverTeeth: 12, tubeTeeth: 48 },
];

/** Which world the day count follows. It's the third, the one with a moon. */
export const HOME_WORLD = 2;

/** How many days the home world's year has. */
export const DAYS_PER_YEAR = 365;
