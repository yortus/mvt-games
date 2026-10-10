// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/**
 * The colour schemes the visitor chooses between. The model holds the chosen
 * name; the colours themselves are the views' business.
 */
export type PaletteName = 'ember' | 'ice' | 'ultraviolet' | 'spectrum' | 'slate';

/** Every palette, in the order the panel lists them. */
export const PALETTE_NAMES: readonly PaletteName[] = ['ember', 'ice', 'ultraviolet', 'spectrum', 'slate'];
