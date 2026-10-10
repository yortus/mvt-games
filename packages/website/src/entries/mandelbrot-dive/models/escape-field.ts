import type { PlaneRegion } from './common';
import { COARSEST_BLOCK } from './model-constants';
import { EXACT, reprojectSamples, type SampleGrid, UNKNOWN, UNKNOWN_COARSENESS } from './reproject-samples';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The escape value of a sample that never escaped, so it lies inside the set. */
export const INTERIOR = -1;

export { UNKNOWN };

/**
 * A grid of samples over a region of the complex plane, as a reader sees
 * it, with no way to change it. Each sample holds how fast the point there
 * escapes to infinity. A point that never escapes lies inside the Mandelbrot
 * set.
 */
export interface EscapeGrid {
    /** How many samples wide the grid is. */
    readonly cols: number;
    /** How many samples tall the grid is. Its height in the plane follows from this. */
    readonly rows: number;
    /** The region the samples are taken over. */
    readonly region: PlaneRegion;
    /** How many iterations a sample gets before it counts as inside the set. */
    readonly maxIterations: number;
    /**
     * How fast each sample escaped, one per sample, row by row. The value is
     * fractional, so that colours drawn from it have no bands of their own.
     * A sample that never escaped holds `INTERIOR`, and one nothing is known
     * about yet holds `UNKNOWN`. Read it, never write it.
     */
    readonly escapes: Float32Array;
    /**
     * The revision each row of samples last changed in, one per row. A
     * reader that remembers the revision it last read can find every row
     * changed since, however many steps have passed. Read it, never write it.
     */
    readonly rowRevisions: Float64Array;
    /** Rises whenever any sample changes. */
    readonly revision: number;
    /**
     * How wide the blocks the pass now running fills are, in samples. It is
     * 1 in the last pass, and 0 once every sample is its own.
     */
    readonly blockSize: number;
    /** Whether every sample has been computed at its own point. */
    readonly isComplete: boolean;
    /** How much of the grid is computed, from 0 to 1. */
    readonly progress: number;
}

/**
 * An escape grid that computes itself, over several passes. The first pass
 * fills blocks of `COARSEST_BLOCK` samples from one sample each, so the
 * whole region has a value within a frame or two. Each pass after it halves
 * the blocks, until every sample is computed at its own point. So a reader
 * always has a whole image to draw, and it grows sharper.
 *
 * When it moves to a new region or a new size, it starts from the image it
 * had, stretched and shifted to fit. A pass only replaces samples coarser
 * than its own blocks. So the image never gets blockier as it sharpens.
 *
 * It is not a model of its own, because it has no sense of time. `advance`
 * buys as much work as the caller pays for, in iterations.
 */
