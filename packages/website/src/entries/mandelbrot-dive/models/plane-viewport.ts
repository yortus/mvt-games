import { HOME_CENTER_IM, HOME_CENTER_RE, HOME_SPAN, MAX_CENTER_DRIFT, MAX_SPAN, MIN_SPAN } from '../data';
import type { PlaneRegion } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The region of the complex plane being looked at, and the ways it moves:
 * dragged sideways, magnified about a point, or sent home. Everything here
 * is in units of the complex plane. How many pixels an image of it has, and
 * how big they are, is not its business.
 *
 * It is not a model of its own: nothing about it changes with time.
 */
export interface PlaneViewport extends PlaneRegion {
    /** How much the view magnifies the home view. */
    readonly zoom: number;
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
    /** Puts the view back where it started. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a viewport over the home view. */
export function createPlaneViewport(): PlaneViewport {
    let centerRe = HOME_CENTER_RE;
    let centerIm = HOME_CENTER_IM;
    let span = HOME_SPAN;

    const viewport: PlaneViewport = {
        get centerRe() { return centerRe; },
        get centerIm() { return centerIm; },
        get span() { return span; },
        get zoom() { return HOME_SPAN / span; },
        get isAtHome() {
            return centerRe === HOME_CENTER_RE && centerIm === HOME_CENTER_IM && span === HOME_SPAN;
        },

        panBy(deltaRe, deltaIm) {
            centerRe = limitDrift(centerRe + deltaRe, HOME_CENTER_RE);
            centerIm = limitDrift(centerIm + deltaIm, HOME_CENTER_IM);
        },

        zoomBy(factor, re, im) {
            if (!(factor > 0)) return;
            const nextSpan = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span / factor));
            // The factor actually applied, after the limits on the width. The
            // point keeps its place in the view, so the view closes in on
            // whatever is under the fingers.
            const applied = span / nextSpan;
            span = nextSpan;
            centerRe = limitDrift(re + (centerRe - re) / applied, HOME_CENTER_RE);
            centerIm = limitDrift(im + (centerIm - im) / applied, HOME_CENTER_IM);
        },

        reset() {
            centerRe = HOME_CENTER_RE;
            centerIm = HOME_CENTER_IM;
            span = HOME_SPAN;
        },
    };

    return viewport;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** `value`, held within the drift allowed either side of `home`. */
function limitDrift(value: number, home: number): number {
    return Math.min(home + MAX_CENTER_DRIFT, Math.max(home - MAX_CENTER_DRIFT, value));
}
