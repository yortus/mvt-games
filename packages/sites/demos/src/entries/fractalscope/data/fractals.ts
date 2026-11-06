// ---------------------------------------------------------------------------
// Fractals
// ---------------------------------------------------------------------------

/**
 * The fractals the visitor chooses between. Each is a rule for following a
 * point of the complex plane, and the image is how fast each point escapes
 * to infinity under it. The Newton pinwheel shows how fast each point settles
 * on a root instead, and the Batik fold how far each point wanders.
 */
export type FractalKind =
    | 'batik-fold'
    | 'burning-ship'
    | 'circle-lace'
    | 'julia-rabbit'
    | 'julia-spiral'
    | 'mandelbrot'
    | 'newton-pinwheel'
    | 'phoenix';

/** Every fractal, in the order the panel lists them, which is alphabetical by name. */
export const FRACTAL_KINDS: readonly FractalKind[] = [
    'batik-fold',
    'burning-ship',
    'circle-lace',
    'julia-rabbit',
    'julia-spiral',
    'mandelbrot',
    'newton-pinwheel',
    'phoenix',
];

/** The fractal the scope starts over. */
export const STARTING_FRACTAL: FractalKind = 'mandelbrot';

/**
 * A setting of the scope: the point of the complex plane it is centred on,
 * and how wide a patch of the plane it takes in. How tall the patch is
 * depends on the shape of whatever shows it, so it is not the scope's
 * business.
 */
export interface ScopeSetting {
    readonly centreRe: number;
    readonly centreIm: number;
    /** How wide a patch of the plane the scope takes in, in units of the plane. */
    readonly width: number;
}

/**
 * The setting the scope rests at for each fractal: centred on it, and wide
 * enough to take in all of it. The scope starts there, goes back there to
 * recentre, and measures its magnification against it. Each is wide enough
 * for a patch three quarters as tall as it is wide, the shape of the
 * minimap, which shows it.
 */
export const REST_SETTINGS: { readonly [K in FractalKind]: ScopeSetting } = {
    'mandelbrot': { centreRe: -0.6, centreIm: 0, width: 3.2 },
    'burning-ship': { centreRe: -0.45, centreIm: 0.5, width: 4.4 },
    'circle-lace': { centreRe: 0, centreIm: 0, width: 3.2 },
    'batik-fold': { centreRe: 0, centreIm: 0, width: 3 },
    'newton-pinwheel': { centreRe: 0, centreIm: 0, width: 3.6 },
    'julia-rabbit': { centreRe: 0, centreIm: 0, width: 3.2 },
    'julia-spiral': { centreRe: 0, centreIm: 0, width: 3.6 },
    'phoenix': { centreRe: 0, centreIm: -0.25, width: 3.2 },
};