export interface EscapeField extends EscapeGrid {
    /**
     * Moves the grid to `region`, and starts the passes again. The samples
     * are rebuilt from the image as it was, so a reader's picture holds
     * still. Parts of the region the old image did not cover are `UNKNOWN`.
     */
    restart: (region: PlaneRegion, maxIterations: number) => void;
    /** Resizes the grid, rebuilding its samples from the image as it was, and starts the passes again. */
    resize: (cols: number, rows: number) => void;
    /** Computes samples until `iterationBudget` iterations are spent. Returns how many it spent. */
    advance: (iterationBudget: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an escape field. */
export interface EscapeFieldOptions {
    readonly cols: number;
    readonly rows: number;
    /** The region to sample. */
    readonly region: PlaneRegion;
    readonly maxIterations: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an escape field over `options.region`, with nothing known about any sample yet. */
export function createEscapeField(options: EscapeFieldOptions): EscapeField {
    let cols = Math.max(1, Math.floor(options.cols));
    let rows = Math.max(1, Math.floor(options.rows));
    let maxIterations = options.maxIterations;

    // The samples, and how coarse each is. The spares are where a rebuilt
    // image is written, and then the two swap, so a restart allocates
    // nothing.
    let escapes = new Float32Array(cols * rows).fill(UNKNOWN);
    let coarseness = new Uint8Array(cols * rows).fill(UNKNOWN_COARSENESS);
    let spareEscapes = new Float32Array(cols * rows);
    let spareCoarseness = new Uint8Array(cols * rows);
    let rowRevisions = new Float64Array(rows);

    // The one region object, written in place, so that reading it every
    // frame allocates nothing.
    const region = {
        centerRe: options.region.centerRe,
        centerIm: options.region.centerIm,
        span: options.region.span,
    };

    // Where the passes have got to. The cursor walks the grid in steps of
    // `blockSize`, row by row.
    let blockSize = COARSEST_BLOCK;
    let cursorRow = 0;
    let cursorCol = 0;
    let computedCount = 0;
    let revision = 0;

    // What the escape loop has spent since `advance` was called. It is a
    // counter rather than a returned value, because the loop already returns
    // the sample's escape value.
    let iterationsSpent = 0;

    const field: EscapeField = {
        get cols() { return cols; },
        get rows() { return rows; },
        get region() { return region; },
        get maxIterations() { return maxIterations; },
        get escapes() { return escapes; },
        get rowRevisions() { return rowRevisions; },
        get revision() { return revision; },
        get blockSize() { return blockSize; },
        get isComplete() { return blockSize === 0; },
        get progress() { return blockSize === 0 ? 1 : computedCount / (cols * rows); },

        restart(next, nextMaxIterations) {
            const source = snapshotSamples();
            region.centerRe = next.centerRe;
            region.centerIm = next.centerIm;
            region.span = next.span;
            maxIterations = nextMaxIterations;
            rebuildSamples(source);
        },

        resize(nextCols, nextRows) {
            const source = snapshotSamples();
            cols = Math.max(1, Math.floor(nextCols));
            rows = Math.max(1, Math.floor(nextRows));
            escapes = new Float32Array(cols * rows);
            coarseness = new Uint8Array(cols * rows);
            spareEscapes = new Float32Array(cols * rows);
            spareCoarseness = new Uint8Array(cols * rows);
            rowRevisions = new Float64Array(rows);
            rebuildSamples(source);
        },

        advance(iterationBudget) {
            iterationsSpent = 0;
            if (blockSize === 0 || !(iterationBudget > 0)) return 0;
            const before = computedCount;
            const next = revision + 1;
            while (iterationsSpent < iterationBudget) {
                if (cursorRow >= rows) {
                    // The pass is done. The next one halves the blocks, and
                    // a block of one sample is the last.
                    blockSize >>= 1;
                    if (blockSize === 0) break;
                    cursorRow = 0;
                    cursorCol = 0;
                }
                computeBlock(cursorRow, cursorCol, next);
                cursorCol += blockSize;
                if (cursorCol >= cols) {
                    cursorCol = 0;
                    cursorRow += blockSize;
                }
            }
            if (computedCount > before) revision = next;
            return iterationsSpent;
        },
    };

    return field;

    /** The grid as it stands, with a copy of its region, as the source of a rebuild. */
    function snapshotSamples(): SampleGrid {
        return { cols, rows, region: { ...region }, escapes, coarseness };
    }

    /**
     * Rebuilds the samples from `source` for the grid's region and size, into
     * the spares, which then swap with the samples. It marks every row
     * changed, and starts the passes again.
     */
    function rebuildSamples(source: SampleGrid): void {
        reprojectSamples(source, { cols, rows, region, escapes: spareEscapes, coarseness: spareCoarseness });
        const oldEscapes = escapes;
        const oldCoarseness = coarseness;
        escapes = spareEscapes;
        coarseness = spareCoarseness;
        spareEscapes = oldEscapes;
        spareCoarseness = oldCoarseness;
        revision++;
        rowRevisions.fill(revision);
        blockSize = COARSEST_BLOCK;
        cursorRow = 0;
        cursorCol = 0;
        computedCount = 0;
    }

    /**
     * Computes the sample at the block's top left corner, and fills the
     * samples of the block that are coarser than the block with it. A corner
     * already computed at its own point is left as it is, because an earlier
     * pass filled its block from it.
     */
    function computeBlock(row: number, col: number, nextRevision: number): void {
        const corner = row * cols + col;
        if (coarseness[corner] === EXACT) return;

        // The sample sits at the middle of its own cell, so that every pass
        // takes a corner's sample at the same point.
        const unitsPerSample = region.span / cols;
        const re = region.centerRe + (col + 0.5 - cols * 0.5) * unitsPerSample;
        const im = region.centerIm - (row + 0.5 - rows * 0.5) * unitsPerSample;
        const escape = measureEscape(re, im);

        const rowEnd = Math.min(row + blockSize, rows);
        const colEnd = Math.min(col + blockSize, cols);
        for (let y = row; y < rowEnd; y++) {
            const base = y * cols;
            for (let i = base + col; i < base + colEnd; i++) {
                if (coarseness[i] > blockSize) {
                    escapes[i] = escape;
                    coarseness[i] = blockSize;
                }
            }
            rowRevisions[y] = nextRevision;
        }
        escapes[corner] = escape;
        coarseness[corner] = EXACT;
        computedCount++;
    }

    /**
     * How fast the point `re` + `im`i escapes, as a fractional iteration
     * count, or `INTERIOR` if it never does. It adds what it spent to
     * `iterationsSpent`.
     */
    function measureEscape(re: number, im: number): number {
        // The main cardioid and the big bulb beside it are inside the set.
        // Testing for them costs a few multiplications, where the loop would
        // take every iteration it is allowed.
        const imSq = im * im;
        const q = (re - 0.25) * (re - 0.25) + imSq;
        if (q * (q + re - 0.25) <= 0.25 * imSq || (re + 1) * (re + 1) + imSq <= 0.0625) {
            iterationsSpent += EARLY_OUT_COST;
            return INTERIOR;
        }

        let zr = 0;
        let zi = 0;
        let zrSq = 0;
        let ziSq = 0;
        let i = 0;
        while (i < maxIterations && zrSq + ziSq <= BAILOUT_SQ) {
            zi = 2 * zr * zi + im;
            zr = zrSq - ziSq + re;
            zrSq = zr * zr;
            ziSq = zi * zi;
            i++;
        }
        iterationsSpent += i;
        if (i >= maxIterations) return INTERIOR;

        // How far past the bailout radius the point landed. It turns the
        // whole-number steps of the count into one smooth gradient.
        const logModulus = Math.log(zrSq + ziSq) * 0.5;
        const smooth = i + 1 - Math.log(logModulus / Math.LN2) / Math.LN2;
        return smooth > 0 ? smooth : 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * How far a point must travel from the origin to count as escaped. It is far
 * further than the 2 that settles the question, because the extra distance
 * is what makes the fractional part of the count smooth.
 */
const BAILOUT_SQ = 128 * 128;

/** What a sample costs when the cardioid test settles it, in iterations of the loop it saved. */
const EARLY_OUT_COST = 4;
