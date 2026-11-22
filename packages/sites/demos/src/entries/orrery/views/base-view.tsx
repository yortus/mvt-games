/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CylinderGeometry } from '@pixi/3d';
import { WORLDS } from '../data';
import { BRIDGE_Y, DRIVE_DIRECTION, PILLAR_DISTANCE, PLATE_RADIUS, PLATE_TOP, computeTubeRadius } from './layout';
import type { OrreryParts } from './orrery-parts';
import { RodView } from './rod-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BaseViewBindings {
    /** What the orrery is made of. */
    readonly parts: OrreryParts;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The parts that never move. An eight-sided wooden plinth has an ebony plate
 * on top. A bridge stands over the gears on a pillar. It holds the drive
 * arbor's top and steadies the tubes.
 */
export function BaseView({ parts }: BaseViewBindings): Container3D {
    const { cylinder, cube, sphere, brass, darkBrass, wood, ebony } = parts;
    const plinth = new CylinderGeometry({ radiusTop: PLINTH_RADIUS, radiusBottom: PLINTH_RADIUS + 0.06, height: PLINTH_HEIGHT, radialSegments: 8 });
    const bridgeLength = PILLAR_DISTANCE;
    const bridgeTop = BRIDGE_Y + BRIDGE_THICKNESS;

    return (
        <group owns={[plinth]}>
            {/* Turned so a flat side faces the front */}
            <mesh geometry={plinth} material={wood} y={-PLINTH_HEIGHT / 2} rotationY={Math.PI / 8} />
            {/* A plate of ebony, with a brass band round its edge */}
            <RodView cylinder={cylinder} material={brass} radius={PLATE_RADIUS + 0.025} bottom={0} top={PLATE_TOP - 0.006} />
            <RodView cylinder={cylinder} material={ebony} radius={PLATE_RADIUS} bottom={0} top={PLATE_TOP} />
            {/* The bridge's round end, which the tubes pass through, and its bar out to the pillar */}
            <RodView cylinder={cylinder} material={darkBrass} radius={computeTubeRadius(WORLDS.length - 1) + 0.05} bottom={BRIDGE_Y} top={bridgeTop} />
            <group rotationY={DRIVE_DIRECTION}>
                <mesh
                    geometry={cube}
                    material={darkBrass}
                    x={bridgeLength / 2}
                    y={BRIDGE_Y + BRIDGE_THICKNESS / 2}
                    scaleX={bridgeLength}
                    scaleY={BRIDGE_THICKNESS}
                    scaleZ={BRIDGE_WIDTH}
                />
                <RodView cylinder={cylinder} material={darkBrass} radius={0.034} bottom={PLATE_TOP} top={BRIDGE_Y} x={PILLAR_DISTANCE} />
                <mesh geometry={sphere} material={brass} x={PILLAR_DISTANCE} y={bridgeTop + 0.02} scale={0.035} />
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The plinth's radius at the top, to its corners. */
const PLINTH_RADIUS = 1.62;

/** How tall the plinth is. */
const PLINTH_HEIGHT = 0.32;

/** How thick and how wide the bridge's bar is. */
const BRIDGE_THICKNESS = 0.03;
const BRIDGE_WIDTH = 0.11;
