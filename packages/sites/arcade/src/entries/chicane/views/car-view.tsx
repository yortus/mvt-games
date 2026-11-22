/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D, Material3D } from '@pixi/3d';
import type { ValueOrGetter } from '@mvtjs/pixi-3d';
import { CAR_WHEEL_RADIUS, type CarParts } from './car-parts';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CarViewBindings {
    /** Where the car is on the ground, in metres. */
    readonly x: () => number;
    readonly z: () => number;
    /** The angle of its nose from +x toward +z, in radians. */
    readonly heading: () => number;
    /** How far the steering is turned, from -1 at full left lock to 1 at full right. */
    readonly steeringLock: ValueOrGetter<number>;
    /** How far it has rolled, which turns its wheels. */
    readonly odometer: () => number;
    /** The shapes and materials that every car shares, which the scene made and owns. Read once. */
    readonly parts: CarParts;
    /** Its paint, one of `parts.paints`. Read once. */
    readonly paint: Material3D;
    /** Whether it shows. A wreck doesn't, and a car just back on the track flashes. */
    readonly isVisible: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The car. It has a low body, a dark cabin, a rear wing, and four wheels
 * that roll as it moves. The front wheels turn with the steering. It's
 * built nose toward +x, and turned to its heading.
 */
export function CarView(bindings: CarViewBindings): Container3D {
    const { x, z, heading, steeringLock, odometer, parts, paint, isVisible } = bindings;
    // A turn of the wheel rolls its circumference, and rolling toward +x turns it clockwise about +z
    const roll = (): number => -odometer() / CAR_WHEEL_RADIUS;
    const steer = typeof steeringLock === 'number'
        ? -steeringLock * MAX_WHEEL_ANGLE
        : (): number => -steeringLock() * MAX_WHEEL_ANGLE;

    return (
        <group visible={isVisible} x={x} z={z} rotationY={() => -heading()}>
            <mesh geometry={parts.body} material={paint} y={0.5} castShadow={true} />
            <mesh geometry={parts.nose} material={paint} x={2.1} y={0.4} castShadow={true} />
            <mesh geometry={parts.cabin} material={parts.glass} x={-0.45} y={0.94} castShadow={true} />
            <mesh geometry={parts.wing} material={parts.trim} x={-1.95} y={1.05} castShadow={true} />
            <WheelView x={WHEEL_X} z={WHEEL_Z} steer={steer} roll={roll} parts={parts} />
            <WheelView x={WHEEL_X} z={-WHEEL_Z} steer={steer} roll={roll} parts={parts} />
            <WheelView x={-WHEEL_X} z={WHEEL_Z} steer={0} roll={roll} parts={parts} />
            <WheelView x={-WHEEL_X} z={-WHEEL_Z} steer={0} roll={roll} parts={parts} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the wheels sit, forward and sideways from the car's middle. */
const WHEEL_X = 1.35;
const WHEEL_Z = 0.98;
/** How far the front wheels turn at full lock, in radians. */
const MAX_WHEEL_ANGLE = 0.45;

interface WheelViewBindings {
    /** Where the wheel sits, forward and sideways from the car's middle. */
    readonly x: number;
    readonly z: number;
    /** How far it's turned to steer, in radians. */
    readonly steer: ValueOrGetter<number>;
    /** How far it has rolled round its axle, in radians. */
    readonly roll: () => number;
    readonly parts: CarParts;
}

/** One wheel, with a bar across its face so you can see it roll. */
function WheelView({ x, z, steer, roll, parts }: WheelViewBindings): Container3D {
    return (
        <group x={x} y={CAR_WHEEL_RADIUS} z={z} rotationY={steer}>
            <group rotationZ={roll}>
                {/* The cylinder stands along Y, and the axle runs along Z */}
                <mesh geometry={parts.tyre} material={parts.tyreMaterial} rotationX={Math.PI / 2} castShadow={true} />
                <mesh geometry={parts.spoke} material={parts.rimMaterial} />
            </group>
        </group>
    );
}
