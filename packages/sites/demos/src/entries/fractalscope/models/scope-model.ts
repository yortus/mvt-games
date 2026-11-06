import {
    type FractalKind,
    MAX_CENTRE_DRIFT,
    MAX_RECENTRE_MS,
    MIN_MAGNIFICATION,
    MIN_RECENTRE_MS,
    MIN_WIDTH,
    REST_SETTINGS,
    type ScopeSetting,
    STARTING_FRACTAL,
    TRAVEL_RATE,
    ZOOM_RATE,
} from '../data';
import { type EscapeKernel, pickKernel } from './fractal-kernels';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which way the scope is zooming while a control is held. */
export type ZoomDirection = 'in' | 'out' | 'none';

/**
 * The fractalscope: an instrument, like a microscope, for looking into a
 * fractal. Its state is its setting, which is the fractal under it, the point
 * of the complex plane it is centred on, and how strongly it magnifies. Its
 * controls move the centre, turn the magnification and change the fractal,
 * and each of those takes effect at once. It can also be left travelling or
 * zooming, or sent back to its rest setting, and then it moves on a little
 * with each update.
 *
 * It never sees what it shows. It has no picture, no screen and no colours.
 * It answers one question about the fractal, how fast a point escapes, and
 * whatever draws the fractal asks it about each point it draws.
 *
 * A scope model is itself a `ScopeSetting`, the one it is set to now.
 */
