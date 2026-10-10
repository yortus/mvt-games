import type { PaletteName } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A colour of a palette, and where it sits in its turn, from 0 to 1. */
export interface PaletteStop {
    readonly at: number;
    readonly color: number;
}

/**
 * Each palette's colours, as `0xRRGGBB`. The last stop repeats the first, so
 * that the turn joins up and the bands flow into each other however deep the
 * view goes.
 */
export const PALETTE_STOPS: { readonly [N in PaletteName]: readonly PaletteStop[] } = {
    ember: [
        { at: 0, color: 0x1a0608 },
        { at: 0.26, color: 0x7d1322 },
        { at: 0.5, color: 0xe25a1d },
        { at: 0.72, color: 0xffc44f },
        { at: 0.87, color: 0xfff4d4 },
        { at: 1, color: 0x1a0608 },
    ],
    ice: [
        { at: 0, color: 0x041122 },
        { at: 0.3, color: 0x0c5280 },
        { at: 0.56, color: 0x33bbd6 },
        { at: 0.78, color: 0xd2f5ff },
        { at: 1, color: 0x041122 },
    ],
    ultraviolet: [
        { at: 0, color: 0x0b0419 },
        { at: 0.28, color: 0x3d1274 },
        { at: 0.52, color: 0x9f26cd },
        { at: 0.73, color: 0xf472d2 },
        { at: 0.88, color: 0xfde9ff },
        { at: 1, color: 0x0b0419 },
    ],
    spectrum: [
        { at: 0, color: 0xff3b30 },
        { at: 0.17, color: 0xffd60a },
        { at: 0.34, color: 0x34c759 },
        { at: 0.5, color: 0x32ddd8 },
        { at: 0.67, color: 0x3a7bff },
        { at: 0.84, color: 0xbf5af2 },
        { at: 1, color: 0xff3b30 },
    ],
    slate: [
        { at: 0, color: 0x05070b },
        { at: 0.52, color: 0x8e9cab },
        { at: 0.76, color: 0xf2f6fa },
        { at: 1, color: 0x05070b },
    ],
};

/** The colour of the set itself in each palette: its own darkest shade. */
export const PALETTE_INTERIORS: { readonly [N in PaletteName]: number } = {
    ember: 0x0d0305,
    ice: 0x020810,
    ultraviolet: 0x070214,
    spectrum: 0x08080c,
    slate: 0x020406,
};

/** Each palette's name, for the panel. */
export const PALETTE_LABELS: { readonly [N in PaletteName]: string } = {
    ember: 'Ember',
    ice: 'Ice',
    ultraviolet: 'Ultraviolet',
    spectrum: 'Spectrum',
    slate: 'Slate',
};
