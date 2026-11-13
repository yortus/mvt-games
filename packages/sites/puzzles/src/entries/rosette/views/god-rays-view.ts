import { Container, FillGradient, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { keepBlurred } from './keep-blurred';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Rays of warm sunlight, fanning out from the sun. */
export interface GodRaysViewBindings {
    /** Where the sun is, in pixels, read once. Its rays fan out below it and to the right. */
    sunX: number;
    sunY: number;
    /** How far the rays reach from the sun, in pixels, read once. */
    length: number;
    /** How far the sun has come up, from 0, not yet, to 1. */
    strength: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * God rays: shafts of warm sunlight fanning out from the sun, above and to
 * the left, for drawing over a window, so they shine across it and on down
 * to the floor. Each shaft is narrow at the sun and widens, brightest a
 * little way out and fading to nothing. They shimmer: each sways a little
 * about the sun, its brightness flickers, slowly and a little quickly at
 * once, and a glint of brighter light runs down it now and then. They are
 * added to what is beneath, as light is, so they show most over the glass,
 * and come up with `strength`.
 *
 * Each shaft and glint is blurred once and kept as a texture, so only their
 * brightness, place and turn change from frame to frame.
 */
export function GodRaysView(bindings: GodRaysViewBindings): Container {
    const view = new Container();
    view.label = 'god rays';
    const { sunX, sunY, length } = bindings;

    // Presentation state: how long the rays have shimmered, in ms
    let shimmerMs = 0;

    // Each ray turns about the sun. Its shaft points straight down, before it is turned, so its gradient runs along it
    const rays: Container[] = [];
    const glints: Container[] = [];
    for (let i = 0; i < RAY_ANGLES.length; i++) {
        const half = RAY_WIDTHS[i] / 2;
        const shaft = new Graphics()
            .poly([-RAY_START_WIDTH / 2, 0, RAY_START_WIDTH / 2, 0, half, length, -half, length])
            .fill(new FillGradient({
                type: 'linear',
                start: { x: 0, y: 0 },
                end: { x: 0, y: 1 },
                textureSpace: 'local',
                colorStops: RAY_STOPS.map(([offset, alpha]) => ({ offset, color: toRgba(RAY_COLOR, alpha) })),
            }));
        const glint = keepBlurred(new Graphics().ellipse(0, 0, half * GLINT_WIDTH, length * GLINT_LENGTH).fill(GLINT_COLOR), GLINT_BLUR);
        const ray = new Container();
        ray.position.set(sunX, sunY);
        // Added to what is beneath, as light is, so it shows most over the glass
        ray.blendMode = 'add';
        ray.addChild(keepBlurred(shaft, RAY_BLUR), glint);
        rays.push(ray);
        glints.push(glint);
    }
    view.addChild(...rays);
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        shimmerMs = (shimmerMs + deltaMs) % SHIMMER_PERIOD_MS;
    }

    function refresh(): void {
        const strength = bindings.strength();
        view.visible = strength > 0;
        if (strength <= 0) return;
        const at = (2 * Math.PI * shimmerMs) / 1000;
        for (let i = 0; i < rays.length; i++) {
            const phase = i * 2.4;
            const flicker = 1 - FLICKER_SLOW - FLICKER_FAST
                + FLICKER_SLOW * (0.5 + 0.5 * Math.sin(at / FLICKER_SLOW_S[i] + phase))
                + FLICKER_FAST * (0.5 + 0.5 * Math.sin(at / FLICKER_FAST_S + phase * 1.3));
            rays[i].alpha = strength * RAY_ALPHAS[i] * flicker;
            rays[i].rotation = -RAY_ANGLES[i] + SWAY * Math.sin(at / SWAY_S[i] + phase);
            // A glint runs down the ray, then rests, before the next
            const along = ((shimmerMs / GLINT_MS + i * GLINT_STAGGER) % GLINT_EVERY);
            const glint = glints[i];
            glint.visible = along < 1;
            if (along < 1) {
                glint.position.set(0, length * (GLINT_FROM + (1 - GLINT_FROM) * along));
                glint.alpha = GLINT_ALPHA * Math.sin(Math.PI * along);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The rays: each one's angle from straight down, turned towards the right,
 * in radians, its width where it ends, in pixels, and how bright it is at
 * its brightest, and how wide every ray is at the sun.
 */
const RAY_ANGLES = [0.22, 0.36, 0.47, 0.6, 0.72, 0.85, 0.98];
const RAY_WIDTHS = [56, 28, 78, 36, 64, 26, 48];
const RAY_ALPHAS = [0.85, 0.6, 0.8, 0.55, 0.85, 0.5, 0.7];
const RAY_START_WIDTH = 4;
/** The rays' warm colour, and its alpha along each, from the sun (0) to its end (1): brightest a little way out. */
const RAY_COLOR = 0xffd98c;
const RAY_STOPS: readonly (readonly [number, number])[] = [[0, 0], [0.15, 0.8], [0.45, 0.6], [0.75, 0.28], [1, 0]];
const RAY_BLUR = 6;
/**
 * The shimmer: how much of each ray's brightness flickers slowly, each over
 * its own seconds, and how much quickly, and how far each sways about the
 * sun, in radians, over its own seconds.
 */
const FLICKER_SLOW = 0.3;
const FLICKER_SLOW_S = [3.1, 2.3, 3.7, 2.7, 3.3, 2.1, 2.9];
const FLICKER_FAST = 0.12;
const FLICKER_FAST_S = 0.37;
const SWAY = 0.018;
const SWAY_S = [5.3, 4.1, 6.2, 4.7, 5.8, 3.9, 5.1];
/**
 * The glints: each runs down its ray from GLINT_FROM of the way out to the
 * end in GLINT_MS, once every GLINT_EVERY times that, each ray's a share of
 * that apart. A glint is an oval, a share of its ray's width across and of
 * its length along, blurred, in a pale warm colour, as bright as GLINT_ALPHA.
 */
const GLINT_MS = 1600;
const GLINT_EVERY = 3;
const GLINT_STAGGER = 1.3;
const GLINT_FROM = 0.15;
const GLINT_WIDTH = 0.6;
const GLINT_LENGTH = 0.06;
const GLINT_COLOR = 0xfff2cc;
const GLINT_BLUR = 8;
const GLINT_ALPHA = 0.5;
/** The shimmer's time comes back round to 0 after this, long enough that no ray is seen to jump. */
const SHIMMER_PERIOD_MS = 1_000_000_000;

/** A colour, 0xRRGGBB, with an alpha, as CSS writes it. */
function toRgba(colour: number, alpha: number): string {
    return `rgba(${(colour >> 16) & 0xff}, ${(colour >> 8) & 0xff}, ${colour & 0xff}, ${alpha})`;
}
