/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D } from '@pixi/3d';
import { WORLDS } from '../data';
import type { DemoModel } from '../models';
import { BaseView } from './base-view';
import { GearTrainView } from './gear-train-view';
import { computeArmY, PLATE_TOP, SPINDLE_RADIUS, SUN_RADIUS, SUN_Y } from './layout';
import { createOrreryParts } from './orrery-parts';
import { RodView } from './rod-view';
import { WorldArmView } from './world-arm-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OrreryViewBindings {
    readonly model: DemoModel;
    /** How far round the orrery the camera has moved from the front, in radians, counterclockwise seen from above. */
    readonly cameraYaw: () => number;
    /** How far above the plinth's level the camera looks down from, in radians. */
    readonly cameraTilt: () => number;
    /** How far the camera stands from the point it looks at, a little below the arms. */
    readonly cameraDistance: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The orrery's 3D scene. The plinth and its gears sit at the bottom, and the
 * sun on the central spindle above them, with the worlds on their arms
 * around it. A lamp inside the sun lights the worlds' near sides, and a dim
 * light from above and in front shows the brass.
 */
export function OrreryView(bindings: OrreryViewBindings): Container3D {
    const { model, cameraYaw, cameraTilt, cameraDistance } = bindings;
    const parts = createOrreryParts();
    const { brass, steel, sunGlow, cylinder, sphere } = parts;
    // The camera stands on a sphere round the point it looks at
    const cameraX = (): number => cameraDistance() * Math.cos(cameraTilt()) * Math.sin(cameraYaw());
    const cameraY = (): number => CAMERA_TARGET.y + cameraDistance() * Math.sin(cameraTilt());
    const cameraZ = (): number => cameraDistance() * Math.cos(cameraTilt()) * Math.cos(cameraYaw());

    return (
        // This view made the materials and shapes, so it frees them. The views of its parts draw with them too, but never free them
        <group owns={parts.resources}>
            {/* Its aim is a getter too, so the camera turns to face it again after each move */}
            <camera x={cameraX} y={cameraY} z={cameraZ} lookAt={() => CAMERA_TARGET} fov={46} />
            <directionalLight x={-2} y={6} z={4} lookAt={ORIGIN} color={0xfff2e0} intensity={1.6} />
            <pointLight y={SUN_Y} color={0xfff1d0} intensity={9} range={9} />
            <BaseView parts={parts} />
            <GearTrainView crankAngle={() => model.crankAngle} driveAngle={() => model.driveAngle} parts={parts} />
            {model.worlds.map((world, i) => (
                <WorldArmView
                    index={i}
                    world={WORLDS[i]}
                    color={WORLD_COLORS[i % WORLD_COLORS.length]}
                    orbitAngle={() => world.orbitAngle}
                    moonAngle={() => world.moonAngle}
                    parts={parts}
                />
            ))}
            <RodView cylinder={cylinder} material={steel} radius={SPINDLE_RADIUS} bottom={PLATE_TOP} top={SUN_Y} />
            <RodView cylinder={cylinder} material={brass} radius={0.05} bottom={computeArmY(0) + 0.02} top={computeArmY(0) + 0.05} />
            <mesh geometry={sphere} material={sunGlow} y={SUN_Y} scale={SUN_RADIUS} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ORIGIN = { x: 0, y: 0, z: 0 };

/** What the camera looks at, a little below the arms, so the plinth and the worlds both fit. */
const CAMERA_TARGET = { x: 0, y: 0.8, z: 0 };

/** The worlds' colours, nearest first. */
const WORLD_COLORS: readonly number[] = [0xb0a08c, 0xd9a35e, 0x4f86c6, 0xc9b48a, 0x7fb7a8];
