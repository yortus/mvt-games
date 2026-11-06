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
     * never did. Under the Newton pinwheel, where points settle instead of
     * escaping, it is how fast the point settled, and under the Batik fold,
     * where they do neither, how far it wandered.
     */
    escape: number;
    /**
     * What the point cost, in iterations of the Mandelbrot set's loop. A
     * kernel whose steps take longer than that loop's counts each step as
     * several, so that a frame's budget buys the same time under any fractal.
     */
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

/** The constant of the rabbit Julia set, whose arms come in threes. */
const RABBIT_RE = -0.123;
const RABBIT_IM = 0.745;

/** The constant of the spiral Julia set, which coils into pairs of spirals. */
const SPIRAL_RE = -0.8;
const SPIRAL_IM = 0.156;

/** The Phoenix's constant, and how much of the step before last each step adds. */
const PHOENIX_C = 0.5667;
const PHOENIX_MEMORY = -0.5;

/** How strongly the circle lace's pole at the origin pushes points away. */
const LACE_PUSH = -0.0625;

/**
 * How much the circle lace's escape values are stretched. Its points escape
 * in a handful of steps, and without this they would all land in the first
 * colours of a palette.
 */
const LACE_STRETCH = 5;

/** What a step of the circle lace costs, in iterations of the Mandelbrot set's loop. */
const LACE_STEP_COST = 4;

/**
 * The Batik fold's constant. It decides which motifs appear, and a small
 * change to it gives a different cloth.
 */
const BATIK_RE = -0.8;
const BATIK_IM = -0.8;

/** Added to the distance squared before dividing by it, so that the origin is a point like any other. */
const BATIK_MIN_MODULUS_SQ = 1e-9;

/**
 * How many iterations of detail buy one fold. Every fold reveals a finer
 * layer of the pattern, so the view gets more of them as it closes in.
 */
const BATIK_ITERATIONS_PER_FOLD = 26;

/** How much a point's average travel is stretched, to reach across a palette. */
const BATIK_STRETCH = 42;

/** What a fold costs, in iterations of the Mandelbrot set's loop. */
const BATIK_FOLD_COST = 2;

/** How many roots the Newton pinwheel's polynomial, z⁵ - 1, has. */
const PINWHEEL_ROOTS = 5;

/**
 * What the Newton pinwheel multiplies each of Newton's steps by. A factor of
 * 1 would be Newton's own method. Making it complex turns every step a little
 * to one side, and that twists the borders between the roots into blades.
 */
const PINWHEEL_TWIST_RE = 1.5;
const PINWHEEL_TWIST_IM = 0.4;

/** The twist as it is applied, with the division by the polynomial's degree already done. */
const PINWHEEL_STEP_RE = PINWHEEL_TWIST_RE / PINWHEEL_ROOTS;
const PINWHEEL_STEP_IM = PINWHEEL_TWIST_IM / PINWHEEL_ROOTS;

/** A step this small, squared, means that the point has settled on a root. */
const PINWHEEL_SETTLED_SQ = 1e-8;

/**
 * A step this long, squared, means that the point landed almost on the
 * origin and was flung off. It stops there, because the next step's
 * arithmetic would overflow.
 */
const PINWHEEL_FLUNG_SQ = 1e70;

/** How much the steps shrink by, as a logarithm, each time, once a point nears a root. */
const PINWHEEL_LOG_SHRINK = Math.log(Math.hypot(1 - PINWHEEL_TWIST_RE, PINWHEEL_TWIST_IM));

/** How much each step spent settling adds to a point's value, which sets how close the bands of colour lie. */
const PINWHEEL_STRETCH = 2;

/**
 * How far apart the roots' values start. The palettes are read by the square
 * root of the value, so the nth root starts at n² times this, which spreads
 * the roots evenly round a palette and gives each its own colours.
 */
const PINWHEEL_ROOT_SPACING = 8;

/** What a step of the Newton pinwheel costs, in iterations of the Mandelbrot set's loop. */
const PINWHEEL_STEP_COST = 4;

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

/**
 * z² + p/z², from z = the point itself, for a fixed p. Far from the origin
 * the z² wins and points fly away. Near it the p/z² wins and flings them out
 * just as hard, so the set of points that stay is a ring between the two,
 * eaten away by holes, each hole a copy of the middle one. Nothing has an
 * inside here: the holes are all outside.
 */
function measureCircleLace(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    let x = re;
    let y = im;
    let modulusSq = x * x + y * y;
    let i = 0;
    while (i < maxIterations && modulusSq <= BAILOUT_SQ) {
        const sqRe = x * x - y * y;
        const sqIm = 2 * x * y;
        const sqModulusSq = sqRe * sqRe + sqIm * sqIm;
        // The origin itself is flung to infinity in one step.
        if (sqModulusSq === 0) {
            measure.iterations = i * LACE_STEP_COST;
            measure.escape = 0;
            return;
        }
        const scale = LACE_PUSH / sqModulusSq;
        x = sqRe + scale * sqRe;
        y = sqIm - scale * sqIm;
        modulusSq = x * x + y * y;
        i++;
    }
    finish(i, modulusSq, maxIterations, LOG_2, measure);
    measure.iterations *= LACE_STEP_COST;
    if (measure.escape !== INTERIOR) measure.escape *= LACE_STRETCH;
}

