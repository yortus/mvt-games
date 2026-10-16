import type { FractalKind, ScopeSetting } from '../../data';
import type { PaletteName } from '../palette-name';
import type { EscapeKernel } from '../../models';
import { createEscapeField, type EscapeGrid } from './escape-field';
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
    STARTING_COLS,
    STARTING_ROWS,
    TARGET_STEP_MS,
} from './picture-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The picture of what the scope shows, as it is computed for the screen,
 * and what the views showing it share: the palette, and a photo asked for.
 *
 * The scope says which fractal, and its setting. The picture follows, a step
 * behind, like a photograph taken at the scope's last setting. It is
 * computed a little each frame, coarse blocks first, sharpening in place.
 * While the scope's setting changes, the picture holds still, so the view
 * stretches it to fit. Once a gesture has ended, or a moment has passed with
 * nothing moving, the picture is taken again at the scope's new setting. So
 * a run of mouse-wheel notches costs one picture rather than twenty.
 *
 * All of it is presentation. No domain outcome depends on any of it, and the
 * model never sees it.
 */
export interface PictureViewModel {
    /** The picture being computed, and the scope setting it was taken at. It lags the scope while the scope's setting changes. */
    readonly image: EscapeGrid;
    /** The whole fractal at a glance, taken at its rest setting, for a minimap to be drawn from. */
    readonly overview: EscapeGrid;
    /** The colours the picture is drawn in. */
    readonly palette: PaletteName;
    /** Whether a finger or the mouse is on the picture, holding it still. */
    readonly isHeld: boolean;
    /** Whether a photo has been asked for, and waits for the picture to be finished. */
    readonly isPhotoPending: boolean;
    /** Rises each time a photo asked for is ready, with the picture finished at the scope's setting now. */
    readonly photosTaken: number;
    /** Sets the size of the picture's sample grid, and takes the picture again at the scope's setting now. */
    resize: (cols: number, rows: number) => void;
    /** Holds the picture still, as a gesture starts. */
    hold: () => void;
    /** Lets go of the picture, as a gesture ends, so it follows the scope at once. */
    release: () => void;
    /** Draws the picture in `palette`'s colours from now on. */
    choosePalette: (palette: PaletteName) => void;
    /** Asks for a photo, which is ready once the picture is finished. A second request while one waits changes nothing. */
    requestPhoto: () => void;
    /** Follows the scope, and computes as much of the picture as one frame's budget buys. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the picture follows: the scope's fractal and setting, and its rule for measuring a point. */
export interface PictureViewModelOptions {
    /** The fractal under the scope. */
    readonly fractal: () => FractalKind;
    /** The scope's setting now. */
    readonly setting: () => ScopeSetting;
    /** How strongly the scope magnifies, against its rest setting. */
    readonly magnification: () => number;
    /** The fractal's rest setting, which the overview is taken at. */
    readonly restSetting: () => ScopeSetting;
    /** Measures how fast a point escapes under the fractal under the scope. */
    readonly measureEscape: EscapeKernel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the picture of what the scope shows, taken at its setting now, on
 * a small grid until it is told how big the canvas is.
 */
export function createPictureViewModel(options: PictureViewModelOptions): PictureViewModel {
    const { measureEscape } = options;
    const image = createEscapeField({
        measureEscape,
        cols: STARTING_COLS,
        rows: STARTING_ROWS,
        setting: copySetting(options.setting()),
        maxIterations: pickIterations(options.magnification()),
    });
    const overview = createEscapeField({
        measureEscape,
        cols: OVERVIEW_COLS,
        rows: OVERVIEW_ROWS,
        setting: options.restSetting(),
        maxIterations: OVERVIEW_ITERATIONS,
    });

    let palette: PaletteName = STARTING_PALETTE;
    let isHeld = false;
    let isPhotoPending = false;
    let photosTaken = 0;

    // The fractal and setting as last seen, to tell when either has changed.
    let seenFractal = options.fractal();
    let seenRe = Number.NaN;
    let seenIm = Number.NaN;
    let seenWidth = Number.NaN;
    noteSetting(options.setting());
    // Whether the scope's setting has changed from the picture's, and how
    // long is left before the picture follows.
    let isStale = false;
    let settleMs = 0;

    const viewModel: PictureViewModel = {
        get image() { return image; },
        get overview() { return overview; },
        get palette() { return palette; },
        get isHeld() { return isHeld; },
        get isPhotoPending() { return isPhotoPending; },
        get photosTaken() { return photosTaken; },

        resize(cols, rows) {
            if (cols === image.cols && rows === image.rows) return;
            image.resize(cols, rows);
            catchUp();
        },

        hold() {
            isHeld = true;
        },

        release() {
            isHeld = false;
            // The last moves of the gesture may have come since the last
            // frame, so they are looked for now.
            followScope();
            if (isStale) settleMs = 0;
        },

        choosePalette(next) {
            palette = next;
        },

        requestPhoto() {
            isPhotoPending = true;
        },

        update(deltaMs) {
            followScope();
            if (isStale && !isHeld) {
                settleMs -= deltaMs;
                if (settleMs <= 0) catchUp();
            }

            // The work of one frame, shared out: the overview first, because
            // it is small and the minimap has nothing to show until it is
            // done.
            let budget = ITERATIONS_PER_FRAME * pickBudgetShare(deltaMs);
            if (!overview.isComplete) budget -= overview.advance(budget);
            image.advance(budget);

            if (isPhotoPending && !isStale && !isHeld && image.isComplete) {
                isPhotoPending = false;
                photosTaken++;
            }
        },
    };

    return viewModel;

    /**
     * Notices what the scope has done since last looked. A new fractal
     * starts the picture and the overview again from nothing, at once,
     * because the old picture is no guide to the new one. A changed setting
     * leaves the picture where it is, to follow once nothing is moving.
     */
    function followScope(): void {
        const fractal = options.fractal();
        const setting = options.setting();
        if (fractal !== seenFractal) {
            seenFractal = fractal;
            noteSetting(setting);
            image.clear(copySetting(setting), pickIterations(options.magnification()));
            overview.clear(options.restSetting(), OVERVIEW_ITERATIONS);
            isStale = false;
            settleMs = 0;
            return;
        }
        if (setting.centreRe !== seenRe || setting.centreIm !== seenIm || setting.width !== seenWidth) {
            noteSetting(setting);
            isStale = true;
            settleMs = SETTLE_MS;
        }
    }

    /**
     * Takes the picture again, at the scope's setting now. A picture already
     * taken at that setting, at the same detail, is left as it is. So two
     * fingers resting on the canvas, moving nothing, cost nothing.
     */
    function catchUp(): void {
        isStale = false;
        settleMs = 0;
        const setting = options.setting();
        const iterations = pickIterations(options.magnification());
        const taken = image.setting;
        if (
            taken.centreRe === setting.centreRe && taken.centreIm === setting.centreIm
            && taken.width === setting.width && image.maxIterations === iterations
        ) return;
        image.restart(copySetting(setting), iterations);
    }

    function noteSetting(setting: ScopeSetting): void {
        seenRe = setting.centreRe;
        seenIm = setting.centreIm;
        seenWidth = setting.width;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STARTING_PALETTE: PaletteName = 'ember';

/** A copy of `setting`, which the scope goes on changing in place. */
function copySetting(setting: ScopeSetting): ScopeSetting {
    return { centreRe: setting.centreRe, centreIm: setting.centreIm, width: setting.width };
}

/**
 * How much of a frame's budget a step of `deltaMs` buys. A step longer than
 * one frame buys less, down to `MIN_BUDGET_SHARE`.
 */
function pickBudgetShare(deltaMs: number): number {
    if (!(deltaMs > TARGET_STEP_MS)) return 1;
    return Math.max(MIN_BUDGET_SHARE, TARGET_STEP_MS / deltaMs);
}

/**
 * How many iterations a sample gets at `magnification`. The stronger the
 * magnification, the finer the detail at the fractal's edges, and the
 * longer a point must be followed before it is called one of the set's own.
 */
function pickIterations(magnification: number): number {
    const halvings = Math.log2(magnification);
    const iterations = BASE_ITERATIONS + Math.max(0, halvings) * ITERATIONS_PER_HALVING;
    return Math.min(MAX_ITERATIONS, Math.round(iterations));
}
