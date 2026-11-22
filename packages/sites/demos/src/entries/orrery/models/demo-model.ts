import {
    CRANK_PINION_TEETH, DAYS_PER_YEAR, DRIVE_WHEEL_TEETH, HOME_WORLD, MAX_TURNS_PER_SECOND, SETTLE_MS,
    STARTING_TURNS_PER_SECOND, WORLDS,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A mechanical orrery. A crank turns a drive arbor, a vertical shaft whose
 * gears turn a tube for each world round the central spindle. Each tube
 * carries an arm with its world on the end. A clockwork motor turns the
 * crank, at a speed the visitor sets, forward or back.
 *
 * The crank's angle is the only one that moves. Every other comes from it
 * through the gears' teeth, so they always mesh.
 *
 * Angles are in radians, counterclockwise seen from above, and grow without
 * wrapping, so each gear's angle is an exact multiple of the crank's.
 */
export interface DemoModel {
    /**
     * How fast the motor is set to turn the crank, in turns a second,
     * negative to turn it backwards. Setting it beyond `MAX_TURNS_PER_SECOND`
     * either way sets it to the limit. The crank speeds up or slows down to
     * match it over a moment.
     */
    motorTurnsPerSecond: number;
    /** How far the crank has turned. */
    readonly crankAngle: number;
    /** How fast the crank is turning now, in turns a second, negative when it turns backwards. */
    readonly crankTurnsPerSecond: number;
    /** How far the drive arbor has turned. It turns the opposite way to the crank. */
    readonly driveAngle: number;
    /** The worlds, nearest first, in `WORLDS`'s order. */
    readonly worlds: readonly WorldModel[];
    /** How many days have passed on the home world since the arms were lined up at the start, a fraction included. It's negative before then. */
    readonly days: number;
    /** How many days pass on the home world each second at the crank's speed now, negative when time runs backwards. */
    readonly daysPerSecond: number;
    /** How many teeth of the crank's pinion have passed, either way. */
    readonly teethPassed: number;
    /** Moves the crank on by `deltaMs` of time. */
    readonly update: (deltaMs: number) => void;
}

/** One world on its arm. */
export interface WorldModel {
    /** How far its arm has turned round the central spindle. */
    readonly orbitAngle: number;
    /** How far its moon has gone round it, measured from the same direction as `orbitAngle`. It's 0 for a world without a moon. */
    readonly moonAngle: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the orrery, with every arm lined up, and the motor turning the crank at its starting speed. */
export function createDemoModel(): DemoModel {
    let motorTurnsPerSecond = STARTING_TURNS_PER_SECOND;
    let crankAngle = 0;
    let crankVelocity = toVelocity(STARTING_TURNS_PER_SECOND);
    let teethPassed = 0;
    let lastTooth = 0;

    const worlds: WorldModel[] = [];
    // How far each world's arm turns for each turn of the crank
    const turnsPerCrankTurns: number[] = [];
    for (let i = 0; i < WORLDS.length; i++) {
        const { driverTeeth, tubeTeeth, moonOrbitsPerYear = 0 } = WORLDS[i];
        // The drive arbor turns against the crank, and each tube against the drive arbor
        const turnsPerCrankTurn = DRIVE_PER_CRANK * (-driverTeeth / tubeTeeth);
        turnsPerCrankTurns.push(turnsPerCrankTurn);
        worlds.push({
            get orbitAngle() {
                return crankAngle * turnsPerCrankTurn;
            },
            get moonAngle() {
                return crankAngle * turnsPerCrankTurn * moonOrbitsPerYear;
            },
        });
    }
    const homeWorld = worlds[HOME_WORLD];
    const daysPerCrankTurn = turnsPerCrankTurns[HOME_WORLD] * DAYS_PER_YEAR;

    return {
        get motorTurnsPerSecond() {
            return motorTurnsPerSecond;
        },
        set motorTurnsPerSecond(value) {
            motorTurnsPerSecond = Math.max(-MAX_TURNS_PER_SECOND, Math.min(MAX_TURNS_PER_SECOND, value));
        },
        get crankAngle() {
            return crankAngle;
        },
        get crankTurnsPerSecond() {
            return (crankVelocity * 1000) / TAU;
        },
        get driveAngle() {
            return crankAngle * DRIVE_PER_CRANK;
        },
        worlds,
        get days() {
            return (homeWorld.orbitAngle / TAU) * DAYS_PER_YEAR;
        },
        get daysPerSecond() {
            return ((crankVelocity * 1000) / TAU) * daysPerCrankTurn;
        },
        get teethPassed() {
            return teethPassed;
        },
        update(deltaMs) {
            if (deltaMs <= 0) return;
            // The speed closes on the motor's exponentially, and the angle moves by its integral,
            // so the crank lands in the same place whatever size the steps are
            const target = toVelocity(motorTurnsPerSecond);
            const decay = Math.exp(-deltaMs / SETTLE_MS);
            const gap = crankVelocity - target;
            crankAngle += target * deltaMs + gap * SETTLE_MS * (1 - decay);
            crankVelocity = target + gap * decay;
            countTeeth();
        },
    };

    /** Adds the teeth passed since the last count, either way. */
    function countTeeth(): void {
        const tooth = Math.floor(crankAngle / TOOTH_ANGLE);
        teethPassed += Math.abs(tooth - lastTooth);
        lastTooth = tooth;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/** How far the drive arbor turns for each turn of the crank. It's negative, because meshing gears turn opposite ways. */
const DRIVE_PER_CRANK = -CRANK_PINION_TEETH / DRIVE_WHEEL_TEETH;

/** The angle between two of the crank pinion's teeth. */
const TOOTH_ANGLE = TAU / CRANK_PINION_TEETH;

/** Converts turns a second to radians a millisecond, the units speeds are kept in inside the model. */
function toVelocity(turnsPerSecond: number): number {
    return (turnsPerSecond * TAU) / 1000;
}
