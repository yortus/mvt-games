import { CRANK_PINION_TEETH, DRIVE_WHEEL_TEETH, WORLD_PAIR_TEETH, WORLDS } from '../data';

// Where the orrery's parts sit, in the scene's units, shared by the views
// that draw them. The plinth's top is at y = 0, and the central spindle
// stands on the y axis. Angles are in radians, counterclockwise seen from
// above, the way PixiJS 3D's `rotation.y` turns. A direction at angle `a`
// points along (cos a, 0, -sin a).

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** How much each tooth adds to a gear's pitch circle's diameter, where two gears that mesh touch. Every gear's teeth are this size. */
export const GEAR_MODULE = 0.024;

/** How far the drive arbor stands from the central spindle, which every pair of gears spans. */
export const ARBOR_GAP = (GEAR_MODULE * WORLD_PAIR_TEETH) / 2;

/** How thick every gear is. */
export const GEAR_THICKNESS = 0.035;

/** The top of the plate on the plinth, which the arbors stand on. */
export const PLATE_TOP = 0.03;

/** The height of the middle of the gears that the crank turns, the lowest. */
export const CRANK_GEAR_Y = 0.1;

/** The height of the middle of world `index`'s pair of gears. The nearest world's are lowest, so its tube can run up inside the others. */
export function computeWorldGearY(index: number): number {
    return 0.18 + index * 0.08;
}

/** The height of world `index`'s arm. The nearest world's is highest, so the other arms pass under its rod. */
export function computeArmY(index: number): number {
    return 1.3 - index * 0.1;
}

/** The radius of world `index`'s tube. The nearest world's is the thinnest, inside the rest. */
export function computeTubeRadius(index: number): number {
    return 0.04 + index * 0.018;
}

/** The radius of the fixed central spindle, inside every tube, which holds up the sun. */
export const SPINDLE_RADIUS = 0.022;

/** The height of the sun's centre. Every world stands on its rod at this height too. */
export const SUN_Y = 1.65;

/** The sun's radius. */
export const SUN_RADIUS = 0.26;

/** The direction of the drive arbor from the central spindle, to the front and right. */
export const DRIVE_DIRECTION = -Math.PI / 3;

/** Where the drive arbor stands. */
export const DRIVE_X = ARBOR_GAP * Math.cos(DRIVE_DIRECTION);
export const DRIVE_Z = -ARBOR_GAP * Math.sin(DRIVE_DIRECTION);

/** The direction of the crank's arbor from the drive arbor, across the front, nearest the visitor. */
export const CRANK_DIRECTION = DRIVE_DIRECTION - Math.PI / 2;

/** Where the crank's arbor stands, which its pinion and the drive wheel span. */
export const CRANK_X = DRIVE_X + ARBOR_GAP * Math.cos(CRANK_DIRECTION);
export const CRANK_Z = DRIVE_Z - ARBOR_GAP * Math.sin(CRANK_DIRECTION);

/** How thick each world's arm is. */
export const ARM_THICKNESS = 0.022;

/** How tall the crank's handle stands above its arm, and the radius of the knob on its top. */
export const CRANK_HANDLE_LENGTH = 0.16;
export const CRANK_KNOB_RADIUS = 0.042;

/**
 * The height of the crank's arm. The lowest world's arm sweeps over the
 * crank as it goes round, so the crank sits low enough for the top of its
 * knob to pass under that arm with a little room to spare.
 */
export const CRANK_ARM_Y = computeArmY(WORLDS.length - 1) - ARM_THICKNESS / 2 - CRANK_KNOB_RADIUS - CRANK_HANDLE_LENGTH - 0.03;

/** The height of the bridge's underside, the bar over the gears that holds the drive arbor's top. */
export const BRIDGE_Y = computeWorldGearY(WORLDS.length - 1) + GEAR_THICKNESS;

/** How far the bridge's pillar stands from the central spindle, along the drive arbor's direction, clear of every gear. */
export const PILLAR_DISTANCE = 1.27;

/** The radius of the plate. The plinth is a little wider. */
export const PLATE_RADIUS = 1.4;

export interface MeshPhaseOptions {
    /** The teeth on the gear that drives. */
    readonly driverTeeth: number;
    /** The teeth on the gear it drives. */
    readonly drivenTeeth: number;
    /** The driven gear's direction from the driver. */
    readonly direction: number;
    /** The driver's own fixed turn on its arbor. */
    readonly driverPhase: number;
}

/**
 * Returns how far to turn a gear on its arbor, once, so its teeth fall
 * between the teeth of the gear that drives it. Each gear's first tooth
 * points along its arbor's angle. The arbors turn by angles in the ratio of
 * their teeth, so this one fixed turn keeps the gears in mesh from then on.
 */
export function computeMeshPhase(options: MeshPhaseOptions): number {
    const { driverTeeth, drivenTeeth, direction, driverPhase } = options;
    // Where the two pitch circles touch, the driver's teeth and the driven gear's gaps
    // move together, so a tooth of one meets a gap in the other, half a tooth from its own
    return direction + Math.PI - Math.PI / drivenTeeth + (driverTeeth / drivenTeeth) * (direction - driverPhase);
}

/** The fixed turn of every gear on the drive arbor, so the drive wheel meshes with the crank's pinion. See `computeMeshPhase`. */
export const DRIVE_PHASE = computeMeshPhase({
    driverTeeth: CRANK_PINION_TEETH,
    drivenTeeth: DRIVE_WHEEL_TEETH,
    direction: CRANK_DIRECTION + Math.PI,
    driverPhase: 0,
});
