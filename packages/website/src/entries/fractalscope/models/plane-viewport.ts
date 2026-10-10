import { type HomeView, MAX_CENTER_DRIFT, MAX_ZOOM_OUT, MIN_SPAN } from '../data';
import type { PlaneRegion } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The region of the complex plane being looked at, and the ways it moves.
 * It can be dragged sideways, magnified about a point, or sent home.
 * Everything here is in units of the complex plane. How many pixels an image
 * of it has, and how big they are, is not its business.
 *
 * It is not a model of its own, because nothing about it changes with time.
 */
export interface PlaneViewport extends PlaneRegion {
    /** Where the view starts, and goes back to on a reset. Its zoom is measured against it. */
    readonly home: HomeView;
    /** How much the view magnifies its home view. */
    readonly zoom: number;
    /** Whether the view is exactly at its home view. */
    readonly isAtHome: boolean;
    /** Moves the view by `deltaRe` and `deltaIm`. */
    panBy: (deltaRe: number, deltaIm: number) => void;
    /**
     * Multiplies the magnification by `factor`, keeping the point `re` +
     * `im`i where it is. A factor above 1 magnifies. The view stops at the
     * widest and narrowest it is allowed, and the point stays put either
     * way.
     */
    zoomBy: (factor: number, re: number, im: number) => void;
    /** Puts the view back at its home view. */
    reset: () => void;
    /** Makes `home` the view's home view, and goes there. */
    goHome: (home: HomeView) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a plane viewport. */
export interface PlaneViewportOptions {
    /** Where the view starts. */
    readonly home: HomeView;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a viewport at its home view. */
export function createPlaneViewport(options: PlaneViewportOptions): PlaneViewport {
    let home = options.home;
    let centerRe = home.centerRe;
    let centerIm = home.centerIm;
    let span = home.span;

    const viewport: PlaneViewport = {
        get home() { return home; },
        get centerRe() { return centerRe; },
        get centerIm() { return centerIm; },
        get span() { return span; },
        get zoom() { return home.span / span; },
        get isAtHome() {
            return centerRe === home.centerRe && centerIm === home.centerIm && span === home.span;
        },

        panBy(deltaRe, deltaIm) {
            centerRe = limitDrift(centerRe + deltaRe, home.centerRe);
            centerIm = limitDrift(centerIm + deltaIm, home.centerIm);
        },

        zoomBy(factor, re, im) {
            if (!(factor > 0)) return;
            const nextSpan = Math.min(home.span * MAX_ZOOM_OUT, Math.max(MIN_SPAN, span / factor));
            // The factor actually applied, after the limits on the width. The
            // point keeps its place in the view, so the view closes in on
            // whatever is under the fingers.
            const applied = span / nextSpan;
            span = nextSpan;
            centerRe = limitDrift(re + (centerRe - re) / applied, home.centerRe);
            centerIm = limitDrift(im + (centerIm - im) / applied, home.centerIm);
        },

        reset() {
            centerRe = home.centerRe;
            centerIm = home.centerIm;
            span = home.span;
        },

        goHome(next) {
            home = next;
            viewport.reset();
        },
    };

    return viewport;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** `value`, held within the drift allowed either side of `center`. */
function limitDrift(value: number, center: number): number {
    return Math.min(center + MAX_CENTER_DRIFT, Math.max(center - MAX_CENTER_DRIFT, value));
}
