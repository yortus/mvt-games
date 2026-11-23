/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, FlatMaterial, Material3D, PlaneGeometry } from '@pixi/3d';
import { HALL_HEIGHT, HALL_LENGTH, HALL_WIDTH } from '../data';
import { createCarpetTexture } from './carpet-texture';
import { DoorView } from './door-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RoomViewBindings {
    /** Whether the door in the entrance wall leads out, as it does from a hall inside a cabinet. */
    readonly isDoorOpen: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The hall itself. It has a patterned carpet, dark walls with neon tubes
 * along their tops, a dark ceiling, lamps hanging over the aisle, and a
 * door in the entrance wall.
 */
export function RoomView({ isDoorOpen }: RoomViewBindings): Container3D {
    const wall = new Material3D({ baseColor: 0x2b2340, roughness: 0.9 });
    const ceiling = new Material3D({ baseColor: 0x15121f, roughness: 1 });
    const carpetTexture = createCarpetTexture();
    const carpet = new Material3D({ baseColorTexture: carpetTexture, roughness: 1 });
    const pink = new FlatMaterial({ baseColor: 0xff3d9a });
    const cyan = new FlatMaterial({ baseColor: 0x29e0ff });
    const sideWall = new CubeGeometry({ width: HALL_LENGTH, height: HALL_HEIGHT, depth: WALL_THICKNESS });
    const endWall = new CubeGeometry({ width: WALL_THICKNESS, height: HALL_HEIGHT, depth: HALL_WIDTH });
    const sideTube = new CubeGeometry({ width: HALL_LENGTH, height: TUBE_SIZE, depth: TUBE_SIZE });
    const endTube = new CubeGeometry({ width: TUBE_SIZE, height: TUBE_SIZE, depth: HALL_WIDTH });
    const floor = new PlaneGeometry({ width: HALL_LENGTH, height: HALL_WIDTH, flipV: true });
    const ceilingPlane = new PlaneGeometry({ width: HALL_LENGTH, height: HALL_WIDTH });
    const halfLength = HALL_LENGTH / 2 + WALL_THICKNESS / 2;
    const halfWidth = HALL_WIDTH / 2 + WALL_THICKNESS / 2;
    const tubeY = HALL_HEIGHT - 0.25;

    return (
        <group owns={[wall, ceiling, carpetTexture, carpet, pink, cyan, sideWall, endWall, sideTube, endTube, floor, ceilingPlane]}>
            {/* A plane faces +z, so the floor and ceiling are turned to face up and down */}
            <mesh geometry={floor} material={carpet} rotationX={-Math.PI / 2} />
            <mesh geometry={ceilingPlane} material={ceiling} y={HALL_HEIGHT} rotationX={Math.PI / 2} />
            <mesh geometry={sideWall} material={wall} y={HALL_HEIGHT / 2} z={-halfWidth} />
            <mesh geometry={sideWall} material={wall} y={HALL_HEIGHT / 2} z={halfWidth} />
            <mesh geometry={endWall} material={wall} y={HALL_HEIGHT / 2} x={-halfLength} />
            <mesh geometry={endWall} material={wall} y={HALL_HEIGHT / 2} x={halfLength} />
            <mesh geometry={sideTube} material={pink} y={tubeY} z={-HALL_WIDTH / 2 + TUBE_SIZE} />
            <mesh geometry={sideTube} material={cyan} y={tubeY} z={HALL_WIDTH / 2 - TUBE_SIZE} />
            <mesh geometry={endTube} material={cyan} y={tubeY} x={-HALL_LENGTH / 2 + TUBE_SIZE} />
            <mesh geometry={endTube} material={pink} y={tubeY} x={HALL_LENGTH / 2 - TUBE_SIZE} />
            <DoorView isOpen={isDoorOpen} />
            {LAMP_XS.map((x) => (
                <pointLight x={x} y={HALL_HEIGHT - 0.4} color={0xffe2c4} intensity={LAMP_INTENSITY} range={LAMP_RANGE} />
            ))}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WALL_THICKNESS = 0.2;
const TUBE_SIZE = 0.06;
/** Where the lamps hang along the aisle, how bright they are, and how far their light reaches. */
const LAMP_XS: readonly number[] = [-3.6, -1.2, 1.2, 3.6];
const LAMP_INTENSITY = 7;
const LAMP_RANGE = 7;
