import type { GrainKind } from '../models';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The colour of a grain. Each grain gets one of a few shades of its kind's
 * colour, picked from its id, so a pile looks grainy rather than flat. The id
 * is stable for the grain's life, so its shade never flickers.
 *
 * Presentation only: the model knows kinds, never colours.
 */
export function pickGrainTint(kind: GrainKind, id: number): number {
    // Multiplicative hash, top three bits: neighbouring ids get unrelated shades.
    const shade = Math.imul(id, 0x9e3779b1) >>> (32 - SHADE_BITS);
    switch (kind) {
        case 'sand': return SAND_SHADES[shade];
        case 'water': return WATER_SHADES[shade];
        case 'wall': return WALL_SHADES[shade];
    }
}

/**
 * The same colour as `pickGrainTint`, as an opaque pixel: four bytes, red
 * first, packed into one number for an `Int32Array` over RGBA pixel data.
 * Assumes a little-endian platform, as every browser runs on. Signed, so
 * that V8 keeps it a small integer rather than boxing it: with alpha 255 the
 * value is a small negative number.
 */
export function pickGrainPixel(kind: GrainKind, id: number): number {
    const shade = Math.imul(id, 0x9e3779b1) >>> (32 - SHADE_BITS);
    switch (kind) {
        case 'sand': return SAND_PIXELS[shade];
        case 'water': return WATER_PIXELS[shade];
        case 'wall': return WALL_PIXELS[shade];
    }
}

/** A grain colour by shade index, for drawing samples of a kind. */
export function lookUpShade(kind: GrainKind, shade: number): number {
    const shades = kind === 'sand' ? SAND_SHADES : kind === 'water' ? WATER_SHADES : WALL_SHADES;
    return shades[shade % SHADE_COUNT];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHADE_BITS = 3;
const SHADE_COUNT = 1 << SHADE_BITS;

/** Shades of a base colour, from a little darker to a little lighter. */
function makeShades(base: number, spread: number): readonly number[] {
    const shades: number[] = [];
    for (let i = 0; i < SHADE_COUNT; i++) {
        const factor = 1 + spread * (i / (SHADE_COUNT - 1) - 0.5);
        shades.push(scaleColor(base, factor));
    }
    return shades;
}

function scaleColor(color: number, factor: number): number {
    const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.round((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
}

const SAND_SHADES = makeShades(0xdcb86a, 0.28);
const WATER_SHADES = makeShades(0x3d8fe0, 0.18);
const WALL_SHADES = makeShades(0x7c8496, 0.2);

const SAND_PIXELS = toPixels(SAND_SHADES);
const WATER_PIXELS = toPixels(WATER_SHADES);
const WALL_PIXELS = toPixels(WALL_SHADES);

/** `0xRRGGBB` colours as opaque little-endian RGBA pixels, `0xAABBGGRR`, signed. */
function toPixels(colors: readonly number[]): Int32Array {
    const pixels = new Int32Array(colors.length);
    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        pixels[i] = 0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color >> 16) & 0xff);
    }
    return pixels;
}
