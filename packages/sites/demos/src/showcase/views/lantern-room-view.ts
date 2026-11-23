import {
    BatchedMesh3D, Container3D, CubeGeometry, FlatMaterial, Material3D, Matrix4, Mesh3D, PlaneGeometry, RenderPassBit, type ShaderBit,
    SphereGeometry,
} from '@pixi/3d';
import { ownResources, setRefresh, setUpdate } from '@mvtjs/pixi-3d';
import { DOOR_HEIGHT, DOOR_WIDTH, LANTERN_RISE, LANTERN_ROOM_SIZE, LANTERN_ROOM_X, type LanternSpot, ROOM_HEIGHT } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LanternRoomViewBindings {
    /** Where each lantern hangs. */
    readonly lanterns: readonly LanternSpot[];
    /** Where the visitor stands, in metres. */
    readonly visitorX: () => number;
    readonly visitorZ: () => number;
    /** Whether the visitor is in the room. Out of it, the room is hidden, and its lanterns stay as they were. */
    readonly isShown: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The lantern room, the gallery's hidden room. It's dark and square, and
 * hung with a field of glowing lanterns, each on a thread from the ceiling. The
 * lanterns hang about head height. As the visitor walks among them, the
 * lanterns near them rise out of the way and brighten, so the field parts
 * round them. Lanterns rise quickly and settle slowly, so a glowing wake
 * trails behind the visitor as they walk. The lanterns' colours sweep from
 * amber through rose to violet across the room, and the whole sweep turns
 * slowly round the colour wheel while the visitor is there. The doorway
 * back is a bright opening in the east wall, the lit gallery seen through it.
 *
 * How far each lantern has risen, and how far the colours have turned, are
 * presentation state, which the update step moves on. The lanterns are
 * drawn as one batch, and the threads as another, so the room takes two
 * draw calls however many lanterns hang in it. Each refresh writes every
 * lantern's position and colour into the batches, with no allocation.
 * When the view is destroyed, it frees the shapes and materials that it made.
 */
export function LanternRoomView(bindings: LanternRoomViewBindings): Container3D {
    const { lanterns, visitorX, visitorZ, isShown } = bindings;
    const count = lanterns.length;
    const view = new Container3D();
    view.addChild(createRoom());

    const glass = new SphereGeometry({ radius: LANTERN_RADIUS, widthSegments: 16, heightSegments: 10 });
    const lanternField = new BatchedMesh3D({ size: count, instanceData: { tint: { value: [1, 1, 1, 1], type: 'vec4<f32>' } } });
    const lanternMaterial = new FlatMaterial({ baseColor: 0xffffff, extraBits: [TINT_BIT] });
    const thread = new CubeGeometry({ width: THREAD_WIDTH, height: 1, depth: THREAD_WIDTH });
    const threadField = new BatchedMesh3D({ size: count });
    const threadMaterial = new FlatMaterial({ baseColor: 0x3a3a46 });
    // The batches are the view's children, so they're destroyed with it. Destroying a batch doesn't free its geometry or material, so the view frees those itself
    ownResources(view, [glass, lanternMaterial, thread, threadMaterial]);
    // Each lantern's own hue, from amber at one corner through rose to violet at the other, in degrees
    const hues = new Float32Array(count);
    // Each lantern's colour this refresh, as red, green and blue
    const colours = new Float32Array(3);
    for (let i = 0; i < count; i++) {
        lanternField.setGeometryAt(i, glass);
        lanternField.setMaterialAt(i, lanternMaterial);
        lanternField.setPassesAt(i, RenderPassBit.OPAQUE);
        threadField.setGeometryAt(i, thread);
        threadField.setMaterialAt(i, threadMaterial);
        threadField.setPassesAt(i, RenderPassBit.OPAQUE);
        const sweep = (lanterns[i].x - LANTERN_ROOM_X + lanterns[i].z) / (2 * LANTERN_ROOM_SIZE) + 0.5;
        hues[i] = AMBER_HUE + sweep * HUE_SWEEP;
    }
    view.addChild(lanternField, threadField);

    // Presentation state. It's how far each lantern has risen, from 0 at rest to 1 out of the visitor's way,
    // and how far the colours have turned round the wheel, in degrees
    const lifts = new Float32Array(count);
    let turnDeg = 0;
    const matrix = new Matrix4();
    const position = { x: 0, y: 0, z: 0 };

    setUpdate(view, (deltaMs) => {
        if (!isShown() || deltaMs === 0) return;
        turnDeg = (turnDeg + (deltaMs / COLOUR_TURN_MS) * 360) % 360;
        const x = visitorX();
        const z = visitorZ();
        const rising = 1 - Math.exp(-deltaMs / RISE_MS);
        const settling = 1 - Math.exp(-deltaMs / SETTLE_MS);
        for (let i = 0; i < count; i++) {
            const target = nearnessOf(Math.hypot(lanterns[i].x - x, lanterns[i].z - z));
            lifts[i] += (target - lifts[i]) * (target > lifts[i] ? rising : settling);
        }
    });

    setRefresh(view, () => {
        const shown = isShown();
        view.visible = shown;
        if (!shown) return;
        const { data, stride, offset, fields } = lanternField.instanceData;
        for (let i = 0, o = offset + fields.tint; i < count; i++, o += stride) {
            const lantern = lanterns[i];
            const lift = lifts[i];
            const height = lantern.height + lift * LANTERN_RISE;
            position.x = lantern.x;
            position.y = height;
            position.z = lantern.z;
            const swell = 1 + lift * SWELL;
            lanternField.setMatrixAt(i, matrix.makeScale(swell, swell, swell).setPosition(position));
            // The thread runs from the ceiling down to the top of the lantern
            const length = ROOM_HEIGHT - height - LANTERN_RADIUS * swell;
            position.y = ROOM_HEIGHT - length / 2;
            threadField.setMatrixAt(i, matrix.makeScale(1, length, 1).setPosition(position));
            // A lantern glows dimly at rest, and brightly as it rises, whitening a little at its brightest
            const glow = REST_GLOW + (1 - REST_GLOW) * lift;
            const white = lift * lift * WHITENING;
            writeHue(colours, hues[i] + turnDeg);
            data[o] = (colours[0] * (1 - white) + white) * glow;
            data[o + 1] = (colours[1] * (1 - white) + white) * glow;
            data[o + 2] = (colours[2] * (1 - white) + white) * glow;
        }
        lanternField.instanceData.update();
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WALL_THICKNESS = 0.2;
/** A lantern's size, and its thread's thickness, in metres. */
const LANTERN_RADIUS = 0.11;
const THREAD_WIDTH = 0.008;
/** How much bigger a lantern grows as it rises, at most. */
const SWELL = 0.35;
/** How brightly a lantern glows at rest, from 0 to 1, and how far toward white it turns at its brightest. */
const REST_GLOW = 0.55;
const WHITENING = 0.35;
/** How quickly a lantern rises as the visitor comes, and settles once they've passed, as the time it takes to go most of the way. */
const RISE_MS = 220;
const SETTLE_MS = 1600;
/** A lantern starts to rise within the first distance of the visitor, and is all the way up within the second, in metres. */
const NEAR_START = 2.6;
const NEAR_FULL = 0.5;
/** The lanterns' colours, as hues round the colour wheel, in degrees: amber at one corner, and on through rose to violet. */
const AMBER_HUE = 34;
const HUE_SWEEP = -110;
/** How long the colours take to turn all the way round the wheel, in milliseconds: slowly, so the change creeps up on the visitor. */
const COLOUR_TURN_MS = 48_000;

/** Multiplies a lantern's colour by its slot's tint, which the view writes each refresh. */
const TINT_BIT: ShaderBit = {
    name: 'lanternTint',
    bindings: { instance: { tint: 'vec4<f32>' } },
    gpu: { fragment: { material: 'albedo *= instance.tint.rgb;' } },
    gl: { fragment: { material: 'albedo *= instance.tint.rgb;' } },
};

/** How near a lantern is to the visitor, `distance` metres away: 0 out of reach, rising smoothly to 1 close by. */
function nearnessOf(distance: number): number {
    const t = Math.min(1, Math.max(0, (NEAR_START - distance) / (NEAR_START - NEAR_FULL)));
    return t * t * (3 - 2 * t);
}

/** Writes the fully saturated, bright colour of `hue` degrees into `out`, as red, green and blue from 0 to 1. */
function writeHue(out: Float32Array, hue: number): void {
    const h = (((hue % 360) + 360) % 360) / 60;
    // Softened toward white a touch, so the lanterns read as warm light rather than paint
    out[0] = 0.12 + 0.88 * channelOf(h, 5);
    out[1] = 0.12 + 0.88 * channelOf(h, 3);
    out[2] = 0.12 + 0.88 * channelOf(h, 1);
}

/** One channel of the bright colour at `h`, a sixth of the way round the wheel for each 1: red at `n` 5, green at 3, blue at 1. */
function channelOf(h: number, n: number): number {
    const k = (n + h) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
}

/**
 * Builds the room. It has a dark floor, walls and ceiling, lit only by the
 * gallery's faint ambient light, so the lanterns are what shows. The bright
 * doorway back is in the east wall.
 */
function createRoom(): Container3D {
    const room = new Container3D();
    const half = LANTERN_ROOM_SIZE / 2;
    const dark = new Material3D({ baseColor: 0x0e0d13, roughness: 1 });
    const floor = new Material3D({ baseColor: 0x0d0c12, roughness: 1 });
    const surface = new PlaneGeometry({ width: LANTERN_ROOM_SIZE, height: LANTERN_ROOM_SIZE });
    const floorMesh = new Mesh3D({ geometry: surface, material: floor, x: LANTERN_ROOM_X });
    floorMesh.rotation.set(-Math.PI / 2, 0, 0);
    const ceilingMesh = new Mesh3D({ geometry: surface, material: dark, x: LANTERN_ROOM_X, y: ROOM_HEIGHT });
    ceilingMesh.rotation.set(Math.PI / 2, 0, 0);
    room.addChild(floorMesh, ceilingMesh);
    const across = new CubeGeometry({ width: LANTERN_ROOM_SIZE + 2 * WALL_THICKNESS, height: ROOM_HEIGHT, depth: WALL_THICKNESS });
    const along = new CubeGeometry({ width: WALL_THICKNESS, height: ROOM_HEIGHT, depth: LANTERN_ROOM_SIZE });
    room.addChild(
        new Mesh3D({ geometry: across, material: dark, x: LANTERN_ROOM_X, y: ROOM_HEIGHT / 2, z: -half - WALL_THICKNESS / 2 }),
        new Mesh3D({ geometry: across, material: dark, x: LANTERN_ROOM_X, y: ROOM_HEIGHT / 2, z: half + WALL_THICKNESS / 2 }),
        new Mesh3D({ geometry: along, material: dark, x: LANTERN_ROOM_X - half - WALL_THICKNESS / 2, y: ROOM_HEIGHT / 2 }),
        new Mesh3D({ geometry: along, material: dark, x: LANTERN_ROOM_X + half + WALL_THICKNESS / 2, y: ROOM_HEIGHT / 2 }),
    );
    // The doorway back shows the bright gallery beyond. A plane faces +z, so it's turned to face west, into the room
    const opening = new PlaneGeometry({ width: DOOR_WIDTH, height: DOOR_HEIGHT });
    const light = new FlatMaterial({ baseColor: 0xf4f2ec });
    const doorway = new Mesh3D({
        geometry: opening,
        material: light,
        x: LANTERN_ROOM_X + half - 0.005,
        y: DOOR_HEIGHT / 2,
    });
    doorway.rotation.set(0, -Math.PI / 2, 0);
    room.addChild(doorway);
    return ownResources(room, [dark, floor, surface, across, along, opening, light]);
}
