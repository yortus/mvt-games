import { HOME_SPAN, type PaletteName } from '../data';
import type { PlaneRegion } from './common';
import { createEscapeField, type EscapeGrid } from './escape-field';
import { createPlaneViewport } from './plane-viewport';
import {
    BASE_ITERATIONS,
    ITERATIONS_PER_FRAME,
    ITERATIONS_PER_HALVING,
    MAX_ITERATIONS,
    MIN_BUDGET_SHARE,
    OVERVIEW_COLS,
    OVERVIEW_ITERATIONS,
    OVERVIEW_ROWS,
    SETTLE_MS,
    TARGET_STEP_MS,
} from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An explorer of the Mandelbrot set. It holds where the visitor is looking,
 * the image being computed for it, and the colours it is drawn in.
 *
 * A pan or a zoom moves the region at once, and leaves the image behind.
 * The image is computed again once the gesture is over and a moment has
 * passed with nothing moving. So a run of mouse-wheel notches costs one
 * image rather than twenty. Until then the region and the image's own region
 * differ, and whoever draws the image scales and shifts it to fit.
 *
 * A photo waits for the image to be finished for the region being looked
 * at, so a picture is never saved half sharp.
 */
export interface ExplorerModel {
    /** The region of the complex plane the visitor is looking at. A gesture moves it at once. */
    readonly region: PlaneRegion;
    /** How much the region magnifies the home view. */
    readonly zoom: number;
    /** The image being computed, and the region it covers. */
    readonly field: EscapeGrid;
    /** The whole set at a glance, computed once, for a minimap to be drawn from. */
    readonly overview: EscapeGrid;
    /** The colours the image is drawn in. */
    readonly palette: PaletteName;
    /** Whether a finger or the mouse is working the view, so the image is held still. */
    readonly isGesturing: boolean;
    /**
     * How many iterations each sample of the image gets. It is the detail
     * the image now shown is computed with, so during a gesture it lags the
     * depth of the region.
     */
    readonly maxIterations: number;
    /** Whether a photo has been asked for, and waits for the image to be finished. */
    readonly isPhotoPending: boolean;
    /** Rises each time a photo asked for is ready, with the image finished for the region being looked at. */
    readonly photosTaken: number;
    /** Sets the size of the sample grid the image is computed on, in samples. */
    resize: (cols: number, rows: number) => void;
    /** A gesture started, so the image is held still until it ends. */
    beginGesture: () => void;
    /** The gesture ended, so the image follows the region at once. */
    endGesture: () => void;
    /** Moves the region by `deltaRe` and `deltaIm`, in units of the complex plane. */
    panBy: (deltaRe: number, deltaIm: number) => void;
    /** Magnifies the region by `factor`, keeping the point `re` + `im`i where it is. */
    zoomBy: (factor: number, re: number, im: number) => void;
    /** Draws the image in `palette`'s colours from now on. */
    choosePalette: (palette: PaletteName) => void;
    /** Asks for a photo, which is taken once the image is finished. A second request while one waits changes nothing. */
    requestPhoto: () => void;
    /** Goes back to the home view. */
    reset: () => void;
    /** Settles the image after a gesture, and computes as much of it as one frame's budget buys. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an explorer at the home view, with the image computed on a grid of
 * a few samples until whoever draws it says how big it is.
 */
export function createExplorerModel(): ExplorerModel {
    const viewport = createPlaneViewport();
    const field = createEscapeField({
        cols: STARTING_COLS,
        rows: STARTING_ROWS,
        region: viewport,
        maxIterations: pickIterations(viewport.span),
    });
    // The overview covers the home view, and never moves.
    const overview = createEscapeField({
        cols: OVERVIEW_COLS,
        rows: OVERVIEW_ROWS,
        region: { centerRe: viewport.centerRe, centerIm: viewport.centerIm, span: viewport.span },
        maxIterations: OVERVIEW_ITERATIONS,
    });

    let palette: PaletteName = STARTING_PALETTE;
    let isGesturing = false;
    let isPhotoPending = false;
    let photosTaken = 0;
    // Whether the region has moved away from the image's, and how long is
    // left before the image is computed again.
    let isStale = false;
    let settleMs = 0;

    const model: ExplorerModel = {
        get region() { return viewport; },
        get zoom() { return viewport.zoom; },
        get field() { return field; },
        get overview() { return overview; },
        get palette() { return palette; },
        get isGesturing() { return isGesturing; },
        get maxIterations() { return field.maxIterations; },
        get isPhotoPending() { return isPhotoPending; },
        get photosTaken() { return photosTaken; },

        resize(cols, rows) {
            if (cols === field.cols && rows === field.rows) return;
            field.resize(cols, rows);
            computeImage();
        },

        beginGesture() {
            isGesturing = true;
        },

        endGesture() {
            isGesturing = false;
            // The fingers are off the view, so the image follows at once.
            if (isStale) settleMs = 0;
        },

        panBy(deltaRe, deltaIm) {
            viewport.panBy(deltaRe, deltaIm);
            holdImage();
        },

        zoomBy(factor, re, im) {
            viewport.zoomBy(factor, re, im);
            holdImage();
        },

        choosePalette(next) {
            palette = next;
        },

        requestPhoto() {
            isPhotoPending = true;
        },

        reset() {
            viewport.reset();
            holdImage();
            // Nothing is moving, so the image follows at once.
            settleMs = 0;
        },

        update(deltaMs) {
            if (isStale && !isGesturing) {
                settleMs -= deltaMs;
                if (settleMs <= 0) computeImage();
            }

            // The work of one frame, shared out: the overview first, because
            // it is small and the minimap has nothing to show until it is
            // done.
            let budget = ITERATIONS_PER_FRAME * pickBudgetShare(deltaMs);
            if (!overview.isComplete) budget -= overview.advance(budget);
            field.advance(budget);

            if (isPhotoPending && !isStale && !isGesturing && field.isComplete) {
                isPhotoPending = false;
                photosTaken++;
            }
        },
    };

    return model;

    /** Leaves the image where it is, to be computed again once nothing is moving. */
    function holdImage(): void {
        isStale = true;
        settleMs = SETTLE_MS;
    }

    /**
     * Starts the image again, over the region the visitor is looking at now.
     * A region the image already covers, at the same detail, is left as it
     * is. So two fingers resting on the view, moving nothing, cost nothing.
     */
    function computeImage(): void {
        isStale = false;
        settleMs = 0;
        const iterations = pickIterations(viewport.span);
        const shown = field.region;
        if (
            shown.centerRe === viewport.centerRe && shown.centerIm === viewport.centerIm
            && shown.span === viewport.span && field.maxIterations === iterations
        ) return;
        field.restart({ centerRe: viewport.centerRe, centerIm: viewport.centerIm, span: viewport.span }, iterations);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The grid the image is computed on until it is told the size of the view. */
const STARTING_COLS = 64;
const STARTING_ROWS = 48;

const STARTING_PALETTE: PaletteName = 'ember';

/**
 * How much of a frame's budget a step of `deltaMs` buys. A step longer than
 * one frame buys less, down to `MIN_BUDGET_SHARE`.
 */
function pickBudgetShare(deltaMs: number): number {
    if (!(deltaMs > TARGET_STEP_MS)) return 1;
    return Math.max(MIN_BUDGET_SHARE, TARGET_STEP_MS / deltaMs);
}

/**
 * How many iterations a sample gets in a view `span` wide. The deeper the
 * view, the finer the detail at its edges, and the longer a point must be
 * followed before it is called one of the set's own.
 */
function pickIterations(span: number): number {
    const halvings = Math.log2(HOME_SPAN / span);
    const iterations = BASE_ITERATIONS + Math.max(0, halvings) * ITERATIONS_PER_HALVING;
    return Math.min(MAX_ITERATIONS, Math.round(iterations));
}
