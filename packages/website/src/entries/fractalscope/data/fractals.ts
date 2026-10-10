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

/** Every fractal, in the order the panel lists them. The first is where the explorer starts. */
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

/** A view of the complex plane: where it is centred, and how wide it is. */
export interface HomeView {
    readonly centerRe: number;
    readonly centerIm: number;
    /** How wide the view is, in units of the complex plane. Its height is three quarters of it. */
    readonly span: number;
}

/**
 * Where each fractal's exploring starts: the whole of it, with a margin. A
 * home view is four units wide for every three tall, the shape of the
 * minimap, which shows it.
 */
export const FRACTAL_HOMES: { readonly [K in FractalKind]: HomeView } = {
    'mandelbrot': { centerRe: -0.6, centerIm: 0, span: 3.2 },
    'burning-ship': { centerRe: -0.45, centerIm: 0.5, span: 4.4 },
    'tricorn': { centerRe: -0.4, centerIm: 0, span: 4.6 },
    'multibrot': { centerRe: 0, centerIm: 0, span: 3.8 },
    'celtic': { centerRe: -0.75, centerIm: 0, span: 5 },
    'julia-rabbit': { centerRe: 0, centerIm: 0, span: 3.2 },
    'julia-spiral': { centerRe: 0, centerIm: 0, span: 3.6 },
    'phoenix': { centerRe: 0, centerIm: -0.25, span: 3.2 },
};
