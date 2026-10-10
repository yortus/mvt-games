import type { PlaneRegion } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The escape value of a sample that nothing is known about yet. */
export const UNKNOWN = -2;

/**
 * How coarse a sample is: the width of the block it was filled from, in
 * samples. A sample computed at its own point is `EXACT`, and one nothing is
 * known about is `UNKNOWN_COARSENESS`.
 */
export const EXACT = 0;
export const UNKNOWN_COARSENESS = 255;

/** A grid of samples over a region, and how coarse each sample is. */
export interface SampleGrid {
    readonly cols: number;
    readonly rows: number;
    readonly region: PlaneRegion;
    /** Escape values, one per sample, row by row. */
    readonly escapes: Float32Array;
    /** How coarse each sample is, one per sample, row by row. */
    readonly coarseness: Uint8Array;
}

/**
 * Fills `target` from `source`. Each target sample takes the value of the
 * source sample whose cell holds its point. A target sample whose point lies
 * outside the source's region is `UNKNOWN`.
 *
 * Each value carries how coarse it now is. A source sample stretched over
 * three target samples is three samples coarse, so a refining pass knows to
 * replace it. A source sample spread thinner than one target sample counts
 * as one sample coarse, not exact, because it was computed at another point.
 *
 * It writes only `target`'s arrays.
 */
export function reprojectSamples(source: SampleGrid, target: SampleGrid): void {
    const { cols, rows, region, escapes, coarseness } = target;
    const unitsPerSample = region.span / cols;
    const sourceUnitsPerSample = source.region.span / source.cols;
    const stretch = sourceUnitsPerSample / unitsPerSample;

    // What each of the source's coarseness values becomes, stretched.
    const stretched = new Uint8Array(256);
    for (let q = 0; q < 256; q++) {
        if (q === UNKNOWN_COARSENESS) {
            stretched[q] = UNKNOWN_COARSENESS;
            continue;
        }
        const width = Math.ceil(Math.max(1, q) * stretch - STRETCH_TOLERANCE);
        stretched[q] = Math.min(UNKNOWN_COARSENESS - 1, Math.max(1, width));
    }

    // The source column under each target column, or -1 outside it.
    const sourceColAt = new Int32Array(cols);
    const sourceLeft = source.region.centerRe - source.cols * 0.5 * sourceUnitsPerSample;
    for (let col = 0; col < cols; col++) {
        const re = region.centerRe + (col + 0.5 - cols * 0.5) * unitsPerSample;
        const sourceCol = Math.floor((re - sourceLeft) / sourceUnitsPerSample);
        sourceColAt[col] = sourceCol >= 0 && sourceCol < source.cols ? sourceCol : -1;
    }

    const sourceTop = source.region.centerIm + source.rows * 0.5 * sourceUnitsPerSample;
    for (let row = 0; row < rows; row++) {
        const im = region.centerIm - (row + 0.5 - rows * 0.5) * unitsPerSample;
        const sourceRow = Math.floor((sourceTop - im) / sourceUnitsPerSample);
        const base = row * cols;
        if (sourceRow < 0 || sourceRow >= source.rows) {
            escapes.fill(UNKNOWN, base, base + cols);
            coarseness.fill(UNKNOWN_COARSENESS, base, base + cols);
            continue;
        }
        const sourceBase = sourceRow * source.cols;
        for (let col = 0; col < cols; col++) {
            const sourceCol = sourceColAt[col];
            if (sourceCol < 0) {
                escapes[base + col] = UNKNOWN;
                coarseness[base + col] = UNKNOWN_COARSENESS;
            }
            else {
                escapes[base + col] = source.escapes[sourceBase + sourceCol];
                coarseness[base + col] = stretched[source.coarseness[sourceBase + sourceCol]];
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * How far past a whole number a stretch may be and still count as that
 * number. A pan leaves the stretch at exactly 1, but a zoom out and back in
 * leaves it a rounding error away.
 */
const STRETCH_TOLERANCE = 1e-9;
