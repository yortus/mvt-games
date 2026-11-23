import { LANTERN_REST_HEIGHT, LANTERN_ROOM_SIZE, LANTERN_ROOM_X, LANTERNS_ACROSS, PARTITION_THICKNESS, ROOM_LENGTH, ROOM_WIDTH } from './constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A block of wall standing on the floor. It has a middle, and a size along x and along z, in metres. */
export interface WallBlock {
    readonly x: number;
    readonly z: number;
    readonly sizeX: number;
    readonly sizeZ: number;
}

/** A spot on the floor, in metres. */
export interface FloorSpot {
    readonly x: number;
    readonly z: number;
}

/** Where a lantern hangs in the lantern room: the spot on the floor below it, and how high it hangs at rest, in metres. */
export interface LanternSpot extends FloorSpot {
    readonly height: number;
}

/** A spot on a wall where a painting hangs. It's the middle of the wall's face behind the painting, with the way the painting faces. */
export interface HangingSpot extends FloorSpot {
    readonly facing: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Seen from above, +x points east and +z points south. The gallery is one
// long room, split by two walls into three corridors side by side, which
// run east and west. The visitor comes in at the west end of the north
// corridor and walks east along it. They turn round the end of the first
// wall into the middle corridor, and walk back west. Then they turn round
// the end of the second wall into the south corridor, and walk east again.

const HALF_LENGTH = ROOM_LENGTH / 2;
const HALF_WIDTH = ROOM_WIDTH / 2;
/** How wide each corridor is, between its walls. */
export const CORRIDOR_WIDTH = (ROOM_WIDTH - 2 * PARTITION_THICKNESS) / 3;
/** The middle of the north corridor, across, and of the south one. The middle corridor's is 0. */
export const NORTH_CORRIDOR_Z = -HALF_WIDTH + CORRIDOR_WIDTH / 2;
export const SOUTH_CORRIDOR_Z = -NORTH_CORRIDOR_Z;
/** How far each wall between the corridors stops short of the end wall, leaving the way round it. */
const TURN_WIDTH = 4;
/** How far each wall between the corridors stands from the middle of the room, north or south. */
const PARTITION_Z = HALF_WIDTH - CORRIDOR_WIDTH - PARTITION_THICKNESS / 2;
const PARTITION_LENGTH = ROOM_LENGTH - TURN_WIDTH;

/** The two walls between the corridors. The first joins the west wall, and the second the east wall. */
export const PARTITIONS: readonly WallBlock[] = [
    { x: -HALF_LENGTH + PARTITION_LENGTH / 2, z: -PARTITION_Z, sizeX: PARTITION_LENGTH, sizeZ: PARTITION_THICKNESS },
    { x: HALF_LENGTH - PARTITION_LENGTH / 2, z: PARTITION_Z, sizeX: PARTITION_LENGTH, sizeZ: PARTITION_THICKNESS },
];

/** Where the door out is, along the west wall. It opens onto the north corridor. */
export const DOOR_Z = NORTH_CORRIDOR_Z;

/** Where the visitor starts, a few steps in from the door, facing east along the north corridor. */
export const START_X = -HALF_LENGTH + 1.5;
export const START_Z = NORTH_CORRIDOR_Z;
export const START_HEADING = 0;

/** The ways a painting can face. */
const FACING_SOUTH = Math.PI / 2;
const FACING_NORTH = -Math.PI / 2;
const FACING_EAST = 0;
const FACING_WEST = Math.PI;
/** The faces of the two walls between the corridors. */
const FIRST_NORTH_FACE = -PARTITION_Z - PARTITION_THICKNESS / 2;
const FIRST_SOUTH_FACE = -PARTITION_Z + PARTITION_THICKNESS / 2;
const SECOND_NORTH_FACE = PARTITION_Z - PARTITION_THICKNESS / 2;
const SECOND_SOUTH_FACE = PARTITION_Z + PARTITION_THICKNESS / 2;

/**
 * Where each painting hangs, in the order the visitor comes to them. Each
 * corridor has two paintings on each long wall, staggered, so that two
 * paintings never face each other. The north and middle corridors each end
 * in a painting on the end wall, in view all the way along.
 */
export const HANGING_SPOTS: readonly HangingSpot[] = [
    // The north corridor, walking east
    { x: -6, z: -HALF_WIDTH, facing: FACING_SOUTH },
    { x: -2, z: FIRST_NORTH_FACE, facing: FACING_NORTH },
    { x: 2, z: -HALF_WIDTH, facing: FACING_SOUTH },
    { x: 5, z: FIRST_NORTH_FACE, facing: FACING_NORTH },
    { x: HALF_LENGTH, z: NORTH_CORRIDOR_Z, facing: FACING_WEST },
    // The middle corridor, walking west
    { x: 4, z: FIRST_SOUTH_FACE, facing: FACING_SOUTH },
    { x: 1, z: SECOND_NORTH_FACE, facing: FACING_NORTH },
    { x: -3, z: FIRST_SOUTH_FACE, facing: FACING_SOUTH },
    { x: -5, z: SECOND_NORTH_FACE, facing: FACING_NORTH },
    { x: -HALF_LENGTH, z: 0, facing: FACING_EAST },
    // The south corridor, walking east
    { x: -5, z: HALF_WIDTH, facing: FACING_NORTH },
    { x: -2, z: SECOND_SOUTH_FACE, facing: FACING_SOUTH },
    { x: 2, z: HALF_WIDTH, facing: FACING_NORTH },
    { x: 5, z: SECOND_SOUTH_FACE, facing: FACING_SOUTH },
];

/** Where the benches stand, down the middle of the corridors, between the paintings. */
export const BENCH_SPOTS: readonly FloorSpot[] = [
    { x: -4, z: NORTH_CORRIDOR_Z },
    { x: 3.5, z: NORTH_CORRIDOR_Z },
    { x: -1, z: 0 },
    { x: -3.5, z: SOUTH_CORRIDOR_Z },
    { x: 3.5, z: SOUTH_CORRIDOR_Z },
];

/** Where the plants stand in their pots. They're in the corners by the door, beside the paintings on the end walls, and at the far end. */
export const POT_SPOTS: readonly FloorSpot[] = [
    { x: -HALF_LENGTH + 0.6, z: -HALF_WIDTH + 0.6 },
    { x: HALF_LENGTH - 0.6, z: -HALF_WIDTH + 0.6 },
    { x: HALF_LENGTH - 0.6, z: NORTH_CORRIDOR_Z + 1.7 },
    { x: -HALF_LENGTH + 0.6, z: -1.6 },
    { x: -HALF_LENGTH + 0.6, z: 1.6 },
    { x: HALF_LENGTH - 0.6, z: SOUTH_CORRIDOR_Z - 1.7 },
    { x: HALF_LENGTH - 0.6, z: SOUTH_CORRIDOR_Z },
    { x: HALF_LENGTH - 0.6, z: HALF_WIDTH - 0.6 },
];

/**
 * Where the lanterns hang, in a square grid that fills the lantern room,
 * short of its walls. Each hangs a little higher or lower than the next, in
 * a pattern that never quite repeats, so the field looks scattered rather
 * than ruled.
 */
export const LANTERN_SPOTS: readonly LanternSpot[] = layLanterns();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function layLanterns(): LanternSpot[] {
    // How much higher or lower than the rest height a lantern may hang. It's here, not beside the
    // others, since the spots are laid as the module loads, before a constant below them is made
    const heightSpread = 0.35;
    const spots: LanternSpot[] = [];
    const spacing = (LANTERN_ROOM_SIZE - 1) / (LANTERNS_ACROSS - 1);
    const first = -(LANTERN_ROOM_SIZE - 1) / 2;
    for (let row = 0; row < LANTERNS_ACROSS; row++) {
        for (let col = 0; col < LANTERNS_ACROSS; col++) {
            // Two waves at unrelated rates, so neighbouring heights differ without repeating along a row
            const wobble = Math.sin(row * 2.39 + col * 1.13) * 0.6 + Math.sin(row * 0.77 - col * 2.71) * 0.4;
            spots.push({ x: LANTERN_ROOM_X + first + col * spacing, z: first + row * spacing, height: LANTERN_REST_HEIGHT + wobble * heightSpread });
        }
    }
    return spots;
}
