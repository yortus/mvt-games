import {
    FRACTAL_KINDS,
    type FractalKind,
    MAX_CENTRE_DRIFT,
    MIN_MAGNIFICATION,
    MIN_WIDTH,
    REST_SETTINGS,
    type ScopeSetting,
} from '../data';
import { type EscapeKernel, pickKernel } from './fractal-kernels';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The fractalscope: an instrument, like a microscope, for looking into a
 * fractal. Its state is its setting, which is the fractal under it, the point
 * of the complex plane it is centred on, and how strongly it magnifies. Its
 * controls move the centre, turn the magnification, recentre, and change
 * the fractal. Every control takes effect at once.
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
    /** Moves the centre by `deltaRe` and `deltaIm`, in units of the plane, as far as the drift allowed. */
    moveCentre: (deltaRe: number, deltaIm: number) => void;
    /**
     * Multiplies the magnification by `factor`, keeping the point `re` +
     * `im`i where it is in the patch the scope takes in. A factor above 1
     * magnifies. The magnification stops at its limits, and the point
     * stays put either way.
     */
    magnifyAbout: (factor: number, re: number, im: number) => void;
    /** Goes back to the fractal's rest setting. */
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
    /** Nothing about the scope changes with time. It is here for the loop that runs every model. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a scope over the first fractal, at its rest setting. */
export function createScopeModel(): ScopeModel {
    let fractal = FRACTAL_KINDS[0];
    let kernel = pickKernel(fractal);
    let restSetting = REST_SETTINGS[fractal];
    let centreRe = restSetting.centreRe;
    let centreIm = restSetting.centreIm;
    let width = restSetting.width;

    const model: ScopeModel = {
        get fractal() { return fractal; },
        get restSetting() { return restSetting; },
        get centreRe() { return centreRe; },
        get centreIm() { return centreIm; },
        get width() { return width; },
        get magnification() { return restSetting.width / width; },

        moveCentre(deltaRe, deltaIm) {
            centreRe = limitDrift(centreRe + deltaRe, restSetting.centreRe);
            centreIm = limitDrift(centreIm + deltaIm, restSetting.centreIm);
        },

        magnifyAbout(factor, re, im) {
            if (!(factor > 0)) return;
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
            centreRe = restSetting.centreRe;
            centreIm = restSetting.centreIm;
            width = restSetting.width;
        },

        chooseFractal(next) {
            if (next === fractal) return;
            fractal = next;
            kernel = pickKernel(next);
            restSetting = REST_SETTINGS[next];
            model.recentre();
        },

        measureEscape(re, im, maxIterations, measure) {
            kernel(re, im, maxIterations, measure);
        },

        update(_deltaMs) {
            // Nothing to advance.
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** `value`, held within the drift allowed either side of `restValue`. */
function limitDrift(value: number, restValue: number): number {
    return Math.min(restValue + MAX_CENTRE_DRIFT, Math.max(restValue - MAX_CENTRE_DRIFT, value));
}
