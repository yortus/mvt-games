import type { FractalKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The escape value of a sample that never escaped, so it lies inside the set. */
export const INTERIOR = -1;

/** What a kernel found for one point: how fast it escaped, and what that cost. */
export interface EscapeMeasure {
    /**
     * How fast the point escaped, as a fractional iteration count, so that
     * colours drawn from it have no bands of their own. `INTERIOR` if it
     * never did.
     */
    escape: number;
    /** How many iterations the kernel spent on the point. */
    iterations: number;
}

/**
 * Follows the point `re` + `im`i under one fractal's rule, for at most
 * `maxIterations` steps, and writes what it found into `measure`. It writes
 * into an object it is given, rather than returning one, so that measuring a
 * million points allocates nothing.
 */
export type EscapeKernel = (re: number, im: number, maxIterations: number, measure: EscapeMeasure) => void;

/** The kernel of the fractal `kind`. */
export function pickKernel(kind: FractalKind): EscapeKernel {
    return KERNELS[kind];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * How far a point must travel from the origin to count as escaped. It is far
 * further than the 2 that settles the question for most of these fractals,
 * because the extra distance is what makes the fractional part of the count
 * smooth.
 */
const BAILOUT_SQ = 128 * 128;

/** What a point costs when a shape test settles it, in iterations of the loop it saved. */
const EARLY_OUT_COST = 4;

const LOG_2 = Math.LN2;
const LOG_3 = Math.log(3);

/** The constant of the rabbit Julia set, whose arms come in threes. */
const RABBIT_RE = -0.123;
const RABBIT_IM = 0.745;

/** The constant of the spiral Julia set, which coils into pairs of spirals. */
const SPIRAL_RE = -0.8;
const SPIRAL_IM = 0.156;

/** The Phoenix's constant, and how much of the step before last each step adds. */
const PHOENIX_C = 0.5667;
const PHOENIX_MEMORY = -0.5;

/**
 * The fractional escape value of a point that escaped after `i` steps and
 * landed `modulusSq` from the origin, squared, under a rule of degree
 * `logDegree`'s power. It is never negative.
 */
function smoothEscape(i: number, modulusSq: number, logDegree: number): number {
    const logModulus = Math.log(modulusSq) * 0.5;
    const smooth = i + 1 - Math.log(logModulus / LOG_2) / logDegree;
    return smooth > 0 ? smooth : 0;
}

/** z² + c, from z = 0. */
function measureMandelbrot(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    // The main cardioid and the big bulb beside it are inside the set.
    // Testing for them costs a few multiplications, where the loop would take
    // every iteration it is allowed.
    const imSq = im * im;
    const q = (re - 0.25) * (re - 0.25) + imSq;
    if (q * (q + re - 0.25) <= 0.25 * imSq || (re + 1) * (re + 1) + imSq <= 0.0625) {
        measure.escape = INTERIOR;
        measure.iterations = EARLY_OUT_COST;
        return;
    }
    let x = 0;
    let y = 0;
    let xSq = 0;
    let ySq = 0;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        y = 2 * x * y + im;
        x = xSq - ySq + re;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_2, measure);
}

/**
 * (|x| + |y|i)² + c, from z = 0. Folding z into the first quadrant before
 * each squaring is what draws the ship. It is drawn the usual way up, which
 * has the imaginary axis pointing down, so the point sampled is the mirror
 * image of `re` + `im`i.
 */
function measureBurningShip(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    const cIm = -im;
    let x = 0;
    let y = 0;
    let xSq = 0;
    let ySq = 0;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        y = Math.abs(2 * x * y) + cIm;
        x = xSq - ySq + re;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_2, measure);
}

/** The conjugate of z, squared, plus c, from z = 0. */
function measureTricorn(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    let x = 0;
    let y = 0;
    let xSq = 0;
    let ySq = 0;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        y = -2 * x * y + im;
        x = xSq - ySq + re;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_2, measure);
}

/** z³ + c, from z = 0: the Mandelbrot set's rule, one power higher. */
function measureMultibrot(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    let x = 0;
    let y = 0;
    let xSq = 0;
    let ySq = 0;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        const nextX = x * (xSq - 3 * ySq) + re;
        y = y * (3 * xSq - ySq) + im;
        x = nextX;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_3, measure);
}

/** z² + c with the real part of z² made positive, from z = 0. */
function measureCeltic(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    let x = 0;
    let y = 0;
    let xSq = 0;
    let ySq = 0;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        y = 2 * x * y + im;
        x = Math.abs(xSq - ySq) + re;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_2, measure);
}

/**
 * z² + k for a fixed k, from z = the point itself. Where the Mandelbrot set
 * varies the constant and starts from nothing, a Julia set fixes the
 * constant and starts from the point.
 */
function measureJulia(
    re: number, im: number, kRe: number, kIm: number, maxIterations: number, measure: EscapeMeasure,
): void {
    let x = re;
    let y = im;
    let xSq = x * x;
    let ySq = y * y;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        y = 2 * x * y + kIm;
        x = xSq - ySq + kRe;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_2, measure);
}

/**
 * z² + c + m·(the z of the step before), from z = the point itself, for a
 * fixed c and m. Each step remembers the one before last, which bends the
 * Julia set's shapes into feathers.
 */
function measurePhoenix(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    // It is drawn the usual way round, which is turned a quarter turn from
    // the plane's own.
    let x = im;
    let y = re;
    let lastX = 0;
    let lastY = 0;
    let xSq = x * x;
    let ySq = y * y;
    let i = 0;
    while (i < maxIterations && xSq + ySq <= BAILOUT_SQ) {
        const nextX = xSq - ySq + PHOENIX_C + PHOENIX_MEMORY * lastX;
        const nextY = 2 * x * y + PHOENIX_MEMORY * lastY;
        lastX = x;
        lastY = y;
        x = nextX;
        y = nextY;
        xSq = x * x;
        ySq = y * y;
        i++;
    }
    finish(i, xSq + ySq, maxIterations, LOG_2, measure);
}

/** Writes what a loop found: escaped after `i` steps, or never, if it ran out of them. */
function finish(i: number, modulusSq: number, maxIterations: number, logDegree: number, measure: EscapeMeasure): void {
    measure.iterations = i;
    measure.escape = i >= maxIterations ? INTERIOR : smoothEscape(i, modulusSq, logDegree);
}

const KERNELS: { readonly [K in FractalKind]: EscapeKernel } = {
    'mandelbrot': measureMandelbrot,
    'burning-ship': measureBurningShip,
    'tricorn': measureTricorn,
    'multibrot': measureMultibrot,
    'celtic': measureCeltic,
    'julia-rabbit': (re, im, maxIterations, measure) => measureJulia(re, im, RABBIT_RE, RABBIT_IM, maxIterations, measure),
    'julia-spiral': (re, im, maxIterations, measure) => measureJulia(re, im, SPIRAL_RE, SPIRAL_IM, maxIterations, measure),
    'phoenix': measurePhoenix,
};
