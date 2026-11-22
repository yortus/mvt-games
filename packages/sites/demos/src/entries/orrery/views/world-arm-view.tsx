/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, Material3D, TorusGeometry } from '@pixi/3d';
import type { WorldData } from '../data';
import { createGearGeometry } from './gear-geometry';
import {
    ARM_THICKNESS, computeArmY, computeMeshPhase, computeTubeRadius, computeWorldGearY, DRIVE_DIRECTION, DRIVE_PHASE, GEAR_MODULE,
    GEAR_THICKNESS, SUN_Y,
} from './layout';
import type { OrreryParts } from './orrery-parts';
import { RodView } from './rod-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WorldArmViewBindings {
    /** Which world it is, nearest first. It sets the heights of the world's gear and arm, and its tube's width. */
    readonly index: number;
    /** The world's size and gears. */
    readonly world: WorldData;
    /** The world's surface colour. */
    readonly color: number;
    /** How far its arm has turned round the central spindle, in radians. */
    readonly orbitAngle: () => number;
    /** How far its moon has gone round it, in radians, from the same direction as `orbitAngle`. Read only for a world with a moon. */
    readonly moonAngle: () => number;
    /** What the orrery is made of. */
    readonly parts: OrreryParts;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One world's tube, turning round the central spindle, with everything it
 * carries. At its foot is the gear that the drive arbor turns, and at its top
 * is the arm. The arm carries a counterweight on its short end and a rod on
 * its long end, with the world on top of the rod. A world with a moon carries
 * it on a small arm of its own, and a world with a ring wears it tilted.
 */
export function WorldArmView(bindings: WorldArmViewBindings): Container3D {
    const { index, world, color, orbitAngle, moonAngle, parts } = bindings;
    const { orbitRadius, radius, driverTeeth, tubeTeeth } = world;
    const { cylinder, sphere, cube, brass, darkBrass, steel } = parts;
    const gear = createGearGeometry({ teeth: tubeTeeth, module: GEAR_MODULE, thickness: GEAR_THICKNESS, boreRadius: computeTubeRadius(index) });
    // The tube's gear is driven from the drive arbor's side
    const gearPhase = computeMeshPhase({ driverTeeth, drivenTeeth: tubeTeeth, direction: DRIVE_DIRECTION + Math.PI, driverPhase: DRIVE_PHASE });
    const surface = new Material3D({ baseColor: color, roughness: 0.75 });
    const y = computeArmY(index);

    return (
        <group rotationY={orbitAngle} owns={[gear, surface]}>
            <mesh geometry={gear} material={brass} y={computeWorldGearY(index)} rotationY={gearPhase} />
            <RodView cylinder={cylinder} material={brass} radius={computeTubeRadius(index)} bottom={computeWorldGearY(index)} top={y} />
            <RodView cylinder={cylinder} material={brass} radius={computeTubeRadius(index) + 0.025} bottom={y - 0.04} top={y + 0.014} />
            <mesh
                geometry={cube}
                material={brass}
                x={(orbitRadius - COUNTERWEIGHT_REACH) / 2}
                y={y}
                scaleX={orbitRadius + COUNTERWEIGHT_REACH}
                scaleY={ARM_THICKNESS}
                scaleZ={0.034}
            />
            <mesh geometry={sphere} material={darkBrass} x={-COUNTERWEIGHT_REACH} y={y} scale={0.045} />
            <RodView cylinder={cylinder} material={steel} radius={0.011} bottom={y} top={SUN_Y} x={orbitRadius} />
            <mesh geometry={sphere} material={surface} x={orbitRadius} y={SUN_Y} scale={radius} />
            {world.hasRing === true ? <RingView orbitRadius={orbitRadius} worldRadius={radius} /> : undefined}
            {world.moonOrbitsPerYear === undefined
                ? undefined
                : <MoonView orbitRadius={orbitRadius} worldRadius={radius} orbitAngle={orbitAngle} moonAngle={moonAngle} parts={parts} />}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the arm reaches past the central spindle, on the counterweight's side. */
const COUNTERWEIGHT_REACH = 0.28;

/** How far the moon stands from its world. */
const MOON_DISTANCE = 0.27;

/** The moon's radius. */
const MOON_RADIUS = 0.035;

interface RingViewBindings {
    /** The length of the world's arm. */
    readonly orbitRadius: number;
    /** The world's own radius, which the ring's size follows. */
    readonly worldRadius: number;
}

/** A flat ring round a world, tilted toward the front. */
function RingView({ orbitRadius, worldRadius }: RingViewBindings): Container3D {
    const ring = new TorusGeometry({ radius: worldRadius * 1.75, tube: worldRadius * 0.32, radialSegments: 12, tubularSegments: 64 });
    const material = new Material3D({ baseColor: 0xd8c49a, roughness: 0.8 });
    return (
        <group x={orbitRadius} y={SUN_Y} rotationZ={0.4} owns={[ring, material]}>
            {/* Squashed, so the tube becomes a thin band */}
            <mesh geometry={ring} material={material} scaleY={0.12} />
        </group>
    );
}

interface MoonViewBindings {
    /** The length of the world's arm. */
    readonly orbitRadius: number;
    /** The world's own radius, which the moon's arm passes under. */
    readonly worldRadius: number;
    /** How far the world's arm has turned, in radians. */
    readonly orbitAngle: () => number;
    /** How far the moon has gone round its world, in radians, from the same direction as `orbitAngle`. */
    readonly moonAngle: () => number;
    /** What the orrery is made of. */
    readonly parts: OrreryParts;
}

/**
 * A moon on its arm, which turns round the world's rod. The arm sits under
 * the world, and a pin holds the moon up level with it. The moon's group is
 * inside the world's arm, which has already turned by the orbit angle, so it
 * turns by the rest of the moon's angle.
 */
function MoonView(bindings: MoonViewBindings): Container3D {
    const { orbitRadius, worldRadius, orbitAngle, moonAngle, parts } = bindings;
    const { cylinder, sphere, cube, brass, steel } = parts;
    const surface = new Material3D({ baseColor: 0xc8c8c0, roughness: 0.9 });
    const armHeight = SUN_Y - worldRadius - 0.05;
    return (
        <group x={orbitRadius} y={armHeight} rotationY={() => moonAngle() - orbitAngle()} owns={[surface]}>
            <RodView cylinder={cylinder} material={brass} radius={0.022} bottom={-0.015} top={0.015} />
            <mesh geometry={cube} material={brass} x={MOON_DISTANCE / 2} scaleX={MOON_DISTANCE} scaleY={0.012} scaleZ={0.02} />
            <RodView cylinder={cylinder} material={steel} radius={0.006} bottom={0} top={SUN_Y - armHeight} x={MOON_DISTANCE} />
            <mesh geometry={sphere} material={surface} x={MOON_DISTANCE} y={SUN_Y - armHeight} scale={MOON_RADIUS} />
        </group>
    );
}
