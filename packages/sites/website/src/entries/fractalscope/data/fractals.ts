// ---------------------------------------------------------------------------
// Fractals
// ---------------------------------------------------------------------------

/**
 * The fractals the visitor chooses between. Each is a rule for following a
 * point of the complex plane, and the image is how fast each point escapes
 * to infinity under it.
 */
export type FractalKind =
    | 'mandelbrot'
    | 'burning-ship'
    | 'tricorn'
    | 'multibrot'
    | 'celtic'
    | 'julia-rabbit'
    | 'julia-spiral'
    | 'phoenix';

/** Every fractal, in the order the panel lists them. The scope starts over the first. */
export const FRACTAL_KINDS: readonly FractalKind[] = [
    'mandelbrot',
    'burning-ship',
    'tricorn',
    'multibrot',
    'celtic',
    'julia-rabbit',
    'julia-spiral',
    'phoenix',
];

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
    'tricorn': { centreRe: -0.4, centreIm: 0, width: 4.6 },
    'multibrot': { centreRe: 0, centreIm: 0, width: 3.8 },
    'celtic': { centreRe: -0.75, centreIm: 0, width: 5 },
    'julia-rabbit': { centreRe: 0, centreIm: 0, width: 3.2 },
    'julia-spiral': { centreRe: 0, centreIm: 0, width: 3.6 },
    'phoenix': { centreRe: 0, centreIm: -0.25, width: 3.2 },
};
