/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, Material3D } from '@pixi/3d';
import type { Container } from 'pixi.js';
import { ScreenView } from '@mvtjs/pixi-3d';
import { GANTRY_POST_CLEARANCE, GANTRY_POST_SIZE } from '../data';
import type { TrackSample } from '../models';
import { BOARD_HEIGHT, BOARD_WIDTH } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GantryViewBindings {
    /** The track sample the gantry spans, facing the cars coming toward it. */
    readonly sample: TrackSample;
    /** The asphalt's width, which the gantry spans with room to spare. */
    readonly trackWidth: number;
    /** The board's 2D view, which is drawn into a texture and shown on the gantry. */
    readonly board: Container;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A gantry over the track, with two posts, a beam, and a scoreboard that
 * faces the oncoming cars. The board is a 2D Pixi view, which a
 * `ScreenView` shows. The screen updates and refreshes the board's views as
 * the scene ticks. It draws the board every frame, starting with the first,
 * so the board shows in a visual test too.
 */
export function GantryView({ sample, trackWidth, board }: GantryViewBindings): Container3D {
    const span = trackWidth + GANTRY_POST_CLEARANCE * 2;
    const steel = new Material3D({ baseColor: 0x8b9099, roughness: 0.5, metallic: 0.7 });
    const post = new CubeGeometry({ width: GANTRY_POST_SIZE, height: BEAM_HEIGHT, depth: GANTRY_POST_SIZE });
    const beam = new CubeGeometry({ width: 0.6, height: 0.6, depth: span + 0.5 });

    return (
        // The gantry is built across +x, the way the track runs, and turned to the track
        <group owns={[steel, post, beam]} x={sample.x} z={sample.z} rotationY={-Math.atan2(sample.directionZ, sample.directionX)}>
            <mesh geometry={post} material={steel} y={BEAM_HEIGHT / 2} z={span / 2} castShadow={true} />
            <mesh geometry={post} material={steel} y={BEAM_HEIGHT / 2} z={-span / 2} castShadow={true} />
            <mesh geometry={beam} material={steel} y={BEAM_HEIGHT} castShadow={true} />
            {/* The screen hangs under the beam. It faces +z, so it's turned to face back down the track. It's unlit, like a display */}
            <group rotationY={-Math.PI / 2} x={-0.35} y={BEAM_HEIGHT - 0.3 - BOARD_WORLD_HEIGHT / 2}>
                <ScreenView
                    content={board}
                    contentWidth={BOARD_WIDTH}
                    contentHeight={BOARD_HEIGHT}
                    width={BOARD_WORLD_WIDTH}
                    height={BOARD_WORLD_HEIGHT}
                    antialias={true}
                />
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BEAM_HEIGHT = 8;
/** The board's size, in metres, the same shape as its texture. */
const BOARD_WORLD_WIDTH = 12;
const BOARD_WORLD_HEIGHT = (BOARD_WORLD_WIDTH * BOARD_HEIGHT) / BOARD_WIDTH;