/**
 * Mirrors z into the first quadrant, turns it inside out through the unit
 * circle, and adds k, from z = the point itself. Points here neither escape
 * nor settle: the inside-out step pulls far points back, so they wander
 * forever. The image is how far each one wanders on average, and mirroring
 * at every step is what repeats the motifs, as in a folded and dyed cloth.
 */
function measureBatikFold(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    const folds = Math.max(1, Math.round(maxIterations / BATIK_ITERATIONS_PER_FOLD));
    let x = re;
    let y = im;
    let distance = 0;
    let travelled = 0;
    for (let i = 0; i < folds; i++) {
        const modulusSq = x * x + y * y + BATIK_MIN_MODULUS_SQ;
        x = Math.abs(x) / modulusSq + BATIK_RE;
        y = Math.abs(y) / modulusSq + BATIK_IM;
        const nextDistance = Math.sqrt(x * x + y * y);
        travelled += Math.abs(nextDistance - distance);
        distance = nextDistance;
    }
    measure.iterations = folds * BATIK_FOLD_COST;
    measure.escape = travelled / folds * BATIK_STRETCH;
}

/**
 * Newton's method for finding the roots of z⁵ - 1, from z = the point itself,
 * with every step twisted a little to one side. Nothing escapes here. Every
 * point settles on one of the five roots instead, and the image shows which
 * root it chose and how long that took. The borders between the five regions
 * are where the fractal lives: any point on one has all five roots nearby.
 *
 * A step of Newton's method on z⁵ - 1 is (z - 1/z⁴)/5, which is how it is
 * written here.
 */
function measureNewtonPinwheel(re: number, im: number, maxIterations: number, measure: EscapeMeasure): void {
    let x = re;
    let y = im;
    let stepSq = 1;
    let i = 0;
    while (i < maxIterations && stepSq > PINWHEEL_SETTLED_SQ && stepSq < PINWHEEL_FLUNG_SQ) {
        const sqRe = x * x - y * y;
        const sqIm = 2 * x * y;
        const fourthRe = sqRe * sqRe - sqIm * sqIm;
        const fourthIm = 2 * sqRe * sqIm;
        const fourthModulusSq = fourthRe * fourthRe + fourthIm * fourthIm;
        const gapRe = x - fourthRe / fourthModulusSq;
        const gapIm = y + fourthIm / fourthModulusSq;
        const stepRe = PINWHEEL_STEP_RE * gapRe - PINWHEEL_STEP_IM * gapIm;
        const stepIm = PINWHEEL_STEP_RE * gapIm + PINWHEEL_STEP_IM * gapRe;
        x -= stepRe;
        y -= stepIm;
        stepSq = stepRe * stepRe + stepIm * stepIm;
        i++;
    }
    measure.iterations = i * PINWHEEL_STEP_COST;
    // Written this way round so that a step that came to nothing, at the
    // origin itself, counts as never having settled.
    if (!(stepSq <= PINWHEEL_SETTLED_SQ)) {
        measure.escape = INTERIOR;
        return;
    }
    const turns = Math.atan2(y, x) / (2 * Math.PI);
    const root = (Math.round(turns * PINWHEEL_ROOTS) + PINWHEEL_ROOTS) % PINWHEEL_ROOTS;
    // How far through the last step it crossed the line, as the steps shrink.
    const overshoot = Math.log(PINWHEEL_SETTLED_SQ / Math.max(stepSq, Number.MIN_VALUE)) / (2 * PINWHEEL_LOG_SHRINK);
    const settled = i + overshoot;
    measure.escape = (settled > 0 ? settled : 0) * PINWHEEL_STRETCH + PINWHEEL_ROOT_SPACING * root * root;
}

/** Writes what a loop found: escaped after `i` steps, or never, if it ran out of them. */
function finish(i: number, modulusSq: number, maxIterations: number, logDegree: number, measure: EscapeMeasure): void {
    measure.iterations = i;
    measure.escape = i >= maxIterations ? INTERIOR : smoothEscape(i, modulusSq, logDegree);
}

const KERNELS: { readonly [K in FractalKind]: EscapeKernel } = {
    'mandelbrot': measureMandelbrot,
    'burning-ship': measureBurningShip,
    'circle-lace': measureCircleLace,
    'batik-fold': measureBatikFold,
    'newton-pinwheel': measureNewtonPinwheel,
    'julia-rabbit': (re, im, maxIterations, measure) => measureJulia(re, im, RABBIT_RE, RABBIT_IM, maxIterations, measure),
    'julia-spiral': (re, im, maxIterations, measure) => measureJulia(re, im, SPIRAL_RE, SPIRAL_IM, maxIterations, measure),
    'phoenix': measurePhoenix,
};
