import { BLUE, LIGHT_BLUE, VECTORS_CAPTION, WHITE } from '../../data';
import { MVT_MESH, TURN, type VectorsPartModel } from '../../models';
import { COLUMNS, DISPLAY_TOP, type VirtualChip } from '../chip';
import { plotMulticolour, writeWashed } from './paint-helpers';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 4. A multicolour bitmap, 160 x 184, with every cell given the same
 * three colours, dark to bright: so each pixel is one of four shades, and
 * a face's lighting is an ordered dither between two of them. The stars are
 * plotted first, one shade per layer; the letters are filled over them,
 * nearest pixel wins (a depth buffer, the luxury this demo allows itself).
 * The caption below is text.
 */
export function paintVectorsPart(chip: VirtualChip, vectors: VectorsPartModel, washPhase: number): void {
    chip.setMode(DISPLAY_TOP, DISPLAY_TOP + BITMAP_LINES, 'multicolour-bitmap');
    chip.screen.fill((BLUE << 4) | LIGHT_BLUE, 0, BITMAP_ROWS * COLUMNS);
    chip.colour.fill(WHITE, 0, BITMAP_ROWS * COLUMNS);

    for (let i = 0; i < vectors.starCount; i++) {
        const x = Math.floor(vectors.starColAt(i) * 4);
        const y = Math.floor(vectors.starRowAt(i) * 8);
        if (y < BITMAP_LINES) plotMulticolour(chip, x, y, vectors.starLayerAt(i) + 1);
    }

    transformMesh(vectors);
    depths.fill(0);
    const { faces, faceCount } = MVT_MESH;
    for (let f = 0; f < faceCount; f++) {
        // Turned normal, and whether the face looks towards the eye
        const nx = turnedNormals[f * 3];
        const ny = turnedNormals[f * 3 + 1];
        const nz = turnedNormals[f * 3 + 2];
        const a = faces[f * 4];
        if (nx * eyeSpace[a * 3] + ny * eyeSpace[a * 3 + 1] + nz * eyeSpace[a * 3 + 2] >= 0) continue;
        const light = nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z;
        const shade = (AMBIENT + (1 - AMBIENT) * (light > 0 ? light : 0)) * 3;
        fillTriangle(chip, a, faces[f * 4 + 1], faces[f * 4 + 2], shade);
        fillTriangle(chip, a, faces[f * 4 + 2], faces[f * 4 + 3], shade);
    }

    writeWashed(chip, CAPTION_ROW, VECTORS_CAPTION, washPhase);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The bitmap covers character rows 0-22; the caption is on row 23. */
const BITMAP_ROWS = 23;
const BITMAP_LINES = BITMAP_ROWS * 8;
const BITMAP_WIDTH = 160;
const CAPTION_ROW = 23;

/** The projection: screen pixels per object unit at distance 1, and where the object's centre lands. */
const FOCAL_LENGTH = 270;
const CENTRE_X = 160;
const CENTRE_Y = BITMAP_LINES / 2;

/** Towards the light: up, left and towards the eye. Unit length. */
const LIGHT_X = -0.45;
const LIGHT_Y = 0.55;
const LIGHT_Z = -0.704;
const AMBIENT = 0.12;

/** A 4 x 4 ordered dither: the threshold for each pixel, as a fraction. */
const BAYER = Float32Array.of(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5).map((v) => (v + 0.5) / 16);

// Scratch, preallocated so a frame allocates nothing
/** Vertices turned and moved away from the eye: x, y, z each. */
const eyeSpace = new Float32Array(MVT_MESH.vertexCount * 3);
/** Vertices projected: multicolour pixel x, line y, and 1/z. */
const projected = new Float32Array(MVT_MESH.vertexCount * 3);
const turnedNormals = new Float32Array(MVT_MESH.faceCount * 3);
/** 1/z of the nearest surface drawn at each pixel so far; 0 is infinitely far. */
const depths = new Float32Array(BITMAP_WIDTH * BITMAP_LINES);

function transformMesh(vectors: VectorsPartModel): void {
    const cy = Math.cos(TURN * vectors.yaw);
    const sy = Math.sin(TURN * vectors.yaw);
    const cp = Math.cos(TURN * vectors.pitch);
    const sp = Math.sin(TURN * vectors.pitch);
    const cr = Math.cos(TURN * vectors.roll);
    const sr = Math.sin(TURN * vectors.roll);
    const distance = vectors.distance;
    const { vertices, vertexCount, normals, faceCount } = MVT_MESH;

    for (let v = 0; v < vertexCount; v++) {
        turn(vertices, v, eyeSpace);
        const z = eyeSpace[v * 3 + 2] + distance;
        eyeSpace[v * 3 + 2] = z;
        // Multicolour pixels are two screen pixels wide
        projected[v * 3] = (CENTRE_X + (eyeSpace[v * 3] * FOCAL_LENGTH) / z) / 2;
        projected[v * 3 + 1] = CENTRE_Y - (eyeSpace[v * 3 + 1] * FOCAL_LENGTH) / z;
        projected[v * 3 + 2] = 1 / z;
    }
    for (let f = 0; f < faceCount; f++) turn(normals, f, turnedNormals);

    /** Turns point `i` of `from` by yaw, then pitch, then roll, into `to`. */
    function turn(from: Float32Array, i: number, to: Float32Array): void {
        const x = from[i * 3];
        const y = from[i * 3 + 1];
        const z = from[i * 3 + 2];
        const x1 = x * cy + z * sy;
        const z1 = z * cy - x * sy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        to[i * 3] = x1 * cr - y2 * sr;
        to[i * 3 + 1] = x1 * sr + y2 * cr;
        to[i * 3 + 2] = z2;
    }
}

/** Fills a projected triangle, keeping only pixels nearer than what is there, dithered to `shade` (0-3). */
function fillTriangle(chip: VirtualChip, a: number, b: number, c: number, shade: number): void {
    const ax = projected[a * 3];
    const ay = projected[a * 3 + 1];
    const bx = projected[b * 3];
    const by = projected[b * 3 + 1];
    const cx = projected[c * 3];
    const cy = projected[c * 3 + 1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) return;
    const invArea = 1 / area;
    const az = projected[a * 3 + 2];
    const bz = projected[b * 3 + 2];
    const cz = projected[c * 3 + 2];

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(BITMAP_WIDTH - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(BITMAP_LINES - 1, Math.ceil(Math.max(ay, by, cy)));
    const base = Math.floor(shade);
    const fraction = shade - base;

    for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5;
            // Barycentric weights; all of one sign inside, whichever way round the triangle is
            const wa = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * invArea;
            const wb = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * invArea;
            const wc = 1 - wa - wb;
            if (wa < 0 || wb < 0 || wc < 0) continue;
            const depth = wa * az + wb * bz + wc * cz;
            const i = y * BITMAP_WIDTH + x;
            if (depth <= depths[i]) continue;
            depths[i] = depth;
            const value = fraction > BAYER[(y & 3) * 4 + (x & 3)] ? base + 1 : base;
            plotMulticolour(chip, x, y, value > 3 ? 3 : value);
        }
    }
}
