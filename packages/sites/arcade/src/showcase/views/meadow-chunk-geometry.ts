import { Geometry3D } from '@pixi/3d';
import { TRUNK_WIDTH } from '../data';
import { type MeadowGround, type MeadowTerrain, WATER_LEVEL } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The geometry of one square chunk of the meadow. Its ground holds its trees and flowers too, and its water is apart, if a river runs through it. */
export interface MeadowChunkGeometry {
    readonly ground: Geometry3D;
    readonly water: Geometry3D | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MeadowChunkGeometryOptions {
    readonly terrain: MeadowTerrain;
    /** The chunk's first cell, at its corner nearest -x and -z, and how many cells it is on a side. */
    readonly firstCol: number;
    readonly firstRow: number;
    readonly size: number;
    /**
     * How much detail to build. A near chunk has every cell and every tree
     * in full. A far one, too far off for its detail to show, has cells
     * two cells across, simpler trees and no flowers, so far more of the
     * valley can be in view at once.
     */
    readonly detail: MeadowChunkDetail;
}

export type MeadowChunkDetail = 'near' | 'far';

/** How many cells a chunk is on a side. */
export const MEADOW_CHUNK_SIZE = 16;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Builds a chunk of the meadow in a simple, low-poly style, in bright colours.
 * The ground is a sheet of triangles, two to each cell, that follows the
 * hills. Each triangle is one flat colour, shaded by the way it faces, as if
 * lit by a high sun, so the slopes show without any lights. Trees are a
 * trunk with leaves of cones or a faceted ball, and flowers are little
 * coloured heads on stems. The water is a sheet of its own, to draw
 * see-through.
 */
export function createMeadowChunkGeometry(options: MeadowChunkGeometryOptions): MeadowChunkGeometry {
    const { terrain, firstCol, firstRow, size, detail } = options;
    const ground = createBuilder();
    const water = createBuilder();
    if (detail === 'far') {
        addFarChunk();
        return { ground: ground.build(), water: water.isEmpty() ? undefined : water.build() };
    }
    // The height at each corner of the cells, worked out once, since four cells share each
    const span = size + 1;
    const heights = new Float32Array(span * span);
    for (let r = 0; r < span; r++) {
        for (let c = 0; c < span; c++) heights[r * span + c] = terrain.heightAt(firstCol + c, firstRow + r);
    }
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) addCell(c, r);
    }
    addSkirts(heights, 1);
    return { ground: ground.build(), water: water.isEmpty() ? undefined : water.build() };

    /**
     * Builds the chunk with less detail. The ground is in squares of four
     * cells, and each tree is a few faces.
     */
    function addFarChunk(): void {
        const cells = size / FAR_STEP;
        const span = cells + 1;
        const heights = new Float32Array(span * span);
        for (let r = 0; r < span; r++) {
            for (let c = 0; c < span; c++) heights[r * span + c] = terrain.heightAt(firstCol + c * FAR_STEP, firstRow + r * FAR_STEP);
        }
        for (let r = 0; r < cells; r++) {
            for (let c = 0; c < cells; c++) {
                const col = firstCol + c * FAR_STEP;
                const row = firstRow + r * FAR_STEP;
                const x1 = col + FAR_STEP;
                const z1 = row + FAR_STEP;
                const h00 = heights[r * span + c];
                const h10 = heights[r * span + c + 1];
                const h01 = heights[(r + 1) * span + c];
                const h11 = heights[(r + 1) * span + c + 1];
                const variety = terrain.varietyAt(col, row);
                const isShaded = isFarCellShaded(col, row);
                const groundA = colourOf(terrain.groundAt(col + 0.7, row + 0.7), variety, isShaded);
                const groundB = colourOf(terrain.groundAt(col + 1.3, row + 1.3), variety + 0.5, isShaded);
                ground.addTriangle(col, h00, row, col, h01, z1, x1, h11, z1, groundA, BELOW);
                ground.addTriangle(col, h00, row, x1, h11, z1, x1, h10, row, groundB, BELOW);
                if (Math.min(h00, h10, h01, h11) < WATER_LEVEL) water.addQuad(col, row, x1, z1, WATER_LEVEL, pick(WATER_COLOURS, variety));
                for (let dr = 0; dr < FAR_STEP; dr++) {
                    for (let dc = 0; dc < FAR_STEP; dc++) {
                        if (terrain.kindAt(col + dc, row + dr) === 'tree') addFarTree(col + dc + 0.5, row + dr + 0.5, terrain.varietyAt(col + dc, row + dr));
                    }
                }
            }
        }
        addSkirts(heights, FAR_STEP);
    }

    /**
     * Hangs a strip down from each edge of the ground, whose corners have the
     * `heights`, `step` cells apart. Where a near chunk meets a far one, the
     * near one's edge has corners part way along the far one's, a little
     * above or below it. The slivers of gap between them would show the sky,
     * so the skirts fill them, whichever chunk is higher.
     */
    function addSkirts(heights: Float32Array, step: number): void {
        const cells = size / step;
        const span = cells + 1;
        const last = firstCol + size;
        const bottom = firstRow + size;
        for (let i = 0; i < cells; i++) {
            const a = firstCol + i * step;
            const b = firstRow + i * step;
            addSkirt(a, firstRow, heights[i], a + step, firstRow, heights[i + 1]);
            addSkirt(a, bottom, heights[cells * span + i], a + step, bottom, heights[cells * span + i + 1]);
            addSkirt(firstCol, b, heights[i * span], firstCol, b + step, heights[(i + 1) * span]);
            addSkirt(last, b, heights[i * span + cells], last, b + step, heights[(i + 1) * span + cells]);
        }
    }

    /** Whether a far square is in a forest's shade, with trees on at least two of its four cells. */
    function isFarCellShaded(col: number, row: number): boolean {
        let trees = 0;
        for (let dr = 0; dr < FAR_STEP; dr++) {
            for (let dc = 0; dc < FAR_STEP; dc++) {
                if (terrain.kindAt(col + dc, row + dr) === 'tree') trees++;
            }
        }
        return trees >= 2;
    }

    /** Hangs a strip down from the ground's edge, from (`ax`, `az`) to (`bx`, `bz`). */
    function addSkirt(ax: number, az: number, ah: number, bx: number, bz: number, bh: number): void {
        const colour = SHADED_GRASS[0];
        ground.addTriangle(ax, ah, az, bx, bh, bz, bx, bh - SKIRT_DEPTH, bz, colour, BELOW);
        ground.addTriangle(ax, ah, az, bx, bh - SKIRT_DEPTH, bz, ax, ah - SKIRT_DEPTH, az, colour, BELOW);
    }

    /** Adds a far tree: a thin trunk, and leaves as a single cone for a pine, or a double cone for a round tree. */
    function addFarTree(x: number, z: number, variety: number): void {
        const groundHeight = terrain.heightAt(x, z);
        const tall = 1 + fraction(variety * 13) * 0.5;
        const shape = Math.floor(variety * 1000) % 10;
        const skirt = groundHeight + LEAVES_CLEARANCE;
        if (shape < 4) {
            ground.addPrism(x, z, TRUNK_RADIUS, groundHeight - 0.2, skirt + 0.5, FAR_SIDES_TRUNK, TRUNK);
            ground.addCone(x, z, 1.5, skirt, skirt + 4.5 * tall, FAR_SIDES, pick(PINE_LEAVES, variety * 7), false);
            return;
        }
        const colour = isInBlossom(variety) ? BLOSSOM : pick(LEAVES, variety * 7);
        const height = 1.5 * tall;
        const middle = skirt + height;
        ground.addPrism(x, z, TRUNK_RADIUS, groundHeight - 0.2, middle, FAR_SIDES_TRUNK, TRUNK);
        ground.addCone(x, z, 1.5, middle, middle + height, FAR_SIDES, colour, false);
        ground.addCone(x, z, 1.5, middle, middle - height, FAR_SIDES, colour, false);
    }

    function addCell(c: number, r: number): void {
        const col = firstCol + c;
        const row = firstRow + r;
        const h00 = heights[r * span + c];
        const h10 = heights[r * span + c + 1];
        const h01 = heights[(r + 1) * span + c];
        const h11 = heights[(r + 1) * span + c + 1];
        const variety = terrain.varietyAt(col, row);
        const isShaded = isUnderCanopy(col, row);
        const groundA = colourOf(terrain.groundAt(col + 0.33, row + 0.33), variety, isShaded);
        const groundB = colourOf(terrain.groundAt(col + 0.67, row + 0.67), variety + 0.5, isShaded);
        // Two triangles, split along alternate diagonals, so the slopes don't all lean the same way
        if ((col + row) % 2 === 0) {
            ground.addTriangle(col, h00, row, col, h01, row + 1, col + 1, h11, row + 1, groundA, BELOW);
            ground.addTriangle(col, h00, row, col + 1, h11, row + 1, col + 1, h10, row, groundB, BELOW);
        }
        else {
            ground.addTriangle(col, h00, row, col, h01, row + 1, col + 1, h10, row, groundA, BELOW);
            ground.addTriangle(col + 1, h10, row, col, h01, row + 1, col + 1, h11, row + 1, groundB, BELOW);
        }
        if (Math.min(h00, h10, h01, h11) < WATER_LEVEL) {
            water.addQuad(col, row, col + 1, row + 1, WATER_LEVEL, pick(WATER_COLOURS, variety));
        }
        const kind = terrain.kindAt(col, row);
        if (kind === 'tree') addTree(col + 0.5, row + 0.5, variety);
        else if (kind === 'flowers') addFlowers(col, row, variety);
    }

    /** Whether the cell is in the shade of a forest, with trees on it or on at least two of the cells beside it. */
    function isUnderCanopy(col: number, row: number): boolean {
        if (terrain.kindAt(col, row) === 'tree') return true;
        let trees = 0;
        if (terrain.kindAt(col + 1, row) === 'tree') trees++;
        if (terrain.kindAt(col - 1, row) === 'tree') trees++;
        if (terrain.kindAt(col, row + 1) === 'tree') trees++;
        if (terrain.kindAt(col, row - 1) === 'tree') trees++;
        return trees >= 2;
    }

    /**
     * Adds a tree, a trunk with leaves in one of a few shapes and colours.
     * Every tree's leaves start above the player's head, so they can walk
     * through a forest under its canopy.
     */
    function addTree(x: number, z: number, variety: number): void {
        const groundHeight = terrain.heightAt(x, z);
        // Planted a little into the ground, so a trunk on a slope still meets the ground on its low side
        const base = groundHeight - 0.2;
        // Some trees are taller than others, by up to a half
        const tall = 1 + fraction(variety * 13) * 0.5;
        // The variety's digits pick the shape and colour, so the two vary apart
        const shape = Math.floor(variety * 1000) % 10;
        if (shape < 4) {
            // A pine, three tiers of dark leaves, each narrower than the one below
            const colour = pick(PINE_LEAVES, variety * 7);
            const skirt = groundHeight + LEAVES_CLEARANCE;
            ground.addPrism(x, z, TRUNK_RADIUS, base, skirt + 0.5, TRUNK_SIDES, TRUNK);
            ground.addCone(x, z, 1.5, skirt, skirt + 2.3 * tall, CONE_SIDES, colour, true);
            ground.addCone(x, z, 1.1, skirt + 1.3 * tall, skirt + 3.5 * tall, CONE_SIDES, colour, true);
            ground.addCone(x, z, 0.7, skirt + 2.5 * tall, skirt + 4.5 * tall, CONE_SIDES, colour, true);
            return;
        }
        // A round tree, a tall ball of leaves on a long trunk, now and then in blossom
        const colour = isInBlossom(variety) ? BLOSSOM : pick(LEAVES, variety * 7);
        const height = 1.5 * tall;
        const middle = groundHeight + LEAVES_CLEARANCE + height;
        ground.addPrism(x, z, TRUNK_RADIUS, base, middle, TRUNK_SIDES, TRUNK);
        ground.addBall(x, middle, z, 1.5, height, colour);
    }

    /** Adds two or three flowers to a cell, each a stem and a coloured head. */
    function addFlowers(col: number, row: number, variety: number): void {
        const count = 2 + Math.floor(variety * 2);
        for (let i = 0; i < count; i++) {
            // Spread round the cell, at places worked out from the variety
            const x = col + 0.2 + fraction(variety * (17 + i * 31)) * 0.6;
            const z = row + 0.2 + fraction(variety * (29 + i * 13)) * 0.6;
            const y = terrain.heightAt(x, z);
            ground.addPrism(x, z, 0.015, y - 0.05, y + 0.24, 3, STEM);
            ground.addBall(x, y + 0.28, z, 0.075, 0.065, pick(FLOWERS, variety * (5 + i * 3)));
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The way the sunlight comes from, which shades each face, and how bright a face turned away from it still is. */
const SUN_X = 0.35;
const SUN_Y = 0.85;
const SUN_Z = 0.4;
const SUN_LENGTH = Math.hypot(SUN_X, SUN_Y, SUN_Z);
const SHADE_IN_SHADOW = 0.62;
/** A point far beneath the ground, which every face of the ground faces away from. */
const BELOW = { x: 0, y: -1000, z: 0 } as const;
/** A trunk, as wide as the player bumps into, and how high above the ground the leaves start, clear of the player's head. */
const TRUNK_RADIUS = TRUNK_WIDTH / 2;
const LEAVES_CLEARANCE = 2.2;
const TRUNK_SIDES = 5;
const CONE_SIDES = 7;
/** A far chunk's squares are this many cells across, and its trees have this many sides. A chunk's skirts hang this far down. */
const FAR_STEP = 2;
const FAR_SIDES = 5;
const FAR_SIDES_TRUNK = 3;
const SKIRT_DEPTH = 1.5;

// The meadow's colours, bright and clear, like a sunny day in a picture book
const GRASS: readonly number[] = [0x5fdc3c, 0x52d03a, 0x74e34a, 0x66d944];
/** The grass in a forest's shade, deeper and cooler. */
const SHADED_GRASS: readonly number[] = [0x34a63c, 0x2e9a3a, 0x3cb043, 0x379f45];
const SAND: readonly number[] = [0xffe08a, 0xf8d77c, 0xffe79d];
const RIVERBED = 0x3fb0c8;
const WATER_COLOURS: readonly number[] = [0x2bc0ff, 0x35caff, 0x22b4f5];
const TRUNK = 0x8c5528;
const LEAVES: readonly number[] = [0x2fbf4f, 0x3ad65c, 0x24ad57, 0x46c93a];
const PINE_LEAVES: readonly number[] = [0x1e9a5a, 0x168a4e, 0x23a868];
const BLOSSOM = 0xff8fd0;
const STEM = 0x3aa832;
const FLOWERS: readonly number[] = [0xff3d8b, 0xffd21f, 0xa45cff, 0xffffff, 0xff7a1f, 0x3dd6ff];

/** Whether a round tree is in blossom. About one tree in forty is, so a forest has a little pink in it here and there. */
function isInBlossom(variety: number): boolean {
    return Math.floor(variety * 1000) % 40 === 9;
}

function colourOf(ground: MeadowGround, variety: number, isShaded: boolean): number {
    if (ground === 'riverbed') return RIVERBED;
    if (ground === 'sand') return pick(SAND, variety);
    return pick(isShaded ? SHADED_GRASS : GRASS, variety);
}

/** Picks one of `colours` by `amount`, any number 0 or more, from its fraction. */
function pick(colours: readonly number[], amount: number): number {
    return colours[Math.floor(fraction(amount) * colours.length)];
}

function fraction(amount: number): number {
    return amount - Math.floor(amount);
}

/** Turns a colour channel from 0 to 1, as the screen shows it (sRGB), to linear light. */
function toLinear(channel: number): number {
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** A point, inside a shape, that its faces face away from. */
interface Inside {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

interface GeometryBuilder {
    /** Adds a triangle in one flat colour, shaded by the way it faces, away from `inside`. */
    readonly addTriangle: (
        ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number,
        colour: number, inside: Inside,
    ) => void;
    /** Adds a flat face facing up, from (x0, z0) to (x1, z1), at `y`. */
    readonly addQuad: (x0: number, z0: number, x1: number, z1: number, y: number, colour: number) => void;
    /** Adds an upright prism with `sides` sides, `radius` from its middle, centred on (`x`, `z`), from `bottom` to `top`. */
    readonly addPrism: (x: number, z: number, radius: number, bottom: number, top: number, sides: number, colour: number) => void;
    /**
     * Adds a cone with `sides` sides, its base `radius` wide at `bottom`, and
     * its point at `top`, which may be below `bottom` for a cone that points
     * down. With `hasBase`, it's closed underneath.
     */
    readonly addCone: (x: number, z: number, radius: number, bottom: number, top: number, sides: number, colour: number, hasBase: boolean) => void;
    /** Adds a faceted ball, an icosahedron, centred on (`x`, `y`, `z`), `radius` across and `height` up from its middle. */
    readonly addBall: (x: number, y: number, z: number, radius: number, height: number, colour: number) => void;
    readonly isEmpty: () => boolean;
    readonly build: () => Geometry3D;
}

/** Collects triangles, each with its own corners and colour, then builds geometry from them. */
function createBuilder(): GeometryBuilder {
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];

    const builder: GeometryBuilder = {
        addTriangle(ax, ay, az, bx, by, bz, cx, cy, cz, colour, inside) {
            // The face's normal, turned to point away from the inside
            const ux = bx - ax;
            const uy = by - ay;
            const uz = bz - az;
            const vx = cx - ax;
            const vy = cy - ay;
            const vz = cz - az;
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            const towardInside = (inside.x - ax) * nx + (inside.y - ay) * ny + (inside.z - az) * nz;
            if (towardInside > 0) {
                nx = -nx;
                ny = -ny;
                nz = -nz;
            }
            const length = Math.hypot(nx, ny, nz) || 1;
            const lit = Math.max(0, (nx * SUN_X + ny * SUN_Y + nz * SUN_Z) / (length * SUN_LENGTH));
            addFace(ax, ay, az, bx, by, bz, cx, cy, cz, colour, SHADE_IN_SHADOW + (1 - SHADE_IN_SHADOW) * lit);
        },
        addQuad(x0, z0, x1, z1, y, colour) {
            addFace(x0, y, z0, x0, y, z1, x1, y, z1, colour, 1);
            addFace(x0, y, z0, x1, y, z1, x1, y, z0, colour, 1);
        },
        addPrism(x, z, radius, bottom, top, sides, colour) {
            const inside = { x, y: (bottom + top) / 2, z };
            for (let i = 0; i < sides; i++) {
                const a = (i / sides) * Math.PI * 2;
                const b = ((i + 1) / sides) * Math.PI * 2;
                const ax = x + Math.cos(a) * radius;
                const az = z + Math.sin(a) * radius;
                const bx = x + Math.cos(b) * radius;
                const bz = z + Math.sin(b) * radius;
                builder.addTriangle(ax, bottom, az, bx, bottom, bz, bx, top, bz, colour, inside);
                builder.addTriangle(ax, bottom, az, bx, top, bz, ax, top, az, colour, inside);
            }
        },
        addCone(x, z, radius, bottom, top, sides, colour, hasBase) {
            const inside = { x, y: bottom + (top - bottom) * 0.25, z };
            const above = { x, y: bottom + Math.sign(top - bottom), z };
            for (let i = 0; i < sides; i++) {
                const a = (i / sides) * Math.PI * 2;
                const b = ((i + 1) / sides) * Math.PI * 2;
                const ax = x + Math.cos(a) * radius;
                const az = z + Math.sin(a) * radius;
                const bx = x + Math.cos(b) * radius;
                const bz = z + Math.sin(b) * radius;
                builder.addTriangle(ax, bottom, az, bx, bottom, bz, x, top, z, colour, inside);
                // The underside, seen when you stand beneath it
                if (hasBase) builder.addTriangle(ax, bottom, az, bx, bottom, bz, x, bottom, z, colour, above);
            }
        },
        addBall(x, y, z, radius, height, colour) {
            const inside = { x, y, z };
            for (let i = 0; i < ICOSAHEDRON_FACES.length; i += 3) {
                const a = ICOSAHEDRON_FACES[i] * 3;
                const b = ICOSAHEDRON_FACES[i + 1] * 3;
                const c = ICOSAHEDRON_FACES[i + 2] * 3;
                builder.addTriangle(
                    x + ICOSAHEDRON[a] * radius, y + ICOSAHEDRON[a + 1] * height, z + ICOSAHEDRON[a + 2] * radius,
                    x + ICOSAHEDRON[b] * radius, y + ICOSAHEDRON[b + 1] * height, z + ICOSAHEDRON[b + 2] * radius,
                    x + ICOSAHEDRON[c] * radius, y + ICOSAHEDRON[c + 1] * height, z + ICOSAHEDRON[c + 2] * radius,
                    colour, inside,
                );
            }
        },
        isEmpty: () => positions.length === 0,
        build: () => new Geometry3D({
            positions: new Float32Array(positions),
            colors: new Float32Array(colours),
            indices: new Uint32Array(indices),
        }),
    };
    return builder;

    function addFace(
        ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number,
        colour: number, shade: number,
    ): void {
        const first = positions.length / 3;
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        // Shaded as the screen shows it, then turned to linear light, which is how vertex colours are read
        const red = toLinear((((colour >> 16) & 0xff) / 255) * shade);
        const green = toLinear((((colour >> 8) & 0xff) / 255) * shade);
        const blue = toLinear(((colour & 0xff) / 255) * shade);
        for (let i = 0; i < 3; i++) colours.push(red, green, blue, 1);
        indices.push(first, first + 1, first + 2);
    }
}

/** The corners of an icosahedron, one unit from its middle, three numbers each. */
const ICOSAHEDRON: readonly number[] = createIcosahedron();
/** Its twenty faces, three corners each. */
const ICOSAHEDRON_FACES: readonly number[] = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

function createIcosahedron(): number[] {
    const t = (1 + Math.sqrt(5)) / 2;
    const corners = [-1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1];
    const length = Math.hypot(1, t);
    return corners.map((value) => value / length);
}
