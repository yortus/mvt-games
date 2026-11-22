import { Geometry3D } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GearGeometryOptions {
    /** How many teeth it has. */
    readonly teeth: number;
    /** How much each tooth adds to its pitch circle's diameter. Gears that mesh need the same module. */
    readonly module: number;
    /** How thick it is, along its axis. */
    readonly thickness: number;
    /** The radius of the hole through its middle, which its arbor or tube fills. */
    readonly boreRadius: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a flat spur gear, lying in the XZ plane round the Y axis, centred
 * on the origin. Its first tooth points along +X. A large gear is a rim of
 * teeth held to its hub by four spokes, cut out to make it light, as a
 * clockmaker would. A small one is solid. Every face is flat-shaded, so the
 * teeth catch the light one by one as the gear turns.
 */
export function createGearGeometry(options: GearGeometryOptions): Geometry3D {
    const { teeth, module, thickness, boreRadius } = options;
    const pitchRadius = (module * teeth) / 2;
    const tipRadius = pitchRadius + module;
    const rootRadius = pitchRadius - module * 1.25;
    const hubRadius = boreRadius + module * 1.6;
    const rimInnerRadius = rootRadius - module * 1.4;
    const hasSpokes = rimInnerRadius - hubRadius > module * 3;

    const builder = createFaceBuilder({ halfThickness: thickness / 2 });
    const profile = traceTeeth(teeth, rootRadius, tipRadius);
    if (hasSpokes) {
        builder.addRing(profile, traceCircle(profile, rimInnerRadius));
        builder.addRing(traceCircle(HUB_ANGLES, hubRadius), traceCircle(HUB_ANGLES, boreRadius));
        const spokeWidth = module * 1.6;
        for (let i = 0; i < SPOKE_COUNT; i++) {
            builder.addSpoke((i / SPOKE_COUNT) * TAU, hubRadius * 0.9, rimInnerRadius + module * 0.2, spokeWidth);
        }
    }
    else {
        builder.addRing(profile, traceCircle(profile, boreRadius));
    }
    return builder.build();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/** How many spokes a large gear has. */
const SPOKE_COUNT = 4;

/** Points round a tooth, as fractions of the angle between teeth from its middle, and whether each is at the tip or the root. */
const TOOTH_SHAPE: readonly { readonly offset: number; readonly isTip: boolean }[] = [
    { offset: -0.27, isTip: false },
    { offset: -0.15, isTip: true },
    { offset: 0.15, isTip: true },
    { offset: 0.27, isTip: false },
    // The middle of the gap to the next tooth, so the gap's floor follows the root circle
    { offset: 0.5, isTip: false },
];

/** A point in the XZ plane, as an angle round the axis and a radius. */
interface PolarPoint {
    readonly angle: number;
    readonly radius: number;
}

/** The angles round a hub, evenly spaced. */
const HUB_ANGLES: readonly PolarPoint[] = Array.from({ length: 24 }, (_, i) => ({ angle: (i / 24) * TAU, radius: 0 }));

/** The outline of a gear's teeth, counterclockwise from just before the first tooth. */
function traceTeeth(teeth: number, rootRadius: number, tipRadius: number): PolarPoint[] {
    const points: PolarPoint[] = [];
    const pitch = TAU / teeth;
    for (let tooth = 0; tooth < teeth; tooth++) {
        for (let i = 0; i < TOOTH_SHAPE.length; i++) {
            const { offset, isTip } = TOOTH_SHAPE[i];
            points.push({ angle: (tooth + offset) * pitch, radius: isTip ? tipRadius : rootRadius });
        }
    }
    return points;
}

/** A circle of `radius`, with a point at each of `outline`'s angles, so the two can be joined into a ring of quads. */
function traceCircle(outline: readonly PolarPoint[], radius: number): PolarPoint[] {
    const points: PolarPoint[] = [];
    for (let i = 0; i < outline.length; i++) points.push({ angle: outline[i].angle, radius });
    return points;
}

/** A point in 3D. */
type Point3 = readonly [number, number, number];

/** Collects flat-shaded faces, each with its own corners, so its normal is its own. */
interface FaceBuilder {
    /** Adds a ring between two outlines with matching angles, with its top, its bottom and both its edges. */
    readonly addRing: (outer: readonly PolarPoint[], inner: readonly PolarPoint[]) => void;
    /** Adds a box at `angle`, reaching from radius `from` to `to`, `width` wide, a little thinner than the gear. */
    readonly addSpoke: (angle: number, from: number, to: number, width: number) => void;
    /** Returns the faces as a geometry. */
    readonly build: () => Geometry3D;
}

interface FaceBuilderOptions {
    /** Half the gear's thickness, the height of its top face above the middle. */
    readonly halfThickness: number;
}

function createFaceBuilder(options: FaceBuilderOptions): FaceBuilder {
    const { halfThickness } = options;
    const positions: number[] = [];
    const normals: number[] = [];

    return {
        addRing(outer, inner) {
            const count = outer.length;
            for (let i = 0; i < count; i++) {
                const next = (i + 1) % count;
                const o0 = toPoint(outer[i]);
                const o1 = toPoint(outer[next]);
                const i0 = toPoint(inner[i]);
                const i1 = toPoint(inner[next]);
                addQuad(lift(i0, 1), lift(o0, 1), lift(o1, 1), lift(i1, 1), UP);
                addQuad(lift(i0, -1), lift(o0, -1), lift(o1, -1), lift(i1, -1), DOWN);
                addQuad(lift(o0, -1), lift(o1, -1), lift(o1, 1), lift(o0, 1), computeOutward(o0, o1, 1));
                addQuad(lift(i0, -1), lift(i1, -1), lift(i1, 1), lift(i0, 1), computeOutward(i0, i1, -1));
            }
        },
        addSpoke(angle, from, to, width) {
            const ax = Math.cos(angle);
            const az = -Math.sin(angle);
            // Across the spoke, a quarter turn on
            const sx = -az * (width / 2);
            const sz = ax * (width / 2);
            const corners: Point3[] = [
                [ax * from - sx, 0, az * from - sz],
                [ax * to - sx, 0, az * to - sz],
                [ax * to + sx, 0, az * to + sz],
                [ax * from + sx, 0, az * from + sz],
            ];
            const thin = 0.7;
            const top = corners.map((c) => lift(c, thin));
            const bottom = corners.map((c) => lift(c, -thin));
            addQuad(top[0], top[1], top[2], top[3], UP);
            addQuad(bottom[0], bottom[1], bottom[2], bottom[3], DOWN);
            for (let i = 0; i < 4; i++) {
                const next = (i + 1) % 4;
                const side: Point3 = [
                    (corners[i][0] + corners[next][0]) / 2 - ax * (from + to) / 2,
                    0,
                    (corners[i][2] + corners[next][2]) / 2 - az * (from + to) / 2,
                ];
                addQuad(bottom[i], bottom[next], top[next], top[i], side);
            }
        },
        build() {
            const vertexCount = positions.length / 3;
            const indices = new Uint32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) indices[i] = i;
            return new Geometry3D({
                positions: new Float32Array(positions),
                normals: new Float32Array(normals),
                uvs: new Float32Array(vertexCount * 2),
                indices,
            });
        },
    };

    function lift(point: Point3, side: number): Point3 {
        return [point[0], halfThickness * side, point[2]];
    }

    /**
     * Adds a quad as two triangles, wound so it faces the way it should,
     * counterclockwise seen from that side, which PixiJS 3D draws as its
     * front. Its normal is worked out from its corners, not from `facing`,
     * which only says which way round.
     */
    function addQuad(a: Point3, b: Point3, c: Point3, d: Point3, facing: Point3): void {
        let normal = cross(subtract(b, a), subtract(c, a));
        const length = Math.hypot(normal[0], normal[1], normal[2]);
        if (length === 0) return;
        normal = [normal[0] / length, normal[1] / length, normal[2] / length];
        const isFacing = normal[0] * facing[0] + normal[1] * facing[1] + normal[2] * facing[2] >= 0;
        const order = isFacing ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
        const sign = isFacing ? 1 : -1;
        for (let i = 0; i < order.length; i++) {
            positions.push(order[i][0], order[i][1], order[i][2]);
            normals.push(normal[0] * sign, normal[1] * sign, normal[2] * sign);
        }
    }
}

const UP: Point3 = [0, 1, 0];
const DOWN: Point3 = [0, -1, 0];

function toPoint({ angle, radius }: PolarPoint): Point3 {
    return [radius * Math.cos(angle), 0, -radius * Math.sin(angle)];
}

/** Returns which way an edge from `a` to `b` faces, away from the axis when `side` is 1, or toward it when it's -1. */
function computeOutward(a: Point3, b: Point3, side: number): Point3 {
    return [((a[0] + b[0]) / 2) * side, 0, ((a[2] + b[2]) / 2) * side];
}

function subtract(a: Point3, b: Point3): Point3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Point3, b: Point3): Point3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
