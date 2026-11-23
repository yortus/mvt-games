import { createWalkerModel, type Stand, type Strafing, type Walking } from '@mvtjs/site-kit/showcase';
import {
    BENCH_LENGTH, BENCH_SPOTS, BENCH_WIDTH, DOOR_WIDTH, DOOR_Z, FACING_COSINE, type FloorSpot, HANGING_SPOTS, LANTERN_ROOM_SIZE,
    LANTERN_ROOM_X, LANTERN_SPOTS, type LanternSpot, PAINTING_STANDOFF, PARTITIONS, POT_SIZE, POT_SPOTS, REACH, ROOM_LENGTH, ROOM_WIDTH,
    START_HEADING, START_X, START_Z, STEP_MS, VIEW_DISTANCE, VISITOR_RADIUS, WALK_SPEED, type WallBlock,
} from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the visitor is doing. They walk round the gallery, step up to a
 * painting, view its demo, and step back from it to walk again. Stepping up
 * and stepping back each take a moment (`STEP_MS`).
 */
export type GalleryMode = 'walking' | 'stepping-up' | 'viewing' | 'stepping-back';

/** A painting, hanging on a wall. Its middle is where its picture is, just out from the wall. */
export interface Painting extends Stand {
    /** Its index in the gallery's list, which says which demo it shows. */
    readonly index: number;
}

/**
 * The gallery, and the visitor walking round it. The gallery is a long room
 * of three corridors, with paintings on the walls, benches down the middle
 * and plants in pots. The visitor is a circle on the floor. They walk and
 * turn, and can't walk through the walls, the benches or the pots. Facing a
 * painting up close, the visitor can step up to it and view its demo.
 *
 * The door they came in by doesn't lead out. It leads to the lantern room,
 * a dark room hung with lanterns, which is found rather than pointed out.
 * Walking into its doorway takes the visitor there, and walking into the
 * lantern room's doorway brings them back, each time just inside the door.
 */
