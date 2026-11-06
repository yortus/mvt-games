import type { FractalKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Each fractal's name, as the panel lists it. */
export const FRACTAL_LABELS: { readonly [K in FractalKind]: string } = {
    'mandelbrot': 'Mandelbrot set',
    'burning-ship': 'Burning Ship',
    'circle-lace': 'Circle lace',
    'batik-fold': 'Batik fold',
    'newton-pinwheel': 'Newton pinwheel',
    'julia-rabbit': 'Julia set (rabbit)',
    'julia-spiral': 'Julia set (spirals)',
    'phoenix': 'Phoenix',
};
