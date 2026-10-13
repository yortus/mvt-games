// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/**
 * The colour schemes the visitor chooses between. A palette is presentation
 * alone, so the scope never hears of it. The picture's view model holds the
 * one chosen.
 */
export type PaletteName = 'ember' | 'ice' | 'ultraviolet' | 'spectrum' | 'slate';

/** Every palette, in the order the panel lists them. */
export const PALETTE_NAMES: readonly PaletteName[] = ['ember', 'ice', 'ultraviolet', 'spectrum', 'slate'];
