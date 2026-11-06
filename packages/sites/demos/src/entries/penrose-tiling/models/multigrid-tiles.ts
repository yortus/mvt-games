// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The tiles of a rhombus tiling within a disc, as plain arrays of numbers.
 * Every tile is a rhombus with sides one unit long, one tile edge. Its four
 * corners are stored in order round it, four numbers to a tile in each of
 * `cornerXs` and `cornerYs`. The arrays are reused, and replaced only when
 * more tiles are laid than they hold, so read them again after each lay.
 * Only the first `count` tiles' entries mean anything.
 */
export interface TileSet {
    /** How many tiles there are. */
    readonly count: number;
    /** The x of each tile's four corners, in tile edges. */
    readonly cornerXs: Float64Array;
    /** The y of each tile's four corners, in tile edges. */
    readonly cornerYs: Float64Array;
    /** Each tile's shape, from 0, the thinnest, to `shapeCount - 1`, the squarest. */
    readonly shapes: Uint8Array;
    /** How many shapes of tile the tiling has. */
    readonly shapeCount: number;
    /** Each tile's pair of grids, which says which way it points: an index into `pairHeadings`. */
    readonly pairs: Uint16Array;
    /** How many pairs of grids there are. */
    readonly pairCount: number;
    /** Which way the tiles of each pair of grids point, as a fraction of a half turn, from 0 to 1. */
    readonly pairHeadings: Float64Array;
    /** The first grid of each pair: an index into `gridCosines`, `gridSines` and `gridStarts`. */
    readonly pairFirstGrids: Uint8Array;
    /** The second grid of each pair. */
    readonly pairSecondGrids: Uint8Array;

    /** The x of the crossing each tile comes from, in tile edges, with the grids laid over the tiling. */
    readonly crossingXs: Float64Array;
    /** The y of the crossing each tile comes from. */
    readonly crossingYs: Float64Array;
    /** Which line of its pair's first grid each tile comes from. */
    readonly firstLines: Int32Array;
    /** Which line of its pair's second grid each tile comes from. */
    readonly secondLines: Int32Array;

    /** How many grids of lines lay these tiles. */
    readonly gridCount: number;
    /** The cosine of the way each grid's lines step, at right angles to them. */
    readonly gridCosines: Float64Array;
    /** The sine of the way each grid's lines step. */
    readonly gridSines: Float64Array;
    /**
     * How far along its step direction each grid's line 0 lies from the
     * tiling's origin, in tile edges. Line `n` lies `n * lineSpacing` further on.
     */
    readonly gridStarts: Float64Array;
    /** How far apart the lines of every grid are, in tile edges, with the grids laid over the tiling. */
    readonly lineSpacing: number;
    /** Rises each time the tiles are laid again. */
    readonly version: number;
}

