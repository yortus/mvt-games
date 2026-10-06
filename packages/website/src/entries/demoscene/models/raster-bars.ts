import type { RampKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A set of raster bars: horizontal bands of colour, each a ramp from dark to
 * bright and back, at a height on the screen. Addressed by index, so reading
 * them makes no objects.
 */
export interface RasterBars {
    readonly barCount: number;
    /** The centre of bar `index`, as a fractional character row; below 0 or above 25 is in the border. */
    barRowAt: (index: number) => number;
    barRampAt: (index: number) => RampKind;
}
