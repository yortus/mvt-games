import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { keepBlurred } from './keep-blurred';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Sunlight through a window, onto the floor below it. */
export interface SunlightViewBindings {
    /** The window's pieces, each an outline in pixels, as x, y pairs, and each one's colour, read once. */
    outlines: readonly (readonly number[])[];
    colours: readonly number[];
    /** The window's box, in pixels, read once. Its light falls on the floor below it. */
    left: number;
    top: number;
    width: number;
    height: number;
    /** How far the sun has come up, from 0, not yet, to 1. */
    strength: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Sunlight through a window, from behind it and a little to the left, for
 * drawing behind the window: beams of light from the glass down to the
 * floor below, each the colour of the glass it shines through, and a soft,
 * blurred pool on the floor, where the window's colours land, squashed and
 * turned over, as light from above and behind would cast them. Each beam
 * runs from a point of the glass to where that point's light lands, so
 * only the part below the window shows. Motes of dust drift down the beams,
 * twinkling, and the beams breathe slowly. It all comes up with
 * `strength`.
 *
 * The pool and each beam are blurred once, and kept as textures, so only
 * their brightness changes from frame to frame.
 */
export function SunlightView(bindings: SunlightViewBindings): Container {
    const view = new Container();
    view.label = 'sunlight';
    const { outlines, colours, left, top, width, height } = bindings;

    // Presentation state: how long the motes have drifted, in ms
    let driftMs = 0;

    // The floor's pool of light: the window turned over, squashed, and leaning away from the sun
    const poolTop = top + height + POOL_GAP;
    const poolHeight = height * POOL_SQUASH;
    const poolMiddle = left + width / 2 + POOL_SHIFT;
    const poolWidth = width * POOL_WIDEN;
    const castX = (x: number, y: number): number => poolMiddle + ((x - left) / width - 0.5) * poolWidth + (1 - (y - top) / height) * POOL_LEAN;
    const castY = (y: number): number => poolTop + (1 - (y - top) / height) * poolHeight;
    const poolGlass = new Graphics();
    for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i];
        const cast: number[] = [];
        for (let k = 0; k < outline.length; k += 2) cast.push(castX(outline[k], outline[k + 1]), castY(outline[k + 1]));
        poolGlass.poly(cast).fill(colours[i]);
    }
    const pool = keepBlurred(poolGlass, POOL_BLUR);

    // The rays: each from a point of the glass to where its light lands, widening as it goes
    const rayCount = RAY_ALONGS.length;
    const rayTopXs = new Float64Array(rayCount);
    const rayTopYs = new Float64Array(rayCount);
    const rayBottomXs = new Float64Array(rayCount);
    const rayBottomYs = new Float64Array(rayCount);
    const rayWidths = new Float64Array(rayCount);
    const rays: Container[] = [];
    for (let i = 0; i < rayCount; i++) {
        const x = left + RAY_ALONGS[i] * width;
        const y = top + RAY_FROM * height;
        rayTopXs[i] = x;
        rayTopYs[i] = y;
        rayBottomXs[i] = castX(x, y);
        rayBottomYs[i] = castY(y);
        rayWidths[i] = RAY_WIDTHS[i] * width;
        const half = rayWidths[i] / 2;
        const beam = new Graphics().poly([
            x - half, y,
            x + half, y,
            rayBottomXs[i] + half * RAY_WIDENING, rayBottomYs[i],
            rayBottomXs[i] - half * RAY_WIDENING, rayBottomYs[i],
        ]).fill(mixWithWhite(findColourAt(x, y), RAY_PALENESS));
        rays.push(keepBlurred(beam, RAY_BLUR));
    }

    // The motes, each in a ray, at its own place across it, and its own pace
    const mote = new GraphicsContext().circle(0, 0, MOTE_RADIUS).fill(MOTE_COLOR);
    const motes: Graphics[] = [];
    for (let k = 0; k < MOTE_COUNT; k++) motes.push(new Graphics(mote));

    view.addChild(pool, ...rays, ...motes);
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    /** The colour of the glass at (`x`, `y`), or white if there is none there. */
    function findColourAt(x: number, y: number): number {
        for (let i = 0; i < outlines.length; i++) if (isInside(outlines[i], x, y)) return colours[i];
        return 0xffffff;
    }

    function update(deltaMs: number): void {
        driftMs = (driftMs + deltaMs) % DRIFT_PERIOD_MS;
    }

    function refresh(): void {
        const strength = bindings.strength();
        view.visible = strength > 0;
        if (strength <= 0) return;
        pool.alpha = POOL_ALPHA * strength * strength;
        for (let i = 0; i < rayCount; i++) {
            const breath = 0.5 + 0.5 * Math.sin((2 * Math.PI * driftMs) / RAY_BREATHE_MS + i * 1.7);
            rays[i].alpha = strength * RAY_ALPHAS[i] * (1 - RAY_BREATHE + RAY_BREATHE * breath);
        }
        for (let k = 0; k < MOTE_COUNT; k++) {
            const r = k % rayCount;
            const along = (scatter(k, 1) + driftMs / (MOTE_DRIFT_MS * (0.7 + 0.6 * scatter(k, 2)))) % 1;
            const across = (scatter(k, 3) - 0.5) * MOTE_SPREAD * rayWidths[r] * (1 + (RAY_WIDENING - 1) * along);
            const twinkle = 0.5 + 0.5 * Math.sin((2 * Math.PI * driftMs) / MOTE_TWINKLE_MS + k * 2.3);
            motes[k].position.set(rayTopXs[r] + (rayBottomXs[r] - rayTopXs[r]) * along + across, rayTopYs[r] + (rayBottomYs[r] - rayTopYs[r]) * along);
            motes[k].alpha = strength * Math.sin(Math.PI * along) * (0.35 + 0.65 * twinkle);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The pool of light on the floor: how far below the window it starts, in
 * pixels, how tall it is, as a share of the window's height, how far right
 * of the window it is, and how much wider, how far its far edge leans right,
 * away from the sun, in pixels, how blurred it is, and how bright.
 */
const POOL_GAP = 30;
const POOL_SQUASH = 0.13;
const POOL_SHIFT = 10;
const POOL_WIDEN = 1.05;
const POOL_LEAN = 36;
const POOL_BLUR = 7;
const POOL_ALPHA = 0.6;
/**
 * The beams: how far down the window they start, as a share of its height,
 * where each is across it, how wide each is, as a share of its width, how
 * much wider each is by the floor, how much paler than its glass, as a
 * share of the way to white, their blur and brightness, and how slowly they
 * breathe, and by what share of their brightness.
 */
const RAY_FROM = 0.35;
const RAY_ALONGS = [0.14, 0.33, 0.52, 0.7, 0.87];
const RAY_WIDTHS = [0.07, 0.11, 0.06, 0.1, 0.05];
const RAY_WIDENING = 1.5;
const RAY_PALENESS = 0.2;
const RAY_BLUR = 8;
const RAY_ALPHAS = [0.65, 0.5, 0.7, 0.55, 0.62];
const RAY_BREATHE_MS = 4200;
const RAY_BREATHE = 0.35;
/**
 * The motes of dust: how many, their size, in pixels, and colour, about how
 * long one takes to drift down its ray, how quickly they twinkle, in ms, and
 * how far across its ray each can be, as a share of its width.
 */
const MOTE_COUNT = 30;
const MOTE_RADIUS = 1.3;
const MOTE_COLOR = 0xfffbea;
const MOTE_DRIFT_MS = 11000;
const MOTE_TWINKLE_MS = 900;
const MOTE_SPREAD = 0.8;
/** The drift's time comes back round to 0 after this, long enough that no mote is seen to jump. */
const DRIFT_PERIOD_MS = 1_000_000 * MOTE_DRIFT_MS;

/** `colour`, 0xRRGGBB, taken `share` of the way to white. */
function mixWithWhite(colour: number, share: number): number {
    const r = Math.round(((colour >> 16) & 0xff) + (255 - ((colour >> 16) & 0xff)) * share);
    const g = Math.round(((colour >> 8) & 0xff) + (255 - ((colour >> 8) & 0xff)) * share);
    const b = Math.round((colour & 0xff) + (255 - (colour & 0xff)) * share);
    return (r << 16) | (g << 8) | b;
}

/** Whether (`x`, `y`) is inside a polygon given as x, y pairs: whether a ray from it crosses its sides an odd number of times. */
function isInside(points: readonly number[], x: number, y: number): boolean {
    let isIn = false;
    const n = points.length / 2;
    for (let k = 0, last = n - 1; k < n; last = k++) {
        const ky = points[k * 2 + 1];
        const ly = points[last * 2 + 1];
        if ((ky > y) !== (ly > y) && x < points[k * 2] + ((points[last * 2] - points[k * 2]) * (y - ky)) / (ly - ky)) isIn = !isIn;
    }
    return isIn;
}

/** A value from 0 to 1 that looks random, but is the same for the same mote and salt every time. */
function scatter(index: number, salt: number): number {
    const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
}