export interface ScopeModel extends ScopeSetting {
    /** The fractal under the scope. */
    readonly fractal: FractalKind;
    /** The fractal's rest setting, where the scope starts and recentres to. */
    readonly restSetting: ScopeSetting;
    /** How strongly the scope magnifies, against its rest setting. */
    readonly magnification: number;
    /** Which way the scope is travelling along the real axis, from -1 to 1. */
    travelRe: number;
    /** Which way the scope is travelling along the imaginary axis, from -1 to 1. */
    travelIm: number;
    /** Which way the scope is zooming. */
    zooming: ZoomDirection;
    /** Whether the scope is moving by itself, because of a held control or a recentre. */
    readonly isMoving: boolean;
    /** Moves the centre by `deltaRe` and `deltaIm`, in units of the plane, as far as the drift allowed. */
    moveCentre: (deltaRe: number, deltaIm: number) => void;
    /**
     * Multiplies the magnification by `factor`, keeping the point `re` +
     * `im`i where it is in the patch the scope takes in. A factor above 1
     * magnifies. The magnification stops at its limits, and the point
     * stays put either way.
     */
    magnifyAbout: (factor: number, re: number, im: number) => void;
    /**
     * Eases back to the fractal's rest setting. The further in the scope is,
     * the longer that takes, from `MIN_RECENTRE_MS` to `MAX_RECENTRE_MS`. Any
     * other move of the scope stops it where it has got to, so the visitor
     * always has the last word.
     */
    recentre: () => void;
    /**
     * Puts the fractal `fractal` under the scope, at its rest setting.
     * Choosing the fractal already there changes nothing.
     */
    chooseFractal: (fractal: FractalKind) => void;
    /**
     * Measures how fast the point `re` + `im`i escapes under the fractal
     * under the scope, following it for at most `maxIterations` steps, and
     * writes what it found into `measure`.
     */
    measureEscape: EscapeKernel;
    /** Moves the scope on by `deltaMs`, as its held controls ask. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a scope over the starting fractal, at its rest setting. */
export function createScopeModel(): ScopeModel {
    let fractal = STARTING_FRACTAL;
    let kernel = pickKernel(fractal);
    let restSetting = REST_SETTINGS[fractal];
    let centreRe = restSetting.centreRe;
    let centreIm = restSetting.centreIm;
    let width = restSetting.width;

    let travelRe = 0;
    let travelIm = 0;
    let zooming: ZoomDirection = 'none';

    // Where a recentre set out from, and how long it has been going.
    let isRecentring = false;
    let recentreMs = 0;
    let recentreLengthMs = 0;
    let fromRe = 0;
    let fromIm = 0;
    let fromWidth = 0;

    const model: ScopeModel = {
        get fractal() { return fractal; },
        get restSetting() { return restSetting; },
        get centreRe() { return centreRe; },
        get centreIm() { return centreIm; },
        get width() { return width; },
        get magnification() { return restSetting.width / width; },

        get travelRe() { return travelRe; },
        set travelRe(value) { travelRe = limitTravel(value); },
        get travelIm() { return travelIm; },
        set travelIm(value) { travelIm = limitTravel(value); },
        get zooming() { return zooming; },
        set zooming(value) { zooming = value; },
        get isMoving() { return isRecentring || travelRe !== 0 || travelIm !== 0 || zooming !== 'none'; },

        moveCentre(deltaRe, deltaIm) {
            isRecentring = false;
            centreRe = limitDrift(centreRe + deltaRe, restSetting.centreRe);
            centreIm = limitDrift(centreIm + deltaIm, restSetting.centreIm);
        },

        magnifyAbout(factor, re, im) {
            if (!(factor > 0)) return;
            isRecentring = false;
            const widest = restSetting.width / MIN_MAGNIFICATION;
            const nextWidth = Math.min(widest, Math.max(MIN_WIDTH, width / factor));
            // The factor actually applied, after the limits. The point keeps
            // its place in the patch, so the scope closes in on it.
            const applied = width / nextWidth;
            width = nextWidth;
            centreRe = limitDrift(re + (centreRe - re) / applied, restSetting.centreRe);
            centreIm = limitDrift(im + (centreIm - im) / applied, restSetting.centreIm);
        },

        recentre() {
            isRecentring = true;
            recentreMs = 0;
            recentreLengthMs = pickRecentreLength(width, restSetting.width);
            fromRe = centreRe;
            fromIm = centreIm;
            fromWidth = width;
        },

        chooseFractal(next) {
            if (next === fractal) return;
            fractal = next;
            kernel = pickKernel(next);
            restSetting = REST_SETTINGS[next];
            jumpToRest();
        },

        measureEscape(re, im, maxIterations, measure) {
            kernel(re, im, maxIterations, measure);
        },

        update(deltaMs) {
            const seconds = deltaMs / 1000;
            if (zooming !== 'none') {
                const factor = Math.exp(ZOOM_RATE * seconds);
                model.magnifyAbout(zooming === 'in' ? factor : 1 / factor, centreRe, centreIm);
            }
            if (travelRe !== 0 || travelIm !== 0) {
                const distance = TRAVEL_RATE * width * seconds;
                model.moveCentre(travelRe * distance, travelIm * distance);
            }
            if (isRecentring) easeBack(deltaMs);
        },
    };

    return model;

    function jumpToRest(): void {
        isRecentring = false;
        centreRe = restSetting.centreRe;
        centreIm = restSetting.centreIm;
        width = restSetting.width;
    }

    /**
     * Moves a recentre on. Each value is worked out from where the recentre
     * set out, so it follows the same path at any step size. The width moves
     * by equal factors rather than equal amounts, which looks like an even
     * zoom. The centre keeps pace with the width, so the whole journey is one
     * zoom out from a fixed point. From deep in, the centre must hardly move
     * at first: a step that is tiny on the plane is a long way on the screen.
     */
    function easeBack(deltaMs: number): void {
        recentreMs += deltaMs;
        if (recentreMs >= recentreLengthMs) {
            jumpToRest();
            return;
        }
        const progress = recentreMs / recentreLengthMs;
        const eased = progress * progress * (3 - 2 * progress);
        width = fromWidth * (restSetting.width / fromWidth) ** eased;
        const widthToGo = restSetting.width - fromWidth;
        const share = widthToGo === 0 ? eased : (width - fromWidth) / widthToGo;
        centreRe = fromRe + (restSetting.centreRe - fromRe) * share;
        centreIm = fromIm + (restSetting.centreIm - fromIm) * share;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long a recentre from `width` takes, for a fractal that rests at `restWidth`. */
function pickRecentreLength(width: number, restWidth: number): number {
    const depth = Math.log(restWidth / width) / Math.log(restWidth / MIN_WIDTH);
    return MIN_RECENTRE_MS + (MAX_RECENTRE_MS - MIN_RECENTRE_MS) * Math.max(0, depth);
}

/** `value`, held between travelling flat out one way and the other. */
function limitTravel(value: number): number {
    return Math.min(1, Math.max(-1, value));
}

/** `value`, held within the drift allowed either side of `restValue`. */
function limitDrift(value: number, restValue: number): number {
    return Math.min(restValue + MAX_CENTRE_DRIFT, Math.max(restValue - MAX_CENTRE_DRIFT, value));
}
