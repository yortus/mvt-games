/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D } from '@pixi/3d';
import { CRANK_PINION_TEETH, DRIVE_WHEEL_TEETH, WORLDS } from '../data';
import { createGearGeometry } from './gear-geometry';
import {
    BRIDGE_Y, computeWorldGearY, CRANK_ARM_Y, CRANK_GEAR_Y, CRANK_HANDLE_LENGTH, CRANK_KNOB_RADIUS, CRANK_X, CRANK_Z,
    DRIVE_PHASE, DRIVE_X, DRIVE_Z, GEAR_MODULE, GEAR_THICKNESS, PLATE_TOP,
} from './layout';
import type { OrreryParts } from './orrery-parts';
import { RodView } from './rod-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GearTrainViewBindings {
    /** How far the crank has turned, in radians. */
    readonly crankAngle: () => number;
    /** How far the drive arbor has turned, in radians. */
    readonly driveAngle: () => number;
    /** What the orrery is made of. */
    readonly parts: OrreryParts;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The crank and the drive arbor. The crank's arbor carries a pinion, a small
 * gear, that turns the drive wheel at the foot of the drive arbor. Above the
 * drive wheel, the drive arbor carries one gear for each world, which turns
 * that world's tube round the central spindle.
 *
 * Each arbor is a group that turns by its angle. Each gear on it is turned
 * once more, by a fixed phase, so its teeth fall between those of the gear
 * it meshes with.
 */
export function GearTrainView(bindings: GearTrainViewBindings): Container3D {
    const { crankAngle, driveAngle, parts } = bindings;
    const { cylinder, sphere, cube, brass, steel, wood } = parts;
    const pinion = createGearGeometry({ teeth: CRANK_PINION_TEETH, module: GEAR_MODULE, thickness: GEAR_THICKNESS, boreRadius: ARBOR_RADIUS });
    const driveWheel = createGearGeometry({ teeth: DRIVE_WHEEL_TEETH, module: GEAR_MODULE, thickness: GEAR_THICKNESS, boreRadius: ARBOR_RADIUS });
    // The drive arbor has one gear for each world, and each gear has that world's own number of teeth
    const worldGears = WORLDS.map((world) => createGearGeometry({
        teeth: world.driverTeeth,
        module: GEAR_MODULE,
        thickness: GEAR_THICKNESS,
        boreRadius: ARBOR_RADIUS,
    }));

    return (
        <group owns={[pinion, driveWheel, ...worldGears]}>
            <group x={CRANK_X} z={CRANK_Z} rotationY={crankAngle}>
                <RodView cylinder={cylinder} material={steel} radius={ARBOR_RADIUS} bottom={PLATE_TOP} top={CRANK_ARM_Y} />
                <mesh geometry={pinion} material={brass} y={CRANK_GEAR_Y} />
                <RodView cylinder={cylinder} material={brass} radius={0.04} bottom={CRANK_ARM_Y - 0.03} top={CRANK_ARM_Y + 0.012} />
                <mesh geometry={cube} material={brass} x={CRANK_LENGTH / 2} y={CRANK_ARM_Y} scaleX={CRANK_LENGTH + 0.06} scaleY={0.024} scaleZ={0.05} />
                <RodView cylinder={cylinder} material={wood} radius={0.032} bottom={CRANK_ARM_Y} top={CRANK_ARM_Y + CRANK_HANDLE_LENGTH} x={CRANK_LENGTH} />
                <mesh geometry={sphere} material={wood} x={CRANK_LENGTH} y={CRANK_ARM_Y + CRANK_HANDLE_LENGTH} scale={CRANK_KNOB_RADIUS} />
            </group>
            <group x={DRIVE_X} z={DRIVE_Z} rotationY={driveAngle}>
                <RodView cylinder={cylinder} material={steel} radius={ARBOR_RADIUS} bottom={PLATE_TOP} top={BRIDGE_Y + 0.04} />
                <mesh geometry={driveWheel} material={brass} y={CRANK_GEAR_Y} rotationY={DRIVE_PHASE} />
                {worldGears.map((gear, i) => (
                    <mesh geometry={gear} material={brass} y={computeWorldGearY(i)} rotationY={DRIVE_PHASE} />
                ))}
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The radius of the crank's arbor and the drive arbor. */
const ARBOR_RADIUS = 0.018;

/** How far the crank's handle stands from its arbor. */
const CRANK_LENGTH = 0.32;
