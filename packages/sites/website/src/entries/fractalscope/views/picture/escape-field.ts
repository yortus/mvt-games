import type { ScopeSetting } from '../../data';
import type { EscapeKernel, EscapeMeasure } from '../../models';
import { COARSEST_BLOCK } from './picture-constants';
import { EXACT, reprojectSamples, type SampleGrid, UNKNOWN, UNKNOWN_COARSENESS } from './reproject-samples';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export { UNKNOWN };

/**
 * A grid of samples taken at a scope setting, over the patch of the complex
 * plane the scope took in, as a reader sees it, with no way to change it. Each sample holds how fast the point there
 * escapes to infinity under a fractal's rule. A point that never escapes
 * lies inside the fractal's set.
 */
export interface EscapeGrid {
    /** How many samples wide the grid is. */
    readonly cols: number;
    /** How many samples tall the grid is. Its height in the plane follows from this. */
    readonly rows: number;
    /** The scope setting the samples were taken at. */
    readonly setting: ScopeSetting;
    /** How many iterations a sample gets before it counts as inside the set. */
    readonly maxIterations: number;
    /**
     * How fast each sample escaped, one per sample, row by row. The value is
     * fractional, so that colours drawn from it have no bands of their own.
     * A sample that never escaped holds the model's `INTERIOR`, and one nothing is known
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
 * An escape grid that computes itself, over several passes, for a picture to
 * be drawn from. The first pass fills blocks of `COARSEST_BLOCK` samples from
 * one sample each, so the whole patch has a value within a frame or two.
 * Each pass after it halves the blocks, until every sample is computed at
 * its own point. So a reader always has a whole image to draw, and it grows
 * sharper.
 *
 * When it is taken again at a new setting, or resized, it starts from the
 * image it had, stretched and shifted to fit. A pass only replaces samples coarser
 * than its own blocks. So the image never gets blockier as it sharpens.
 *
 * It has no sense of time. `advance` buys as much work as the caller pays
 * for, in iterations. Which fractal it samples is not its business either:
 * it asks `measureEscape` about each point.
 */
export interface EscapeField extends EscapeGrid {
    /**
     * Takes the grid again at `setting`, and starts the passes again. The
     * samples are rebuilt from the image as it was, so a reader's picture
     * holds still. Parts of the new patch the old image did not cover are
     * `UNKNOWN`.
     */
    restart: (setting: ScopeSetting, maxIterations: number) => void;
    /** Resizes the grid, rebuilding its samples from the image as it was, and starts the passes again. */
    resize: (cols: number, rows: number) => void;
    /**
     * Takes the grid again at `setting`, and starts the passes from nothing.
     * Every sample becomes `UNKNOWN`. It is for when the old image is no
     * guide to the new one, such as when the fractal changes.
     */
    clear: (setting: ScopeSetting, maxIterations: number) => void;
    /** Computes samples until `iterationBudget` iterations are spent. Returns how many it spent. */
    advance: (iterationBudget: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an escape field. */
export interface EscapeFieldOptions {
    /** Measures how fast a point escapes, under whatever rule the samples follow. */
    readonly measureEscape: EscapeKernel;
    readonly cols: number;
    readonly rows: number;
    /** The scope setting to take the samples at. */
    readonly setting: ScopeSetting;
    readonly maxIterations: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an escape field taken at `options.setting`, with nothing known about any sample yet. */
export function createEscapeField(options: EscapeFieldOptions): EscapeField {
    let cols = Math.max(1, Math.floor(options.cols));
    let rows = Math.max(1, Math.floor(options.rows));
    let maxIterations = options.maxIterations;
    const { measureEscape } = options;
    // What the kernel found for the last point, written in place.
    const measure: EscapeMeasure = { escape: 0, iterations: 0 };

    // The samples, and how coarse each is. The spares are where a rebuilt
    // image is written, and then the two swap, so a restart allocates
    // nothing.
    let escapes = new Float32Array(cols * rows).fill(UNKNOWN);
    let coarseness = new Uint8Array(cols * rows).fill(UNKNOWN_COARSENESS);
    let spareEscapes = new Float32Array(cols * rows);
    let spareCoarseness = new Uint8Array(cols * rows);
    let rowRevisions = new Float64Array(rows);

    // The one setting object, written in place, so that reading it every
    // frame allocates nothing.
    const setting = {
        centreRe: options.setting.centreRe,
        centreIm: options.setting.centreIm,
        width: options.setting.width,
    };

    // Where the passes have got to. The cursor walks the grid in steps of
    // `blockSize`, row by row.
    let blockSize = COARSEST_BLOCK;
    let cursorRow = 0;
    let cursorCol = 0;
    let computedCount = 0;
    let revision = 0;

    // What the kernel has spent since `advance` was called.
    let iterationsSpent = 0;

    const field: EscapeField = {
        get cols() { return cols; },
        get rows() { return rows; },
        get setting() { return setting; },
        get maxIterations() { return maxIterations; },
        get escapes() { return escapes; },
        get rowRevisions() { return rowRevisions; },
        get revision() { return revision; },
        get blockSize() { return blockSize; },
        get isComplete() { return blockSize === 0; },
        get progress() { return blockSize === 0 ? 1 : computedCount / (cols * rows); },

        restart(next, nextMaxIterations) {
            const source = snapshotSamples();
            setting.centreRe = next.centreRe;
            setting.centreIm = next.centreIm;
            setting.width = next.width;
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

        clear(next, nextMaxIterations) {
            setting.centreRe = next.centreRe;
            setting.centreIm = next.centreIm;
            setting.width = next.width;
            maxIterations = nextMaxIterations;
            escapes.fill(UNKNOWN);
            coarseness.fill(UNKNOWN_COARSENESS);
            revision++;
            rowRevisions.fill(revision);
            startPasses();
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

    /** The grid as it stands, with a copy of its setting, as the source of a rebuild. */
    function snapshotSamples(): SampleGrid {
        return { cols, rows, setting: { ...setting }, escapes, coarseness };
    }

    /**
     * Rebuilds the samples from `source` for the grid's setting and size, into
     * the spares, which then swap with the samples. It marks every row
     * changed, and starts the passes again.
     */
    function rebuildSamples(source: SampleGrid): void {
        reprojectSamples(source, { cols, rows, setting, escapes: spareEscapes, coarseness: spareCoarseness });
        const oldEscapes = escapes;
        const oldCoarseness = coarseness;
        escapes = spareEscapes;
        coarseness = spareCoarseness;
        spareEscapes = oldEscapes;
        spareCoarseness = oldCoarseness;
        revision++;
        rowRevisions.fill(revision);
        startPasses();
    }

    /** Puts the cursor back at the start of the coarsest pass, with nothing computed. */
    function startPasses(): void {
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
        const unitsPerSample = setting.width / cols;
        const re = setting.centreRe + (col + 0.5 - cols * 0.5) * unitsPerSample;
        const im = setting.centreIm - (row + 0.5 - rows * 0.5) * unitsPerSample;
        measureEscape(re, im, maxIterations, measure);
        iterationsSpent += measure.iterations;
        const escape = measure.escape;

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
}
