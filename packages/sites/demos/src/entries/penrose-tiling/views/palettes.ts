import type { PaletteName } from './palette-name';
import { DARKER_MIX, LIGHTER_MIX, RAMP_SIZE, TONES } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A palette as it is designed: a name to show, its colours from one end to the other, and what shows between the tiles. */
export interface Palette {
    readonly label: string;
    /** Its colours, as 0xRRGGBB, from one end to the other. They are blended evenly between. */
    readonly stops: readonly number[];
    /** The colour of the gaps between tiles, as 0xRRGGBB. */
    readonly backdrop: number;
}

/**
 * A palette ready to draw with, as CSS colours. It is made once for each
 * palette chosen, so that drawing builds no strings.
 */
export interface PaletteFills {
    /**
     * `RAMP_SIZE` colours, blended from one end of the palette to the other,
     * each in `TONES` tones, from darker to lighter. The colour at step
     * `ramp` in tone `tone` is at `ramp * TONES + tone`.
     */
    readonly fills: readonly string[];
    /** The colour of the gaps between tiles. */
    readonly backdrop: string;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/** Every palette, by name. */
export const PALETTES: Readonly<Record<PaletteName, Palette>> = {
    sunset: {
        label: 'Sunset',
        stops: [0x1d1442, 0x5b2378, 0xb83b75, 0xf0705a, 0xfdb35d, 0xfff0a8],
        backdrop: 0x0b0716,
    },
    lagoon: {
        label: 'Lagoon',
        stops: [0x04203f, 0x0a4d7a, 0x0f8aa3, 0x3cc6b8, 0x9ae8c8, 0xf2fbe0],
        backdrop: 0x020a14,
    },
    orchard: {
        label: 'Orchard',
        stops: [0x1e3b1f, 0x3f6b2a, 0x7fa33a, 0xd4c44a, 0xf2963e, 0xc8443a],
        backdrop: 0x0d140a,
    },
    jewel: {
        label: 'Jewel',
        stops: [0x16106b, 0x0b6e8a, 0x0f9d58, 0xffb300, 0xc2185b, 0x7b1fa2],
        backdrop: 0x07051a,
    },
    ember: {
        label: 'Ember',
        stops: [0x1c0606, 0x4a0c0c, 0x9b1d0f, 0xe0491a, 0xfa9a2a, 0xffe08a],
        backdrop: 0x060101,
    },
    aurora: {
        label: 'Aurora',
        stops: [0x061a33, 0x0f4c5c, 0x1fae8c, 0x7be495, 0xb388eb, 0xf2a7d8],
        backdrop: 0x020812,
    },
    blossom: {
        label: 'Blossom',
        stops: [0x5b2a4e, 0xa4456e, 0xe58fa8, 0xf9c6cf, 0xfdf0e6, 0xb5d8c7],
        backdrop: 0x2a1424,
    },
    ink: {
        label: 'Ink',
        stops: [0x0e1116, 0x2b3240, 0x56627a, 0x9aa6bd, 0xe4e8ef, 0xd8b45a],
        backdrop: 0x050608,
    },
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Blends the palette called `name` into its colours to draw with. */
export function buildPaletteFills(name: PaletteName): PaletteFills {
    const { stops, backdrop } = PALETTES[name];
    const fills: string[] = [];
    for (let ramp = 0; ramp < RAMP_SIZE; ramp++) {
        const color = blendStops(stops, ramp / (RAMP_SIZE - 1));
        fills.push(formatColor(mixColors(color, 0x000000, DARKER_MIX)));
        fills.push(formatColor(color));
        fills.push(formatColor(mixColors(color, 0xffffff, LIGHTER_MIX)));
    }
    if (fills.length !== RAMP_SIZE * TONES) throw new Error('palettes: each colour needs one fill for each tone');
    return { fills, backdrop: formatColor(backdrop) };
}

/** A CSS gradient of the palette called `name`, from one end to the other, for its swatch. */
export function describeSwatch(name: PaletteName): string {
    const stops = PALETTES[name].stops;
    let gradient = 'linear-gradient(90deg';
    for (let i = 0; i < stops.length; i++) gradient += `, ${formatColor(stops[i])}`;
    return `${gradient})`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The colour `at` the way from the first stop to the last, from 0 to 1. */
function blendStops(stops: readonly number[], at: number): number {
    const place = at * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(place));
    return mixColors(stops[index], stops[index + 1], place - index);
}

/** `from` mixed `amount` of the way toward `to`, from 0 to 1. */
function mixColors(from: number, to: number, amount: number): number {
    const red = mixChannel(from >> 16, to >> 16, amount);
    const green = mixChannel((from >> 8) & 0xff, (to >> 8) & 0xff, amount);
    const blue = mixChannel(from & 0xff, to & 0xff, amount);
    return (red << 16) | (green << 8) | blue;
}

function mixChannel(from: number, to: number, amount: number): number {
    return Math.round(from + (to - from) * amount);
}

/** `color`, as a CSS colour such as `#ff8800`. */
function formatColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
}
