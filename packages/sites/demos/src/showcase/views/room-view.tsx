/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, FlatMaterial, Material3D, PlaneGeometry } from '@pixi/3d';
import {
    DOOR_HEIGHT, DOOR_WIDTH, DOOR_Z, NORTH_CORRIDOR_Z, PARTITIONS, ROOM_HEIGHT, ROOM_LENGTH, ROOM_WIDTH, SOUTH_CORRIDOR_Z, type WallBlock,
} from '../data';
import { createFloorTexture } from './floor-texture';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The gallery itself, bright and plain, so the paintings stand out. It has
 * a pale oak floor, white walls with a grey skirting board, and a white
 * ceiling with a row of glowing skylights down each corridor. A dark
 * doorway in the west wall, with no sign over it, leads to the lantern room.
 */
export function RoomView(): Container3D {
    const wall = new Material3D({ baseColor: 0xf7f5f0, roughness: 0.95 });
    const skirting = new Material3D({ baseColor: 0x9a968e, roughness: 0.7 });
    const ceiling = new Material3D({ baseColor: 0xfafafa, roughness: 1 });
    const floorTexture = createFloorTexture({ length: ROOM_LENGTH, width: ROOM_WIDTH });
    const floor = new Material3D({ baseColorTexture: floorTexture, roughness: 0.55 });
    const skylight = new FlatMaterial({ baseColor: 0xf2f7ff });
    const floorGeometry = new PlaneGeometry({ width: ROOM_LENGTH, height: ROOM_WIDTH, flipV: true });
    const ceilingGeometry = new PlaneGeometry({ width: ROOM_LENGTH, height: ROOM_WIDTH });
    const halfLength = ROOM_LENGTH / 2;
    const halfWidth = ROOM_WIDTH / 2;
    // The outer walls, as blocks just outside the floor
    const outerWalls: readonly WallBlock[] = [
        { x: 0, z: -halfWidth - WALL_THICKNESS / 2, sizeX: ROOM_LENGTH + 2 * WALL_THICKNESS, sizeZ: WALL_THICKNESS },
        { x: 0, z: halfWidth + WALL_THICKNESS / 2, sizeX: ROOM_LENGTH + 2 * WALL_THICKNESS, sizeZ: WALL_THICKNESS },
        { x: -halfLength - WALL_THICKNESS / 2, z: 0, sizeX: WALL_THICKNESS, sizeZ: ROOM_WIDTH },
        { x: halfLength + WALL_THICKNESS / 2, z: 0, sizeX: WALL_THICKNESS, sizeZ: ROOM_WIDTH },
    ];
    const walls = [...outerWalls, ...PARTITIONS];
    // Each wall has its own size, so each has a block of its own, and a skirting block a little bigger than the wall
    const wallGeometries = walls.map((block) => new CubeGeometry({ width: block.sizeX, height: ROOM_HEIGHT, depth: block.sizeZ }));
    const skirtingGeometries = walls.map((block) => new CubeGeometry({
        width: block.sizeX + 2 * SKIRTING_DEPTH,
        height: SKIRTING_HEIGHT,
        depth: block.sizeZ + 2 * SKIRTING_DEPTH,
    }));
    const skylightGeometry = new PlaneGeometry({ width: SKYLIGHT_LENGTH, height: SKYLIGHT_WIDTH });
    const corridorZs = [NORTH_CORRIDOR_Z, 0, SOUTH_CORRIDOR_Z];

    return (
        <group
            owns={[
                wall, skirting, ceiling, floor, floorTexture, skylight, floorGeometry, ceilingGeometry, skylightGeometry,
                ...wallGeometries, ...skirtingGeometries,
            ]}
        >
            {/* A plane faces +z, so the floor and ceiling are turned to face up and down */}
            <mesh geometry={floorGeometry} material={floor} rotationX={-Math.PI / 2} />
            <mesh geometry={ceilingGeometry} material={ceiling} y={ROOM_HEIGHT} rotationX={Math.PI / 2} />
            {walls.map((block, i) => (
                <mesh geometry={wallGeometries[i]} material={wall} x={block.x} y={ROOM_HEIGHT / 2} z={block.z} />
            ))}
            {/* The skirting is a block a little bigger than each wall, along its foot */}
            {walls.map((block, i) => (
                <mesh
                    geometry={skirtingGeometries[i]}
                    material={skirting}
                    x={block.x}
                    y={SKIRTING_HEIGHT / 2}
                    z={block.z}
                />
            ))}
            {corridorZs.flatMap((z) => SKYLIGHT_XS.map((x) => (
                <mesh geometry={skylightGeometry} material={skylight} x={x} y={ROOM_HEIGHT - 0.01} z={z} rotationX={Math.PI / 2} />
            )))}
            <DoorView x={-halfLength} z={DOOR_Z} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WALL_THICKNESS = 0.2;
const SKIRTING_HEIGHT = 0.1;
const SKIRTING_DEPTH = 0.012;
/** The skylights' size, and where they are along each corridor, in metres. */
const SKYLIGHT_LENGTH = 2.4;
const SKYLIGHT_WIDTH = 1.2;
const SKYLIGHT_XS: readonly number[] = [-7.5, -4, -0.5, 3, 6.5];
const FRAME_SIZE = 0.1;
const FRAME_DEPTH = 0.06;

interface DoorViewBindings {
    /** Where the door is, on the west wall, in metres. */
    readonly x: number;
    readonly z: number;
}

/** The door to the lantern room, a dark doorway in a white frame. It's built facing +x, out from the west wall. */
function DoorView({ x, z }: DoorViewBindings): Container3D {
    const frame = new Material3D({ baseColor: 0xe6e2da, roughness: 0.6 });
    const post = new CubeGeometry({ width: FRAME_DEPTH, height: DOOR_HEIGHT, depth: FRAME_SIZE });
    const lintel = new CubeGeometry({ width: FRAME_DEPTH, height: FRAME_SIZE, depth: DOOR_WIDTH + 2 * FRAME_SIZE });
    const opening = new PlaneGeometry({ width: DOOR_WIDTH, height: DOOR_HEIGHT });
    const dark = new FlatMaterial({ baseColor: 0x2a2826 });
    return (
        <group x={x} z={z} owns={[frame, post, lintel, opening, dark]}>
            <mesh
                geometry={opening}
                material={dark}
                x={0.005}
                y={DOOR_HEIGHT / 2}
                rotationY={Math.PI / 2}
            />
            <mesh geometry={post} material={frame} x={FRAME_DEPTH / 2} y={DOOR_HEIGHT / 2} z={-(DOOR_WIDTH + FRAME_SIZE) / 2} />
            <mesh geometry={post} material={frame} x={FRAME_DEPTH / 2} y={DOOR_HEIGHT / 2} z={(DOOR_WIDTH + FRAME_SIZE) / 2} />
            <mesh
                geometry={lintel}
                material={frame}
                x={FRAME_DEPTH / 2}
                y={DOOR_HEIGHT + FRAME_SIZE / 2}
            />
        </group>
    );
}
