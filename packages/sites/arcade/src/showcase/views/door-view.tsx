/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, FlatMaterial, Material3D, PlaneGeometry } from '@pixi/3d';
import { DOOR_HEIGHT, DOOR_WIDTH, HALL_LENGTH } from '../data';
import { createMarqueeTexture } from './marquee-texture';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DoorViewBindings {
    /** Whether the door leads out, as it does from a hall inside a cabinet. */
    readonly isOpen: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The door in the middle of the entrance wall, in a frame. Open, it's a
 * dark doorway with a green EXIT sign over it. Shut, as it is in the hall
 * itself, which has nowhere to go out to, it's a pair of plain doors.
 */
export function DoorView({ isOpen }: DoorViewBindings): Container3D {
    const leaf = new Material3D({ baseColor: 0x3b3550, roughness: 0.7 });
    const leafGeometry = new CubeGeometry({ width: LEAF_DEPTH, height: DOOR_HEIGHT, depth: DOOR_WIDTH / 2 - LEAF_GAP });
    const frame = new Material3D({ baseColor: 0x5a5470, roughness: 0.6 });
    const post = new CubeGeometry({ width: FRAME_DEPTH, height: DOOR_HEIGHT, depth: FRAME_SIZE });
    const lintel = new CubeGeometry({ width: FRAME_DEPTH, height: FRAME_SIZE, depth: DOOR_WIDTH + 2 * FRAME_SIZE });
    const doorway = new PlaneGeometry({ width: DOOR_WIDTH, height: DOOR_HEIGHT });
    const dark = new FlatMaterial({ baseColor: 0x050408 });
    const signPlane = new PlaneGeometry({ width: SIGN_WIDTH, height: SIGN_WIDTH / 4, flipV: true });
    const signTexture = createMarqueeTexture({ name: 'Exit', color: '#20c060' });
    const sign = new FlatMaterial({ baseColorTexture: signTexture });
    const wallX = -HALL_LENGTH / 2;
    return (
        // Built facing +x, out from the entrance wall
        <group owns={[leaf, leafGeometry, frame, post, lintel, doorway, dark, signPlane, signTexture, sign]} x={wallX}>
            <group visible={isOpen}>
                <mesh geometry={doorway} material={dark} x={0.005} y={DOOR_HEIGHT / 2} rotationY={Math.PI / 2} />
                <mesh
                    geometry={signPlane}
                    material={sign}
                    x={0.01}
                    y={DOOR_HEIGHT + FRAME_SIZE + 0.2}
                    rotationY={Math.PI / 2}
                />
            </group>
            <group visible={() => !isOpen()}>
                <mesh geometry={leafGeometry} material={leaf} x={LEAF_DEPTH / 2} y={DOOR_HEIGHT / 2} z={-DOOR_WIDTH / 4} />
                <mesh geometry={leafGeometry} material={leaf} x={LEAF_DEPTH / 2} y={DOOR_HEIGHT / 2} z={DOOR_WIDTH / 4} />
            </group>
            <mesh geometry={post} material={frame} x={FRAME_DEPTH / 2} y={DOOR_HEIGHT / 2} z={-(DOOR_WIDTH + FRAME_SIZE) / 2} />
            <mesh geometry={post} material={frame} x={FRAME_DEPTH / 2} y={DOOR_HEIGHT / 2} z={(DOOR_WIDTH + FRAME_SIZE) / 2} />
            <mesh geometry={lintel} material={frame} x={FRAME_DEPTH / 2} y={DOOR_HEIGHT + FRAME_SIZE / 2} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The frame's thickness, and how far it stands out from the wall. */
const FRAME_SIZE = 0.1;
const FRAME_DEPTH = 0.06;
const SIGN_WIDTH = 0.6;
/** How thick each leaf of the shut doors is, and the gap down the middle between them. */
const LEAF_DEPTH = 0.04;
const LEAF_GAP = 0.006;
