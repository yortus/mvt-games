import {
    createColourTriple, findMostChroma, isInGamut, measureColourDistance, toHexColour, writeLinearRgb, writeLinearRgbOfHex, writeOklab,
    writeOklch,
} from './colour-space';
import type { Random } from '@mvtjs/site-kit/random';
import type { TilePatch } from './tile-patch';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A gradient painted over a patch: each tile's colour, and the axes it runs along. */
export interface PaintedGradient {
    /** Each tile's colour, as 0xRRGGBB. */
    readonly colours: readonly number[];
    /** Where each tile is along the hue axis and the lightness axis, from 0 at one end to 1 at the other. */
    readonly hueAxis: Float64Array;
    readonly lightAxis: Float64Array;
    /** How different the two most alike tiles look, in OKLab, once their colours are rounded to 8 bits. */
    readonly closestPair: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PaintGradientOptions {
    readonly patch: TilePatch;
    /** Where the gradient's look is drawn from. */
    readonly random: Random;
    /** How different the two most alike tiles must look, at least, in OKLab: the puzzle's subtlety. */
    readonly closestPair: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Paints a smooth gradient over the patch, a flat colour to each tile, or
 * returns undefined if the one drawn can't be made to fit, so another is
 * drawn. It works in OKLCH, so equal steps look equal.
 *
 * The gradient has two axes across the patch, turned to a random angle.
 * Along one, the hue sweeps round the colour wheel. Along the other,
 * lightness rises, and the hue leans warm in the light and cool in the
 * dark, as painters do. Chroma is a share of the most sRGB can show at each
 * tile's lightness and hue, so no tile is ever clipped.
 *
 * Where it sweeps from, which way round, and which end is light are drawn.
 * How far it sweeps is then found: the widest sweep and lightness span are
 * scaled together until the two most alike tiles are just far enough
 * apart. Sweeps of 120 to 150 degrees come out, between a triad and a split
 * complement, so the two ends are a pair that goes together.
 */
export function paintGradient(options: PaintGradientOptions): PaintedGradient | undefined {
    const { patch, random, closestPair: target } = options;
    const { count, middleXs, middleYs } = patch;
    const angle = random.next() * Math.PI * 2;
    // Whole degrees, so the hue drawn is the same in every browser
    const centreHue = Math.floor(random.next() * 360);
    const way = random.next() < 0.5 ? -1 : 1;
    const lightUp = random.next() < 0.5 ? -1 : 1;
    const chromaShare = LEAST_CHROMA_SHARE + Math.floor(random.next() * 16) / 16 * (MOST_CHROMA_SHARE - LEAST_CHROMA_SHARE);

    // Each tile's place along the two axes, which span the tiles themselves
    const hueAxis = new Float64Array(count);
    const lightAxis = new Float64Array(count);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let t = 0; t < count; t++) {
        hueAxis[t] = middleXs[t] * cos + middleYs[t] * sin;
        lightAxis[t] = -middleXs[t] * sin + middleYs[t] * cos;
    }
    spanZeroToOne(hueAxis);
    spanZeroToOne(lightAxis);

    const colours: number[] = new Array<number>(count).fill(0);
    const labs: Float64Array[] = [];
    for (let t = 0; t < count; t++) labs.push(createColourTriple());

    /** Paints every tile at `scale`, and returns whether every colour fits. */
    const paint = (scale: number): boolean => {
        const sweep = BASE_SWEEP * scale;
        const span = BASE_LIGHT_SPAN * scale;
        if (sweep > MOST_SWEEP || MIDDLE_LIGHTNESS - span / 2 < LEAST_LIGHTNESS || MIDDLE_LIGHTNESS + span / 2 > MOST_LIGHTNESS) return false;
        for (let t = 0; t < count; t++) {
            const l = MIDDLE_LIGHTNESS + lightUp * span * (lightAxis[t] - 0.5);
            const along = centreHue + way * sweep * (hueAxis[t] - 0.5);
            // Warm highlights and cool shadows: the hue leans towards a golden yellow as the light rises
            const lean = WARM_LEAN * ((l - MIDDLE_LIGHTNESS) / (MOST_LIGHTNESS - LEAST_LIGHTNESS)) * towardsWarm(along);
            const h = along + lean;
            const c = chromaShare * findMostChroma(l, h);
            writeLinearRgb(writeOklch(l, c, h, scratchLab), scratchRgb);
            if (!isInGamut(scratchRgb)) return false;
            colours[t] = toHexColour(scratchRgb);
            // The colour as it will be shown, rounded, is what is measured
            writeOklab(writeLinearRgbOfHex(colours[t], scratchRgb), labs[t]);
        }
        return true;
    };
    const measureNeighbours = (): number => {
        let closest = Infinity;
        for (let t = 0; t < count; t++) {
            const near = patch.neighboursOf(t);
            for (let i = 0; i < near.length; i++) if (near[i] > t) closest = Math.min(closest, measureColourDistance(labs[t], labs[near[i]]));
        }
        return closest;
    };

    // The closest pair is always two neighbours, so the search measures only those
    let low = LEAST_SCALE;
    let high = MOST_SCALE;
    for (let i = 0; i < SCALE_SEARCH_STEPS; i++) {
        const middle = (low + high) / 2;
        if (paint(middle) && measureNeighbours() < target) low = middle;
        else high = middle;
    }
    if (!paint(high)) return undefined;
    // Then every pair, once, to be sure
    let closest = Infinity;
    for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) closest = Math.min(closest, measureColourDistance(labs[a], labs[b]));
    }
    if (closest < target) return undefined;
    return { colours, hueAxis, lightAxis, closestPair: closest };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The sweep of hue and the span of lightness at a scale of 1. They are scaled together. */
const BASE_SWEEP = 150;
const BASE_LIGHT_SPAN = 0.3;
/** The scales searched between, and how finely. */
const LEAST_SCALE = 0.2;
const MOST_SCALE = 2.2;
const SCALE_SEARCH_STEPS = 14;
/** The widest sweep allowed, in degrees: wider, and the two ends come round to look alike. */
const MOST_SWEEP = 280;
/** The lightness of the gradient's middle, and the darkest and lightest it may go. */
const MIDDLE_LIGHTNESS = 0.665;
const LEAST_LIGHTNESS = 0.34;
const MOST_LIGHTNESS = 0.93;
/** How much of the most chroma sRGB can show each tile takes. */
const LEAST_CHROMA_SHARE = 0.82;
const MOST_CHROMA_SHARE = 0.95;
/** How far the hue leans, in degrees, from the middle lightness to the lightest. */
const WARM_LEAN = 25;
/** A golden yellow, the warmest hue, in OKLCH degrees. */
const WARM_HUE = 70;

const scratchLab = createColourTriple();
const scratchRgb = createColourTriple();

/** Which way to turn hue `h` to lean it warm: 1, -1, or less, close to the warm hue itself. */
function towardsWarm(h: number): number {
    const d = ((((WARM_HUE - h) % 360) + 540) % 360) - 180;
    return Math.max(-1, Math.min(1, d / 30));
}

/** Rescales `values` to run from 0 to 1. */
function spanZeroToOne(values: Float64Array): void {
    let least = Infinity;
    let most = -Infinity;
    for (let i = 0; i < values.length; i++) {
        least = Math.min(least, values[i]);
        most = Math.max(most, values[i]);
    }
    const range = most - least || 1;
    for (let i = 0; i < values.length; i++) values[i] = (values[i] - least) / range;
}