export interface DemoModel {
    /** Every painting, in the order the visitor comes to them. */
    readonly paintings: readonly Painting[];
    /** The benches, each along its corridor. */
    readonly benches: readonly Stand[];
    /** The plants in their pots. */
    readonly pots: readonly FloorSpot[];
    readonly mode: GalleryMode;
    /** Where the lanterns hang in the lantern room. */
    readonly lanterns: readonly LanternSpot[];
    /** Whether the visitor is in the lantern room, the room hidden behind the door they came in by, rather than the gallery. */
    readonly isInLanternRoom: boolean;
    /** Where the visitor stands, in metres, and the way they face. */
    readonly visitorX: number;
    readonly visitorZ: number;
    readonly visitorHeading: number;
    /** How far the visitor looks up, in radians, or down for less than 0. */
    readonly visitorPitch: number;
    /** The painting the visitor could view now, being close to it and facing it, while walking. */
    readonly paintingInReach: Painting | undefined;
    /** The painting the visitor steps up to, views and steps back from, until they walk again. */
    readonly paintingInView: Painting | undefined;
    /** Whether the visitor can see the middle of `painting` from where they stand, in the gallery, with no wall between. */
    readonly isInSight: (painting: Painting) => boolean;
    /**
     * How far the visitor has leant in to the painting in view, from 0 to 1.
     * It's 0 while walking, rises as they step up, is 1 while they view it,
     * and falls as they step back.
     */
    readonly lean: number;
    walking: Walking;
    /** Stepping sideways, without turning. */
    strafing: Strafing;
    /** Turns the visitor on the spot, by `radians`, to the right for more than 0, while walking. */
    readonly turnBy: (radians: number) => void;
    /** Tilts the visitor's view up by `radians`, or down for less than 0, while walking, as far as a neck bends. */
    readonly tiltBy: (radians: number) => void;
    /** Steps up to the painting in reach, to view it once the step is done. */
    readonly viewPaintingInReach: () => void;
    /** Steps back from the painting stepped up to, or viewed, and walks again once the step is done. */
    readonly stopViewing: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DemoModelOptions {
    /** How many paintings hang on the walls, one for each demo, at most as many as there are hanging spots (`HANGING_SPOTS`). */
    readonly paintingCount: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the gallery, with the visitor just inside the door, facing along the first corridor. */
export function createDemoModel({ paintingCount }: DemoModelOptions): DemoModel {
    const paintings = hangPaintings(paintingCount);
    const visitor = createWalkerModel({
        radius: VISITOR_RADIUS,
        walkSpeed: WALK_SPEED,
        facingCosine: FACING_COSINE,
        startPitch: START_PITCH,
        maxPitch: MAX_PITCH,
        x: START_X,
        z: START_Z,
        heading: START_HEADING,
    });
    let mode: GalleryMode = 'walking';
    let isInLanternRoom = false;
    let paintingInReach: Painting | undefined;
    let paintingInView: Painting | undefined;
    /** How long the step up or back has lasted. */
    let stepMs = 0;

    const model: DemoModel = {
        paintings,
        benches: BENCHES,
        pots: POT_SPOTS,
        lanterns: LANTERN_SPOTS,
        get mode() {
            return mode;
        },
        get isInLanternRoom() {
            return isInLanternRoom;
        },
        get visitorX() {
            return visitor.x;
        },
        get visitorZ() {
            return visitor.z;
        },
        get visitorHeading() {
            return visitor.heading;
        },
        get visitorPitch() {
            return visitor.pitch;
        },
        get paintingInReach() {
            return paintingInReach;
        },
        get paintingInView() {
            return paintingInView;
        },
        isInSight(painting) {
            if (isInLanternRoom) return false;
            for (let i = 0; i < PARTITIONS.length; i++) {
                if (crossesBlock(visitor.x, visitor.z, painting.x, painting.z, PARTITIONS[i])) return false;
            }
            return true;
        },
        get lean() {
            switch (mode) {
                case 'walking':
                    return 0;
                case 'stepping-up':
                    return stepMs / STEP_MS;
                case 'viewing':
                    return 1;
                case 'stepping-back':
                    return 1 - stepMs / STEP_MS;
            }
        },
        get walking() {
            return visitor.walking;
        },
        set walking(value) {
            visitor.walking = value;
        },
        get strafing() {
            return visitor.strafing;
        },
        set strafing(value) {
            visitor.strafing = value;
        },

        turnBy(radians) {
            if (mode === 'walking') visitor.turnBy(radians);
        },

        tiltBy(radians) {
            if (mode === 'walking') visitor.tiltBy(radians);
        },

        viewPaintingInReach() {
            if (mode !== 'walking' || paintingInReach === undefined) return;
            mode = 'stepping-up';
            stepMs = 0;
            paintingInView = paintingInReach;
            paintingInReach = undefined;
        },

        stopViewing() {
            if ((mode !== 'stepping-up' && mode !== 'viewing') || paintingInView === undefined) return;
            // Stepping back part way up takes as long as the part stepped
            const alreadyMs = mode === 'stepping-up' ? STEP_MS - stepMs : 0;
            mode = 'stepping-back';
            stepMs = alreadyMs;
            // The visitor ends up square in front of the painting, a step back, so the whole of it is in view
            visitor.standBefore(paintingInView, 0, VIEW_DISTANCE + STEP_BACK);
            keepVisitorClear();
        },

        update(deltaMs) {
            if (mode === 'stepping-up' || mode === 'stepping-back') {
                stepMs = Math.min(STEP_MS, stepMs + deltaMs);
                if (stepMs < STEP_MS) return;
                if (mode === 'stepping-up') {
                    mode = 'viewing';
                    return;
                }
                mode = 'walking';
                paintingInView = undefined;
                findPaintingInReach();
                return;
            }
            if (mode !== 'walking') return;
            visitor.update(deltaMs);
            if (isInLanternRoom) {
                visitor.keepInside(LANTERN_ROOM_X - LANTERN_ROOM_SIZE / 2, LANTERN_ROOM_EAST_X, -LANTERN_ROOM_SIZE / 2, LANTERN_ROOM_SIZE / 2);
                // Walking into its doorway brings the visitor back, just inside the gallery's door, facing in
                if (isAtLanternRoomDoor()) {
                    isInLanternRoom = false;
                    visitor.placeAt(DOOR_X + ARRIVAL_STEP, DOOR_Z, EAST);
                }
                return;
            }
            keepVisitorClear();
            // Walking into the gallery's door takes the visitor to the lantern room, just inside its door, facing in
            if (isAtGalleryDoor()) {
                isInLanternRoom = true;
                paintingInReach = undefined;
                visitor.placeAt(LANTERN_ROOM_EAST_X - ARRIVAL_STEP, 0, WEST);
                return;
            }
            findPaintingInReach();
        },
    };
    return model;

    /** Pushes the visitor out of the walls between the corridors, the benches and the pots, then back inside the outer walls. */
    function keepVisitorClear(): void {
        for (let i = 0; i < PARTITION_STANDS.length; i++) visitor.pushOutOf(PARTITION_STANDS[i], PARTITIONS[i].sizeX, PARTITIONS[i].sizeZ);
        for (let i = 0; i < BENCHES.length; i++) visitor.pushOutOf(BENCHES[i], BENCH_LENGTH, BENCH_WIDTH);
        for (let i = 0; i < POT_STANDS.length; i++) visitor.pushOutOf(POT_STANDS[i], POT_SIZE, POT_SIZE);
        visitor.keepInside(-ROOM_LENGTH / 2, ROOM_LENGTH / 2, -ROOM_WIDTH / 2, ROOM_WIDTH / 2);
    }

    /** Whether the visitor has walked up to the gallery's door, in its west wall. */
    function isAtGalleryDoor(): boolean {
        return visitor.x <= DOOR_X + VISITOR_RADIUS + DOORWAY_DEPTH && Math.abs(visitor.z - DOOR_Z) < DOOR_WIDTH / 2;
    }

    /** Whether the visitor has walked up to the lantern room's door, in its east wall. */
    function isAtLanternRoomDoor(): boolean {
        return visitor.x >= LANTERN_ROOM_EAST_X - VISITOR_RADIUS - DOORWAY_DEPTH && Math.abs(visitor.z) < DOOR_WIDTH / 2;
    }

    /** Finds the nearest painting the visitor is close to and facing, if any is in reach. */
    function findPaintingInReach(): void {
        paintingInReach = undefined;
        let nearest = REACH;
        for (let i = 0; i < paintings.length; i++) {
            const distance = visitor.distanceToUse(paintings[i], 0, VIEW_DISTANCE);
            if (distance < nearest) {
                nearest = distance;
                paintingInReach = paintings[i];
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the visitor looks down at first, a little, so a painting's middle sits a little above the view's. How far they can look up or down. */
const START_PITCH = -0.04;
const MAX_PITCH = 1.2;
/** How far the visitor steps back from a painting when they stop viewing it. */
const STEP_BACK = 0.4;
/** The middle of the gallery's door, in its west wall. */
const DOOR_X = -ROOM_LENGTH / 2;
/** The lantern room's east wall, where its door is, across from the middle of the room. */
const LANTERN_ROOM_EAST_X = LANTERN_ROOM_X + LANTERN_ROOM_SIZE / 2;
/** How close to the wall the visitor gets before a door takes them through it. */
const DOORWAY_DEPTH = 0.02;
/** How far in from a door the visitor arrives through it. */
const ARRIVAL_STEP = 0.9;
/** The headings that face east and west. */
const EAST = 0;
const WEST = Math.PI;
/** The walls between the corridors, as stands facing east, so their length runs along x, for pushing the visitor out of. */
const PARTITION_STANDS: readonly Stand[] = PARTITIONS.map((wall) => ({ x: wall.x, z: wall.z, facing: 0 }));
/** The benches, each along its corridor. */
const BENCHES: readonly Stand[] = BENCH_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, facing: 0 }));
const POT_STANDS: readonly Stand[] = POT_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, facing: 0 }));

