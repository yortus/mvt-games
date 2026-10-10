import { type PaletteName, PALETTE_NAMES } from '../data';
import { INTERIOR } from '../models';
import { PALETTE_INTERIORS, PALETTE_LABELS, type PaletteStop, PALETTE_STOPS } from './palette-stops';
import { BACKDROP_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A palette, as the panel shows it. */
export interface Palette {
    readonly name: PaletteName;
    /** Its name for the panel. */
    readonly label: string;
    /** Its colours as a CSS gradient, for the button that chooses it. */
    readonly swatch: string;
}

/** Every palette, in the order the panel lists them. */
export const PALETTES: readonly Palette[] = PALETTE_NAMES.map((name) => ({
    name,
    label: PALETTE_LABELS[name],
    swatch: buildSwatch(PALETTE_STOPS[name]),
}));

/** The colours a palette is drawn in, as pixels ready to write into an image. */
export interface PaletteColors {
    /**
     * One turn of the palette's colours, as opaque pixels. An escape value
     * is mapped onto it, and runs round it again and again as the value
     * climbs, so that detail shows at any depth.
     */
    readonly ramp: Int32Array;
    /** The colour of the set itself, where samples never escape. */
    readonly interior: number;
}

/** How many colours a turn of a palette holds. A power of two, so the turn is one mask away. */
export const RAMP_SIZE = 1024;

/** Builds the colours of the palette `name`. */
export function buildPaletteColors(name: PaletteName): PaletteColors {
    const stops = PALETTE_STOPS[name];
    const ramp = new Int32Array(RAMP_SIZE);
    for (let i = 0; i < RAMP_SIZE; i++) ramp[i] = toPixel(pickColorAt(stops, i / RAMP_SIZE));
    return { ramp, interior: toPixel(PALETTE_INTERIORS[name]) };
}

/**
 * Writes the colours of the samples `from` up to `to` into `pixels`, one
 * pixel each, reading their escape values from `escapes`. A sample nothing
 * is known about yet is the backdrop's colour, whatever the palette.
 *
 * The square root of the escape value picks the colour, so that the bands
 * near the set's edge, where the value climbs fastest, stay wide enough to
 * see.
 */
export function paintEscapes(
    pixels: Int32Array,
    escapes: Float32Array,
    from: number,
    to: number,
    colors: PaletteColors,
): void {
    const { ramp, interior } = colors;
    const mask = RAMP_SIZE - 1;
    for (let i = from; i < to; i++) {
        const escape = escapes[i];
        if (escape >= 0) pixels[i] = ramp[(Math.sqrt(escape) * BANDS_PER_ROOT) & mask];
        else pixels[i] = escape === INTERIOR ? interior : BACKDROP_PIXEL;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many colours of the ramp each step in the square root of the escape value covers. */
const BANDS_PER_ROOT = 88;

/** The backdrop's colour as a pixel. */
const BACKDROP_PIXEL = toPixel(BACKDROP_COLOR);

/** The colour at `position`, from 0 to 1, of a turn of `stops`. */
function pickColorAt(stops: readonly PaletteStop[], position: number): number {
    let next = 1;
    while (next < stops.length - 1 && stops[next].at < position) next++;
    const from = stops[next - 1];
    const to = stops[next];
    const width = to.at - from.at;
    const t = width > 0 ? (position - from.at) / width : 0;
    return mixColors(from.color, to.color, t < 0 ? 0 : t > 1 ? 1 : t);
}

/** `from` and `to` mixed, `t` of the way from one to the other. */
function mixColors(from: number, to: number, t: number): number {
    const r = ((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * t;
    const g = ((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * t;
    const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/**
 * A `0xRRGGBB` colour as an opaque little-endian RGBA pixel, `0xAABBGGRR`,
 * for an `Int32Array` over image data. Every browser runs little-endian.
 * Signed, so that the engine keeps it a small integer.
 */
function toPixel(color: number): number {
    return (0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color >> 16) & 0xff)) | 0;
}

/** A palette's stops as a CSS gradient, left to right. */
function buildSwatch(stops: readonly PaletteStop[]): string {
    let text = '';
    for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        text += `${i === 0 ? '' : ', '}#${stop.color.toString(16).padStart(6, '0')} ${Math.round(stop.at * 100)}%`;
    }
    return `linear-gradient(90deg, ${text})`;
}
