import { createMultigridTiles, type MultigridTiles } from './multigrid-tiles';
import { type FrameKind, traceFrame } from './trace-frame';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A window: a rhombus tiling cut to a frame. Lengths are in tile edges, from
 * the frame's middle, with y down. A tile inside the frame is a whole
 * rhombus, with sides one tile edge long. A tile the frame crosses is cut to
 * fit it, so it has its own shape, and a sliver too small to hold is joined
 * to a cut tile beside it. A tile the frame only trims, taking a little of
 * it, keeps its rhombus's shape, as though the frame hid that part of it. Two tiles are neighbours if they share a side, or
 * part of one, inside the frame. Every tile's corners go round it the same way,
 * the way that makes its signed area positive. Tiles are numbered from the
 * middle out.
 */
export interface TilePatch {
    /** How many ways the tiling's tiles can point: 5 is the Penrose tiling. */
    readonly symmetry: number;
    readonly frame: FrameKind;
    readonly count: number;
    /**
     * Where each tile's corners start in `cornerXs` and `cornerYs`: tile
     * `t`'s run up to where tile `t + 1`'s start, so there is one more start
     * than there are tiles. A whole tile has four corners.
     */
    readonly cornerStarts: Int32Array;
    readonly cornerXs: Float64Array;
    readonly cornerYs: Float64Array;
    /**
     * Each tile's shape, from 0, the thinnest, up. Whole and trimmed tiles of
     * one shape are the same rhombus, turned, and only they can swap pieces.
     */
    readonly shapes: Uint8Array;
    /** Whether each tile was cut to a shape of its own by the frame, 1 if it was, so its piece never moves. */
    readonly cuts: Uint8Array;
    /**
     * Whether each tile was trimmed by the frame, 1 if it was: cut only a
     * little, so it is still its rhombus, part hidden by the frame, and its
     * piece moves as a whole tile's does. Its middle is well inside the
     * frame, with room round it for the ring that marks a free piece.
     */
    readonly trims: Uint8Array;
    /**
     * The corners of each tile's rhombus, as it was before any cut, four to a
     * tile, going round it the same way as every tile. A trimmed tile's
     * piece is this whole rhombus, part hidden by the frame, so it shows
     * whole once it is lifted out.
     */
    readonly rhombusXs: Float64Array;
    readonly rhombusYs: Float64Array;
    /** The middle of each tile. */
    readonly middleXs: Float64Array;
    readonly middleYs: Float64Array;
    /** Half the frame's width and height. */
    readonly halfWidth: number;
    readonly halfHeight: number;
    /** The tiles that share a side with `tile`. */
    readonly neighboursOf: (tile: number) => readonly number[];
    /** The tile at the point (`x`, `y`), or -1 if none is. */
    readonly tileAt: (x: number, y: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TilePatchOptions {
    readonly symmetry: number;
    readonly frame: FrameKind;
    /**
     * How much glass the window holds, as a count of the tiling's average
     * tile. Since the frame's tiles are cut smaller, the window has a few
     * more tiles than this.
     */
    readonly glass: number;
    /** How far the tiling's grids are slid, from 0 to 1, which changes its pattern. */
    readonly shift: number;
    /** Where in the tiling the window's middle is, in tile edges, so the window isn't always the same spot. */
    readonly centreX: number;
    readonly centreY: number;
    /** How far the tiling is turned in the frame, in radians. */
    readonly rotation: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a window. It lays a disc of the tiling, sizes the frame to hold the
 * glass asked for, and cuts every tile the frame crosses (Sutherland-Hodgman
 * clipping, since every frame is convex). A cut tile smaller than a share of
 * the average tile is a sliver, and joins the cut tile beside it that it
 * shares the longest side with, so the frame holds no splinters. Neighbours
 * come from the tiling's grid lines.
 */
export function createTilePatch(options: TilePatchOptions): TilePatch {
    const { symmetry, frame, glass, shift, centreX, centreY, rotation } = options;
    const outline = traceFrame(frame);
    const { tiles, size, averageArea } = layEnough(symmetry, glass, shift, centreX, centreY, outline);
    const frameCorners = outline.map((v) => v * size);
    const laid = tiles.count;

    // Every tile laid, turned about the window's middle, wound the same way, and cut to the frame. Tiles outside it
    // have no polygon
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const polygons: (number[] | undefined)[] = [];
    const isCutLaid = new Uint8Array(laid);
    const isTrimmedLaid = new Uint8Array(laid);
    const laidRhombi: number[][] = [];
    for (let t = 0; t < laid; t++) {
        let rhombus: number[] = [];
        for (let k = 0; k < 4; k++) {
            const x = tiles.cornerXs[t * 4 + k] - centreX;
            const y = tiles.cornerYs[t * 4 + k] - centreY;
            rhombus.push(x * cos - y * sin, x * sin + y * cos);
        }
        if (measureArea(rhombus) < 0) rhombus = reversePolygon(rhombus);
        laidRhombi.push(rhombus);
        if (isPolygonInside(rhombus, frameCorners)) {
            polygons.push(rhombus);
            continue;
        }
        const cut = cutPolygon(rhombus, frameCorners);
        if (cut.length < 6 || measureArea(cut) < LEAST_AREA) {
            polygons.push(undefined);
            continue;
        }
        polygons.push(cut);
        isCutLaid[t] = 1;
        if (isTrimmedOnly(cut, rhombus, frameCorners)) isTrimmedLaid[t] = 1;
    }

    const neighbours = findNeighbours(tiles);
    joinSlivers(polygons, isCutLaid, isTrimmedLaid, neighbours, averageArea * SLIVER_SHARE);

    // The tiles kept, numbered afresh from the middle out
    const kept: number[] = [];
    const laidMiddleXs = new Float64Array(laid);
    const laidMiddleYs = new Float64Array(laid);
    for (let t = 0; t < laid; t++) {
        const polygon = polygons[t];
        if (polygon === undefined) continue;
        kept.push(t);
        const [x, y] = findCentroid(polygon);
        laidMiddleXs[t] = x;
        laidMiddleYs[t] = y;
    }
    const distance = (t: number): number => Math.hypot(laidMiddleXs[t], laidMiddleYs[t]);
    kept.sort((a, b) => distance(a) - distance(b) || a - b);
    const count = kept.length;
    const index = new Int32Array(laid).fill(-1);
    for (let i = 0; i < count; i++) index[kept[i]] = i;

    const cornerStarts = new Int32Array(count + 1);
    for (let i = 0; i < count; i++) cornerStarts[i + 1] = cornerStarts[i] + polygons[kept[i]]!.length / 2;
    const cornerXs = new Float64Array(cornerStarts[count]);
    const cornerYs = new Float64Array(cornerStarts[count]);
    const shapes = new Uint8Array(count);
    const cuts = new Uint8Array(count);
    const trims = new Uint8Array(count);
    const rhombusXs = new Float64Array(count * 4);
    const rhombusYs = new Float64Array(count * 4);
    const middleXs = new Float64Array(count);
    const middleYs = new Float64Array(count);
    const neighbourLists: number[][] = [];
    for (let i = 0; i < count; i++) {
        const t = kept[i];
        const polygon = polygons[t]!;
        for (let k = 0; k < polygon.length / 2; k++) {
            cornerXs[cornerStarts[i] + k] = polygon[k * 2];
            cornerYs[cornerStarts[i] + k] = polygon[k * 2 + 1];
        }
        shapes[i] = tiles.shapes[t];
        cuts[i] = isCutLaid[t] === 1 && isTrimmedLaid[t] === 0 ? 1 : 0;
        trims[i] = isTrimmedLaid[t];
        for (let k = 0; k < 4; k++) {
            rhombusXs[i * 4 + k] = laidRhombi[t][k * 2];
            rhombusYs[i * 4 + k] = laidRhombi[t][k * 2 + 1];
        }
        middleXs[i] = laidMiddleXs[t];
        middleYs[i] = laidMiddleYs[t];
        // Two tiles the frame cuts may have lost the side they shared, and are no longer neighbours
        const own: number[] = [];
        for (const other of neighbours[t]) {
            if (index[other] < 0) continue;
            if ((isCutLaid[t] === 1 || isCutLaid[other] === 1) && findSharedSide(polygon, polygons[other]!) === undefined) continue;
            own.push(index[other]);
        }
        own.sort((a, b) => a - b);
        neighbourLists.push(own);
    }

    let halfWidth = 0;
    let halfHeight = 0;
    for (let k = 0; k < frameCorners.length; k += 2) {
        halfWidth = Math.max(halfWidth, Math.abs(frameCorners[k]));
        halfHeight = Math.max(halfHeight, Math.abs(frameCorners[k + 1]));
    }

    return {
        symmetry,
        frame,
        count,
        cornerStarts,
        cornerXs,
        cornerYs,
        shapes,
        cuts,
        trims,
        rhombusXs,
        rhombusYs,
        middleXs,
        middleYs,
        halfWidth,
        halfHeight,
        neighboursOf: (tile) => neighbourLists[tile],
        tileAt(x, y) {
            for (let i = 0; i < count; i++) if (isPointInside(cornerXs, cornerYs, cornerStarts[i], cornerStarts[i + 1], x, y)) return i;
            return -1;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A cut tile smaller than this share of the average tile is a sliver, and joins a tile beside it. */
const SLIVER_SHARE = 0.3;
/**
 * A tile the frame cuts keeps its rhombus's shape, and its piece moves, if
 * it keeps at least this share of its glass, and its middle is at least
 * GRIP_ROOM tile edges inside the frame, so the ring that marks a free piece
 * shows whole. A TRIM_SHARE over 1 locks every tile the frame cuts.
 */
const TRIM_SHARE = 0.85;
const GRIP_ROOM = 0.2;
/** A cut tile with less area than this, in square tile edges, is only a touch of a corner, and is left out. */
const LEAST_AREA = 1e-9;
/** How much wider than the frame's furthest corner the disc is laid, in tile edges, so every neighbour is laid. */
const LAY_MARGIN = 3;
/** The frame's size is rounded to steps of this, in tile edges, so a last-bit difference in the average tile can't change it. */
const SIZE_STEP = 1 / 1024;
/** How close two corners are, in tile edges, to be taken as the same. */
const CORNER_TOLERANCE = 1e-6;
/** A line's key packs its grid and its number into one number. Lines are numbered from far below zero. */
const LINE_KEY_GRIDS = 32;
const LINE_KEY_OFFSET = 1 << 16;

/**
 * Lays a disc of tiles large enough to cover the frame, and finds the
 * frame's size: half its height, in tile edges, so it holds `glass` of the
 * average tile laid. A larger disc changes the average a little, so it lays
 * again until the disc covers the frame it sizes.
 */
function layEnough(
    symmetry: number, glass: number, shift: number, centreX: number, centreY: number, outline: readonly number[],
): { tiles: MultigridTiles; size: number; averageArea: number } {
    const tiles = createMultigridTiles();
    const outlineArea = measureArea(outline);
    let furthest = 0;
    for (let k = 0; k < outline.length; k += 2) furthest = Math.max(furthest, Math.hypot(outline[k], outline[k + 1]));
    let radius = Math.sqrt(glass) + LAY_MARGIN;
    for (;;) {
        tiles.lay(symmetry, shift, centreX, centreY, radius);
        let total = 0;
        for (let t = 0; t < tiles.count; t++) {
            const ax = tiles.cornerXs[t * 4 + 1] - tiles.cornerXs[t * 4];
            const ay = tiles.cornerYs[t * 4 + 1] - tiles.cornerYs[t * 4];
            const bx = tiles.cornerXs[t * 4 + 3] - tiles.cornerXs[t * 4];
            const by = tiles.cornerYs[t * 4 + 3] - tiles.cornerYs[t * 4];
            total += Math.abs(ax * by - ay * bx);
        }
        const averageArea = total / tiles.count;
        const size = Math.round(Math.sqrt((glass * averageArea) / outlineArea) / SIZE_STEP) * SIZE_STEP;
        const needed = furthest * size + LAY_MARGIN;
        if (radius >= needed) return { tiles, size, averageArea };
        radius = Math.max(radius + 1, needed);
    }
}

/**
 * Joins each sliver, the smallest first, to the tile beside it that it
 * shares the longest side with, preferring a cut or trimmed tile to a
 * whole one. The join makes the tile a shape of its own, cut, so a trimmed
 * tile's piece no longer moves. So a sliver joins a trimmed tile only if it
 * shares a side with it much longer than with any cut tile, and not always
 * a cut one, which could join a thin sliver by its short end, leaving a
 * spike of glass. A sliver that shares no side with any tile is left out.
 * Its neighbours become the tile's.
 */
function joinSlivers(
    polygons: (number[] | undefined)[], isCut: Uint8Array, isTrimmed: Uint8Array, neighbours: number[][], smallest: number,
): void {
    for (;;) {
        let sliver = -1;
        let sliverArea = smallest;
        for (let t = 0; t < polygons.length; t++) {
            const polygon = polygons[t];
            if (polygon === undefined || isCut[t] === 0) continue;
            const area = measureArea(polygon);
            if (area < sliverArea) {
                sliver = t;
                sliverArea = area;
            }
        }
        if (sliver < 0) return;

        const sliverPolygon = polygons[sliver]!;
        let best = -1;
        let bestSide: SharedSide | undefined;
        let bestScore = 0;
        for (const other of neighbours[sliver]) {
            const polygon = polygons[other];
            if (polygon === undefined) continue;
            const side = findSharedSide(polygon, sliverPolygon);
            if (side === undefined) continue;
            // A cut or trimmed tile beats a whole one, then the longer side wins, a trimmed tile's counted short
            const score = side.length * (isTrimmed[other] === 1 ? TRIMMED_SIDE_SHARE : 1) + isCut[other] * PREFER_CUT;
            if (score > bestScore) {
                best = other;
                bestSide = side;
                bestScore = score;
            }
        }
        // The sliver's neighbours become the tile's it joins. One with nowhere to join is left out
        for (const other of neighbours[sliver]) {
            neighbours[other] = neighbours[other].filter((n) => n !== sliver);
            if (best < 0 || other === best) continue;
            if (!neighbours[other].includes(best)) neighbours[other].push(best);
            if (!neighbours[best].includes(other)) neighbours[best].push(other);
        }
        neighbours[sliver] = [];
        polygons[sliver] = undefined;
        if (best >= 0) {
            polygons[best] = removeFolds(joinPolygons(polygons[best]!, sliverPolygon, bestSide!.a, bestSide!.b));
            isCut[best] = 1;
            isTrimmed[best] = 0;
        }
    }
}

/**
 * A cut or trimmed tile is preferred to a whole one for a sliver to join, by
 * more than any side's length, and a side shared with a trimmed tile counts
 * as this share of its length.
 */
const PREFER_CUT = 1000;
const TRIMMED_SIDE_SHARE = 0.5;

/** A side two polygons share: its length, and the corner it starts at in each, going round each its own way. */
interface SharedSide {
    readonly length: number;
    readonly a: number;
    readonly b: number;
}

/**
 * The longest side polygons `a` and `b` share, or undefined if they share
 * none. Both go round the same way, so a shared side runs one way in `a`
 * and the other in `b`.
 */
function findSharedSide(a: readonly number[], b: readonly number[]): SharedSide | undefined {
    const na = a.length / 2;
    const nb = b.length / 2;
    let longest: SharedSide | undefined;
    for (let i = 0; i < na; i++) {
        const i2 = (i + 1) % na;
        for (let j = 0; j < nb; j++) {
            const j2 = (j + 1) % nb;
            if (!isSamePoint(a, i, b, j2) || !isSamePoint(a, i2, b, j)) continue;
            const length = Math.hypot(a[i2 * 2] - a[i * 2], a[i2 * 2 + 1] - a[i * 2 + 1]);
            if (longest === undefined || length > longest.length) longest = { length, a: i, b: j };
        }
    }
    return longest;
}

/**
 * Two polygons joined along a side they share: the side from corner `i` of
 * `a`, and from corner `j` of `b`, the other way. The joined polygon is all
 * of `a`'s corners from the side's end, then `b`'s but the side's two.
 */
function joinPolygons(a: readonly number[], b: readonly number[], i: number, j: number): number[] {
    const na = a.length / 2;
    const nb = b.length / 2;
    const joined: number[] = [];
    for (let k = 1; k <= na; k++) {
        const at = (i + k) % na;
        joined.push(a[at * 2], a[at * 2 + 1]);
    }
    for (let k = 2; k < nb; k++) {
        const at = (j + k) % nb;
        joined.push(b[at * 2], b[at * 2 + 1]);
    }
    return joined;
}

/**
 * A polygon with its folds taken out. Two polygons that share more than
 * one side, one after another, are joined along only one of them, which
 * leaves the others running out and straight back: a fold, which would be
 * drawn as a line of lead into the glass that meets nothing. So any corner
 * the polygon turns straight back at, or that repeats the one before it, is
 * removed, again and again, until there are none.
 */
function removeFolds(points: readonly number[]): number[] {
    const kept = points.slice();
    for (let isRemoved = true; isRemoved && kept.length > 6;) {
        isRemoved = false;
        const n = kept.length / 2;
        for (let k = 0; k < n; k++) {
            const before = (k + n - 1) % n;
            const after = (k + 1) % n;
            const inX = kept[k * 2] - kept[before * 2];
            const inY = kept[k * 2 + 1] - kept[before * 2 + 1];
            const outX = kept[after * 2] - kept[k * 2];
            const outY = kept[after * 2 + 1] - kept[k * 2 + 1];
            const isRepeat = Math.abs(outX) < CORNER_TOLERANCE && Math.abs(outY) < CORNER_TOLERANCE;
            // Its two sides come from two polygons, so a fold's sides can be a hair apart
            const reach = Math.hypot(inX, inY) + Math.hypot(outX, outY);
            const isTurnBack = Math.abs(inX * outY - inY * outX) < CORNER_TOLERANCE * reach && inX * outX + inY * outY < 0;
            if (!isRepeat && !isTurnBack) continue;
            kept.splice(k * 2, 2);
            isRemoved = true;
            break;
        }
    }
    return kept;
}

function isSamePoint(a: readonly number[], i: number, b: readonly number[], j: number): boolean {
    return Math.abs(a[i * 2] - b[j * 2]) < CORNER_TOLERANCE && Math.abs(a[i * 2 + 1] - b[j * 2 + 1]) < CORNER_TOLERANCE;
}

/** The signed area of a polygon given as x, y pairs: positive if it goes round the way every tile here does. */
function measureArea(points: readonly number[]): number {
    const n = points.length / 2;
    let area = 0;
    for (let k = 0; k < n; k++) {
        const next = (k + 1) % n;
        area += points[k * 2] * points[next * 2 + 1] - points[next * 2] * points[k * 2 + 1];
    }
    return area / 2;
}

function reversePolygon(points: readonly number[]): number[] {
    const reversed: number[] = [];
    for (let k = points.length / 2 - 1; k >= 0; k--) reversed.push(points[k * 2], points[k * 2 + 1]);
    return reversed;
}

/** The centroid of a polygon, its middle by area, as x and y. */
function findCentroid(points: readonly number[]): [number, number] {
    const n = points.length / 2;
    let area = 0;
    let x = 0;
    let y = 0;
    for (let k = 0; k < n; k++) {
        const next = (k + 1) % n;
        const cross = points[k * 2] * points[next * 2 + 1] - points[next * 2] * points[k * 2 + 1];
        area += cross;
        x += (points[k * 2] + points[next * 2]) * cross;
        y += (points[k * 2 + 1] + points[next * 2 + 1]) * cross;
    }
    return [x / (3 * area), y / (3 * area)];
}

/** How far (`x`, `y`) is inside the side from corner `k` of `frame` to the next: positive inside, as the frame goes round. */
function measureInside(frame: readonly number[], k: number, x: number, y: number): number {
    const n = frame.length / 2;
    const next = (k + 1) % n;
    const ax = frame[k * 2];
    const ay = frame[k * 2 + 1];
    return (frame[next * 2] - ax) * (y - ay) - (frame[next * 2 + 1] - ay) * (x - ax);
}

/**
 * Whether the frame only trims a rhombus, cutting it to `cut`: whether the
 * cut keeps at least TRIM_SHARE of its glass, with its middle at least
 * GRIP_ROOM inside every side of the frame.
 */
function isTrimmedOnly(cut: readonly number[], rhombus: readonly number[], frame: readonly number[]): boolean {
    if (measureArea(cut) < measureArea(rhombus) * TRIM_SHARE) return false;
    const [x, y] = findCentroid(cut);
    const n = frame.length / 2;
    for (let k = 0; k < n; k++) {
        const next = (k + 1) % n;
        const length = Math.hypot(frame[next * 2] - frame[k * 2], frame[next * 2 + 1] - frame[k * 2 + 1]);
        if (measureInside(frame, k, x, y) < GRIP_ROOM * length) return false;
    }
    return true;
}

/** Whether every corner of a polygon is inside the frame, or on it. */
function isPolygonInside(points: readonly number[], frame: readonly number[]): boolean {
    for (let k = 0; k < frame.length / 2; k++) {
        for (let i = 0; i < points.length; i += 2) if (measureInside(frame, k, points[i], points[i + 1]) < 0) return false;
    }
    return true;
}

/** The part of a polygon inside the convex frame, cut side by side (Sutherland-Hodgman). Empty if none of it is. */
function cutPolygon(points: readonly number[], frame: readonly number[]): number[] {
    let cut: readonly number[] = points;
    for (let k = 0; k < frame.length / 2 && cut.length > 0; k++) {
        const input = cut;
        const output: number[] = [];
        const n = input.length / 2;
        for (let i = 0; i < n; i++) {
            const next = (i + 1) % n;
            const px = input[i * 2];
            const py = input[i * 2 + 1];
            const qx = input[next * 2];
            const qy = input[next * 2 + 1];
            const p = measureInside(frame, k, px, py);
            const q = measureInside(frame, k, qx, qy);
            if (p >= 0) output.push(px, py);
            if ((p >= 0) !== (q >= 0)) {
                const share = p / (p - q);
                output.push(px + (qx - px) * share, py + (qy - py) * share);
            }
        }
        cut = output;
    }
    return cut.slice();
}

/** Whether (`x`, `y`) is inside the polygon of corners `from` up to `to`: whether a ray from it crosses the sides an odd number of times. */
function isPointInside(xs: Float64Array, ys: Float64Array, from: number, to: number, x: number, y: number): boolean {
    let isInside = false;
    for (let k = from, last = to - 1; k < to; last = k++) {
        if ((ys[k] > y) !== (ys[last] > y) && x < xs[k] + ((xs[last] - xs[k]) * (y - ys[k])) / (ys[last] - ys[k])) isInside = !isInside;
    }
    return isInside;
}

/**
 * The neighbours of every tile laid. Each tile is where two grid lines
 * cross, and two tiles share an edge exactly when their crossings come one
 * after the other along a line. So each line's crossings are put in order
 * along it, and each pair in a row are neighbours. The tiling's nudges keep
 * any two crossings on a line apart, so the order never depends on rounding.
 */
function findNeighbours(tiles: MultigridTiles): number[][] {
    const neighbours: number[][] = [];
    for (let t = 0; t < tiles.count; t++) neighbours.push([]);
    // The tiles on each line, keyed by its grid and its number
    const lines = new Map<number, number[]>();
    for (let t = 0; t < tiles.count; t++) {
        const pair = tiles.pairs[t];
        addToLine(lines, tiles.pairFirstGrids[pair], tiles.firstLines[t], t);
        addToLine(lines, tiles.pairSecondGrids[pair], tiles.secondLines[t], t);
    }
    for (const [key, onLine] of lines) {
        const grid = key % LINE_KEY_GRIDS;
        // Along the line, at right angles to the way its grid steps
        const alongX = -tiles.gridSines[grid];
        const alongY = tiles.gridCosines[grid];
        onLine.sort((a, b) => (tiles.crossingXs[a] * alongX + tiles.crossingYs[a] * alongY) - (tiles.crossingXs[b] * alongX + tiles.crossingYs[b] * alongY));
        for (let i = 1; i < onLine.length; i++) {
            neighbours[onLine[i - 1]].push(onLine[i]);
            neighbours[onLine[i]].push(onLine[i - 1]);
        }
    }
    return neighbours;
}

function addToLine(lines: Map<number, number[]>, grid: number, line: number, tile: number): void {
    const key = (line + LINE_KEY_OFFSET) * LINE_KEY_GRIDS + grid;
    const onLine = lines.get(key);
    if (onLine === undefined) lines.set(key, [tile]);
    else onLine.push(tile);
}