/**
 * Whether the straight line from (`x0`, `z0`) to (`x1`, `z1`) passes
 * through `block`, seen from above. The line runs from 0 to 1 along its
 * length. It's cut to the part inside the block's span along x, then to
 * the part inside its span along z. If anything of it is left, it passes
 * through. It can run every frame, so it keeps its numbers in locals
 * rather than in an object.
 */
function crossesBlock(x0: number, z0: number, x1: number, z1: number, block: WallBlock): boolean {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const minX = block.x - block.sizeX / 2;
    const maxX = block.x + block.sizeX / 2;
    const minZ = block.z - block.sizeZ / 2;
    const maxZ = block.z + block.sizeZ / 2;
    let enter = 0;
    let leave = 1;
    if (dx === 0) {
        if (x0 < minX || x0 > maxX) return false;
    }
    else {
        const a = (minX - x0) / dx;
        const b = (maxX - x0) / dx;
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
    }
    if (dz === 0) {
        if (z0 < minZ || z0 > maxZ) return false;
    }
    else {
        const a = (minZ - z0) / dz;
        const b = (maxZ - z0) / dz;
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
    }
    return enter <= leave;
}

/** Hangs a painting at each of the first `count` hanging spots, its picture just out from the wall. */
function hangPaintings(count: number): Painting[] {
    if (count > HANGING_SPOTS.length) throw new Error(`gallery: ${count} demos, but the walls have room for ${HANGING_SPOTS.length}`);
    const paintings: Painting[] = [];
    for (let index = 0; index < count; index++) {
        const spot = HANGING_SPOTS[index];
        paintings.push({
            index,
            x: spot.x + Math.cos(spot.facing) * PAINTING_STANDOFF,
            z: spot.z + Math.sin(spot.facing) * PAINTING_STANDOFF,
            facing: spot.facing,
        });
    }
    return paintings;
}