/** A tile set that can lay its tiles again. */
export interface MultigridTiles extends TileSet {
    /**
     * Lays the tiles of the tiling with `symmetry` and `shift` whose middles
     * lie within `radius` of (`centreX`, `centreY`). Lengths are in tile
     * edges. It runs every frame while the design drifts, so it takes plain
     * numbers, and allocates nothing unless the arrays must grow.
     */
    lay: (symmetry: number, shift: number, centreX: number, centreY: number, radius: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an empty tile set, which lays tiles by de Bruijn's multigrid
 * method.
 *
 * Draw several grids of parallel lines, one unit apart, each grid turned a
 * little further than the last: five grids for the Penrose tiling. Wherever
 * two lines cross, there is a tile. Its sides point the same way as the two
 * lines' grids, at right angles to their lines. Where it goes comes from
 * counting, for every grid, how many of its lines lie on one side of the
 * crossing. Because neighbouring crossings differ in exactly one count, the
 * tiles fit together edge to edge, with no gaps and no overlaps.
 *
 * Sliding each grid along by its own offset changes which lines cross near
 * which, so a few tiles flip while the rest stay put. For five grids, the
 * offsets always add up to zero, which is what makes them lay a true
 * Penrose tiling.
 */
export function createMultigridTiles(): MultigridTiles {
    let capacity = INITIAL_CAPACITY;
    let cornerXs = new Float64Array(capacity * 4);
    let cornerYs = new Float64Array(capacity * 4);
    let shapes = new Uint8Array(capacity);
    let pairs = new Uint16Array(capacity);
    let crossingXs = new Float64Array(capacity);
    let crossingYs = new Float64Array(capacity);
    let firstLines = new Int32Array(capacity);
    let secondLines = new Int32Array(capacity);
    const pairHeadings = new Float64Array(MAX_PAIRS);
    const pairShapes = new Uint8Array(MAX_PAIRS);
    const pairFirstGrids = new Uint8Array(MAX_PAIRS);
    const pairSecondGrids = new Uint8Array(MAX_PAIRS);
    // Each grid's direction, and how far it is slid along
    const cosines = new Float64Array(MAX_GRIDS);
    const sines = new Float64Array(MAX_GRIDS);
    const offsets = new Float64Array(MAX_GRIDS);
    const gridStarts = new Float64Array(MAX_GRIDS);
    let count = 0;
    let shapeCount = 0;
    let pairCount = 0;
    let gridCount = 0;
    let lineSpacing = 1;
    let version = 0;

    return {
        get count() { return count; },
        get cornerXs() { return cornerXs; },
        get cornerYs() { return cornerYs; },
        get shapes() { return shapes; },
        get shapeCount() { return shapeCount; },
        get pairs() { return pairs; },
        get pairCount() { return pairCount; },
        get pairHeadings() { return pairHeadings; },
        get pairFirstGrids() { return pairFirstGrids; },
        get pairSecondGrids() { return pairSecondGrids; },
        get crossingXs() { return crossingXs; },
        get crossingYs() { return crossingYs; },
        get firstLines() { return firstLines; },
        get secondLines() { return secondLines; },
        get gridCount() { return gridCount; },
        get gridCosines() { return cosines; },
        get gridSines() { return sines; },
        get gridStarts() { return gridStarts; },
        get lineSpacing() { return lineSpacing; },
        get version() { return version; },
        lay,
    };

    function lay(symmetry: number, shift: number, centreX: number, centreY: number, radius: number): void {
        // An odd symmetry has a grid for each direction, all the way round.
        // An even one needs only half as many, since a grid pointing the
        // opposite way is the same grid.
        const isOdd = symmetry % 2 === 1;
        gridCount = isOdd ? symmetry : symmetry / 2;
        if (gridCount < 2 || gridCount > MAX_GRIDS) throw new Error(`multigrid tiles: no tiling has a symmetry of ${symmetry}`);
        const step = (Math.PI * 2) / symmetry;
        // The angles at the tiles' corners come in steps of this
        const shapeStep = isOdd ? Math.PI / symmetry : step;
        shapeCount = isOdd ? (symmetry - 1) / 2 : Math.floor(symmetry / 4);
        pairCount = (gridCount * (gridCount - 1)) / 2;

        placeGrids(symmetry, gridCount, step, shift);

        // A point x in the grids' plane lands near (gridCount / 2) x + drift
        // in the tiling's. The drift comes from the offsets, and from each
        // count being half a line more than the distance, on average.
        let driftX = 0;
        let driftY = 0;
        for (let j = 0; j < gridCount; j++) {
            driftX += (offsets[j] + 0.5) * cosines[j];
            driftY += (offsets[j] + 0.5) * sines[j];
        }
        const scale = gridCount / 2;
        lineSpacing = scale;
        for (let j = 0; j < gridCount; j++) {
            gridStarts[j] = driftX * cosines[j] + driftY * sines[j] - offsets[j] * scale;
        }
        const gridCentreX = (centreX - driftX) / scale;
        const gridCentreY = (centreY - driftY) / scale;
        // A tile lands within half a tile edge per grid of where that says,
        // so the grids are searched a little wider than the disc.
        const reach = (radius + gridCount / 2 + 1) / scale;
        const reachSquared = reach * reach;
        const radiusSquared = radius * radius;

        count = 0;
        let pair = 0;
        for (let r = 0; r < gridCount; r++) {
            const cosR = cosines[r];
            const sinR = sines[r];
            const offsetR = offsets[r];
            for (let s = r + 1; s < gridCount; s++, pair++) {
                const cosS = cosines[s];
                const sinS = sines[s];
                const offsetS = offsets[s];

                // The angle between the two grids, folded to the tile's
                // narrower corner, sets its shape.
                const between = ((s - r) * step) % Math.PI;
                const narrower = Math.min(between, Math.PI - between);
                pairShapes[pair] = Math.max(0, Math.round(narrower / shapeStep) - 1);
                pairHeadings[pair] = ((((r + s) * step) / 2) % Math.PI) / Math.PI;
                pairFirstGrids[pair] = r;
                pairSecondGrids[pair] = s;

                // The lines of each grid that come within reach of the centre
                const atR = gridCentreX * cosR + gridCentreY * sinR + offsetR;
                const atS = gridCentreX * cosS + gridCentreY * sinS + offsetS;
                const firstR = Math.ceil(atR - reach);
                const lastR = Math.floor(atR + reach);
                const firstS = Math.ceil(atS - reach);
                const lastS = Math.floor(atS + reach);
                const determinant = cosR * sinS - sinR * cosS;

                for (let lineR = firstR; lineR <= lastR; lineR++) {
                    const valueR = lineR - offsetR;
                    for (let lineS = firstS; lineS <= lastS; lineS++) {
                        const valueS = lineS - offsetS;
                        // Where line `lineR` of grid r crosses line `lineS` of grid s
                        const x = (valueR * sinS - valueS * sinR) / determinant;
                        const y = (cosR * valueS - cosS * valueR) / determinant;
                        const fromX = x - gridCentreX;
                        const fromY = y - gridCentreY;
                        if (fromX * fromX + fromY * fromY > reachSquared) continue;

                        // The tile's first corner counts the lines of every
                        // grid on the near side of the crossing.
                        let cornerX = 0;
                        let cornerY = 0;
                        for (let j = 0; j < gridCount; j++) {
                            const lines = j === r ? lineR : j === s ? lineS : Math.ceil(x * cosines[j] + y * sines[j] + offsets[j]);
                            cornerX += lines * cosines[j];
                            cornerY += lines * sines[j];
                        }
                        const middleX = cornerX + (cosR + cosS) * 0.5 - centreX;
                        const middleY = cornerY + (sinR + sinS) * 0.5 - centreY;
                        if (middleX * middleX + middleY * middleY > radiusSquared) continue;

                        if (count === capacity) grow();
                        const at = count * 4;
                        cornerXs[at] = cornerX;
                        cornerYs[at] = cornerY;
                        cornerXs[at + 1] = cornerX + cosR;
                        cornerYs[at + 1] = cornerY + sinR;
                        cornerXs[at + 2] = cornerX + cosR + cosS;
                        cornerYs[at + 2] = cornerY + sinR + sinS;
                        cornerXs[at + 3] = cornerX + cosS;
                        cornerYs[at + 3] = cornerY + sinS;
                        shapes[count] = pairShapes[pair];
                        pairs[count] = pair;
                        crossingXs[count] = x * scale + driftX;
                        crossingYs[count] = y * scale + driftY;
                        firstLines[count] = lineR;
                        secondLines[count] = lineS;
                        count++;
                    }
                }
            }
        }
        version++;
    }

    /**
     * Points each grid, and slides it along by its offset. The offsets
     * follow a wave round the grids, moved on by `shift`, plus a tiny fixed
     * nudge for each, so that no three lines ever meet at one point.
     *
     * For the Penrose tiling, the offsets add up to zero, which is
     * Penrose's own rule. For any other symmetry, they add up to a half, as
     * far from a whole number as they can be. Otherwise, with three grids,
     * every crossing would be a crossing of three lines, and its tiles would
     * overlap.
     */
    function placeGrids(symmetry: number, gridCount: number, step: number, shift: number): void {
        let nudgeTotal = 0;
        for (let j = 0; j < gridCount; j++) nudgeTotal += NUDGES[j];
        const share = symmetry === PENROSE_SYMMETRY ? 0 : 0.5 / gridCount;
        const nudgeMean = nudgeTotal / gridCount;
        for (let j = 0; j < gridCount; j++) {
            cosines[j] = Math.cos(j * step);
            sines[j] = Math.sin(j * step);
            const wave = Math.cos(((Math.PI * 4) * j) / gridCount + Math.PI * 2 * shift);
            offsets[j] = SHIFT_AMPLITUDE * wave + NUDGES[j] - nudgeMean + share;
        }
    }

    /** Doubles the room for tiles, keeping those laid so far. */
    function grow(): void {
        capacity *= 2;
        cornerXs = copyInto(new Float64Array(capacity * 4), cornerXs);
        cornerYs = copyInto(new Float64Array(capacity * 4), cornerYs);
        shapes = copyInto(new Uint8Array(capacity), shapes);
        pairs = copyInto(new Uint16Array(capacity), pairs);
        crossingXs = copyInto(new Float64Array(capacity), crossingXs);
        crossingYs = copyInto(new Float64Array(capacity), crossingYs);
        firstLines = copyInto(new Int32Array(capacity), firstLines);
        secondLines = copyInto(new Int32Array(capacity), secondLines);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Room for this many tiles at first. It doubles whenever more are laid. */
const INITIAL_CAPACITY = 1024;

/** The most grids a tiling can have, and so the most pairs of them. */
const MAX_GRIDS = 16;
const MAX_PAIRS = (MAX_GRIDS * (MAX_GRIDS - 1)) / 2;

/** The Penrose tiling's symmetry, whose offsets follow Penrose's rule. */
const PENROSE_SYMMETRY = 5;

/** How far a shift slides each grid at most, in lines. */
const SHIFT_AMPLITUDE = 0.4;

/** A small, fixed, uneven nudge for each grid, so that no three lines meet at one point. */
const NUDGES: readonly number[] = [
    0.0137, -0.0071, 0.0049, -0.0113, 0.0089, -0.0031, 0.0067, -0.0097,
    0.0023, -0.0059, 0.0103, -0.0017, 0.0041, -0.0083, 0.0011, -0.0029,
];

/** `target`, with `source` copied into its start. */
function copyInto<T extends Float64Array | Int32Array | Uint8Array | Uint16Array>(target: T, source: T): T {
    target.set(source);
    return target;
}
